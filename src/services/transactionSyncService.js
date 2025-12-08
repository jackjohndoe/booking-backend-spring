// Transaction Sync Service
// Handles comprehensive syncing of transactions from backend to local storage
import { walletService } from './walletService';
import { addTransaction, getTransactions, getWalletBalance, updateWalletBalance } from '../utils/wallet';
import { API_ENDPOINTS } from '../config/api';

/**
 * Calculate balance from transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {number} Calculated balance
 */
export const calculateBalanceFromTransactions = (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return 0;
  }

  let balance = 0;
  transactions.forEach(txn => {
    const amount = parseFloat(txn.amount || 0);
    const type = txn.type || txn.transactionType || '';
    
    if (type === 'deposit' || type === 'top_up' || type === 'transfer_in') {
      balance += amount;
    } else if (type === 'withdrawal' || type === 'payment' || type === 'transfer_out') {
      balance -= amount;
    }
  });

  return Math.floor(balance);
};

/**
 * Merge API transactions with local transactions, removing duplicates
 * @param {Array} apiTransactions - Transactions from API
 * @param {Array} localTransactions - Transactions from local storage
 * @returns {Array} Merged and deduplicated transactions
 */
export const mergeTransactions = (apiTransactions = [], localTransactions = []) => {
  // Create a map to track transactions by reference/ID
  // Use multiple keys to ensure proper matching (reference, paymentReference, flutterwaveTxRef, id)
  const transactionMap = new Map();
  const processedKeys = new Set(); // Track which transactions we've already processed
  
  // First, add local transactions (older data, may have more details)
  localTransactions.forEach(txn => {
    // Try multiple keys for matching
    const keys = [
      txn.reference,
      txn.paymentReference,
      txn.flutterwaveTxRef,
      txn.id,
      `${txn.type}_${txn.amount}_${txn.date}` // Fallback key
    ].filter(Boolean);
    
    // Use first available key
    const key = keys[0];
    if (key && !processedKeys.has(key)) {
      transactionMap.set(key, txn);
      processedKeys.add(key);
      // Also add other keys to map for lookup
      keys.slice(1).forEach(k => {
        if (!transactionMap.has(k)) {
          transactionMap.set(k, txn); // Point to same transaction
        }
      });
    }
  });
  
  // Then, add/update with API transactions (prefer API data as it's more authoritative)
  apiTransactions.forEach(txn => {
    // Try multiple keys for matching
    const keys = [
      txn.reference,
      txn.paymentReference,
      txn.flutterwaveTxRef,
      txn.id,
      `${txn.type}_${txn.amount}_${txn.createdAt || txn.date}` // Fallback key
    ].filter(Boolean);
    
    const primaryKey = keys[0];
    if (primaryKey) {
      // Check if we already have this transaction (by any of its keys)
      let existing = null;
      let existingKey = null;
      
      for (const key of keys) {
        if (transactionMap.has(key)) {
          existing = transactionMap.get(key);
          existingKey = key;
          break;
        }
      }
      
      if (existing) {
        // Merge: prefer API data but keep local details
        const merged = {
          ...existing,
          ...txn,
          // Keep local userEmail if API doesn't have it
          userEmail: txn.userEmail || existing.userEmail,
          // Preserve all reference fields
          reference: txn.reference || existing.reference,
          paymentReference: txn.paymentReference || existing.paymentReference,
          flutterwaveTxRef: txn.flutterwaveTxRef || existing.flutterwaveTxRef,
          // Update timestamp to most recent
          updatedAt: new Date().toISOString(),
        };
        
        // Update all keys pointing to this transaction
        transactionMap.set(primaryKey, merged);
        keys.forEach(k => transactionMap.set(k, merged));
        processedKeys.add(primaryKey);
      } else {
        // New transaction
        transactionMap.set(primaryKey, txn);
        keys.slice(1).forEach(k => {
          if (!transactionMap.has(k)) {
            transactionMap.set(k, txn);
          }
        });
        processedKeys.add(primaryKey);
      }
    }
  });
  
  // Convert map to array and sort by date (most recent first)
  // Also ensure no duplicates by checking all reference fields
  const merged = Array.from(transactionMap.values());
  
  // Final deduplication pass - remove any remaining duplicates
  const finalMap = new Map();
  merged.forEach(txn => {
    // Try multiple keys for final deduplication
    const keys = [
      txn.id,
      txn.reference,
      txn.paymentReference,
      txn.flutterwaveTxRef,
      `${txn.type}_${txn.amount}_${txn.timestamp || txn.date || txn.createdAt}`
    ].filter(Boolean);
    
    // Use first available unique key
    let added = false;
    for (const key of keys) {
      if (!finalMap.has(key)) {
        finalMap.set(key, txn);
        added = true;
        break;
      }
    }
    
    // If no key worked, use a combination
    if (!added) {
      const fallbackKey = `${txn.type}_${txn.amount}_${txn.timestamp || txn.date || txn.createdAt || Date.now()}_${Math.random()}`;
      finalMap.set(fallbackKey, txn);
    }
  });
  
  const finalMerged = Array.from(finalMap.values());
  finalMerged.sort((a, b) => {
    const dateA = new Date(a.timestamp || a.date || a.createdAt || 0);
    const dateB = new Date(b.timestamp || b.date || b.createdAt || 0);
    return dateB - dateA;
  });
  
  return finalMerged;
};

/**
 * Sync transactions from API to local storage
 * @param {string} userEmail - User's email address
 * @param {Array} apiTransactions - Transactions from API
 * @returns {Promise<number>} Number of transactions synced
 */
export const syncTransactionsToLocal = async (userEmail, apiTransactions = []) => {
  try {
    if (!userEmail || !Array.isArray(apiTransactions)) {
      return 0;
    }

    const normalizedEmail = userEmail.toLowerCase().trim();
    let syncedCount = 0;

    // Get existing local transactions to check for duplicates
    const localTransactions = await getTransactions(normalizedEmail);
    const localRefs = new Set(
      localTransactions.map(t => t.reference || t.id || t.paymentReference).filter(Boolean)
    );

    // Sync each API transaction to local storage
    for (const apiTxn of apiTransactions) {
      const ref = apiTxn.reference || apiTxn.id || apiTxn.paymentReference;
      
      // Skip if already exists locally
      if (ref && localRefs.has(ref)) {
        continue;
      }

      try {
        // Map API transaction format to local format
        // CRITICAL: Preserve all reference fields for proper tracking
        const localTxn = {
          type: apiTxn.type || (apiTxn.amount > 0 ? 'deposit' : 'payment'),
          amount: Math.abs(parseFloat(apiTxn.amount || 0)),
          description: apiTxn.description || apiTxn.narration || 'Transaction',
          status: apiTxn.status || 'completed',
          method: apiTxn.paymentMethod || apiTxn.method || 'Flutterwave',
          // Store reference in multiple fields for reliable matching
          reference: ref || apiTxn.reference || apiTxn.flutterwaveTxRef || apiTxn.id,
          paymentReference: ref || apiTxn.paymentReference || apiTxn.flutterwaveTxRef || apiTxn.id,
          // Store Flutterwave-specific references
          flutterwaveTxRef: apiTxn.flutterwaveTxRef || apiTxn.reference || ref,
          flutterwaveFlwRef: apiTxn.flutterwaveFlwRef || apiTxn.flwRef,
          userEmail: normalizedEmail,
          date: apiTxn.createdAt || apiTxn.date || new Date().toISOString(),
          timestamp: new Date(apiTxn.createdAt || apiTxn.date || Date.now()).getTime(),
          createdAt: apiTxn.createdAt || apiTxn.date || new Date().toISOString(),
          updatedAt: apiTxn.updatedAt || apiTxn.processedAt || new Date().toISOString(),
          // Preserve API transaction ID if available
          apiTransactionId: apiTxn.id || apiTxn.transactionId,
        };

        await addTransaction(normalizedEmail, localTxn);
        syncedCount++;
        console.log(`✅ Synced transaction to local: ${ref} - ₦${localTxn.amount.toLocaleString()}`);
      } catch (txnError) {
        console.error(`Error syncing transaction ${ref}:`, txnError);
        // Continue with other transactions
      }
    }

    return syncedCount;
  } catch (error) {
    console.error('Error syncing transactions to local storage:', error);
    return 0;
  }
};

/**
 * Comprehensive sync of all transactions from backend
 * Forces backend to fetch from Flutterwave and syncs to local storage
 * @param {string} userEmail - User's email address
 * @returns {Promise<{transactions: Array, balance: number, syncedCount: number}>}
 */
export const syncAllTransactionsFromBackend = async (userEmail) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    const normalizedEmail = userEmail.toLowerCase().trim();
    console.log(`🔄 Starting comprehensive transaction sync for ${normalizedEmail}...`);

    // Step 1: Force backend to sync all transactions from Flutterwave
    console.log('🔄 Step 1: Forcing backend to sync from Flutterwave...');
    let syncResult = null;
    try {
      syncResult = await walletService.syncAllTransactions();
      console.log('✅ Backend sync-all completed:', syncResult);
      
      // Wait a bit for backend to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (syncError) {
      console.warn('⚠️ Backend sync-all failed (non-fatal):', syncError.message);
      // Continue anyway - we'll try to fetch transactions
    }
    
    // Step 1.5: Try to verify any transactions that might exist but weren't fetched
    // This handles cases where transactions exist in Flutterwave but email-based fetching returned 0
    console.log('🔄 Step 1.5: Attempting to verify transactions that might exist in Flutterwave...');
    try {
      // Get local transactions to extract potential txRefs to verify
      const localTransactions = await getTransactions(normalizedEmail);
      const txRefsToVerify = new Set();
      
      // Extract potential txRefs from local transactions
      localTransactions.forEach(txn => {
        if (txn.flutterwaveTxRef && !txn.flutterwaveTxRef.startsWith('txn_')) {
          txRefsToVerify.add(txn.flutterwaveTxRef);
        }
        if (txn.reference && !txn.reference.startsWith('txn_') && txn.reference.includes('@')) {
          txRefsToVerify.add(txn.reference);
        }
        if (txn.paymentReference && !txn.paymentReference.startsWith('txn_') && txn.paymentReference.includes('@')) {
          txRefsToVerify.add(txn.paymentReference);
        }
      });
      
      // Also try common patterns based on user email
      const emailPattern = normalizedEmail.replace(/[^a-z0-9]/g, '_');
      // Pattern: wallet_topup_{email}_{timestamp}
      // Pattern: {email}_{timestamp}_listing_{listingId}_{random}
      // We can't generate exact timestamps, but we can try verifying if there are any references
      
      if (txRefsToVerify.size > 0) {
        console.log(`🔄 Found ${txRefsToVerify.size} potential transaction references to verify...`);
        try {
          const verifyResult = await walletService.verifyMultipleTransactions(Array.from(txRefsToVerify));
          if (verifyResult && verifyResult.processed > 0) {
            console.log(`✅ Verified ${verifyResult.processed} transactions directly by txRef`);
            // Wait a bit for backend to process verified transactions
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (verifyError) {
          console.warn('⚠️ Error verifying transactions by txRef (non-fatal):', verifyError.message);
        }
      }
    } catch (verifyError) {
      console.warn('⚠️ Error in transaction verification step (non-fatal):', verifyError.message);
    }

    // Step 2: Fetch all transactions from backend (with retry)
    console.log('🔄 Step 2: Fetching ALL transactions from backend...');
    let apiTransactions = [];
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const transactionsResult = await walletService.getTransactions();
        if (transactionsResult !== null && transactionsResult !== undefined) {
          apiTransactions = Array.isArray(transactionsResult) 
            ? transactionsResult 
            : (transactionsResult.data || []);
          console.log(`✅ Fetched ${apiTransactions.length} transactions from backend (attempt ${attempt}/${maxRetries})`);
          break; // Success, exit retry loop
        } else {
          console.warn(`⚠️ Backend returned null for transactions (attempt ${attempt}/${maxRetries})`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      } catch (fetchError) {
        console.error(`❌ Error fetching transactions from backend (attempt ${attempt}/${maxRetries}):`, fetchError.message);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          console.error('❌ Failed to fetch transactions after all retries');
        }
      }
    }
    
    if (apiTransactions.length === 0) {
      console.warn('⚠️ No transactions fetched from backend - will use local transactions only');
    }

    // Step 3: Sync API transactions to local storage
    console.log('🔄 Step 3: Syncing transactions to local storage...');
    const syncedCount = await syncTransactionsToLocal(normalizedEmail, apiTransactions);
    console.log(`✅ Synced ${syncedCount} new transactions to local storage`);

    // Step 4: Get local transactions and merge with API
    console.log('🔄 Step 4: Merging API and local transactions...');
    const localTransactions = await getTransactions(normalizedEmail);
    const mergedTransactions = mergeTransactions(apiTransactions, localTransactions);
    console.log(`✅ Merged transactions: ${mergedTransactions.length} total (${apiTransactions.length} API + ${localTransactions.length} local)`);

    // Step 5: Calculate balance from all transactions
    console.log('🔄 Step 5: Calculating balance from transactions...');
    const calculatedBalance = calculateBalanceFromTransactions(mergedTransactions);
    console.log(`✅ Calculated balance from transactions: ₦${calculatedBalance.toLocaleString()}`);

    // Step 6: Get API balance and compare
    let apiBalance = 0;
    try {
      const balanceResult = await walletService.getBalance();
      if (balanceResult !== null && balanceResult !== undefined) {
        if (typeof balanceResult === 'number') {
          apiBalance = balanceResult;
        } else if (typeof balanceResult === 'object') {
          apiBalance = balanceResult.balance || balanceResult.amount || 0;
        }
        console.log(`✅ API balance: ₦${apiBalance.toLocaleString()}`);
      }
    } catch (balanceError) {
      console.warn('⚠️ Error fetching API balance:', balanceError.message);
    }

    // Step 7: Use the higher balance (API or calculated) and update local if needed
    const finalBalance = Math.max(apiBalance, calculatedBalance);
    if (finalBalance > 0) {
      const currentLocalBalance = await getWalletBalance(normalizedEmail);
      if (currentLocalBalance !== finalBalance) {
        console.log(`🔄 Updating local balance: ${currentLocalBalance} → ${finalBalance}`);
        await updateWalletBalance(normalizedEmail, finalBalance);
      }
    }

    console.log(`✅ Transaction sync completed: ${mergedTransactions.length} transactions, Balance: ₦${finalBalance.toLocaleString()}`);

    return {
      transactions: mergedTransactions,
      balance: finalBalance,
      syncedCount,
      apiTransactions: apiTransactions.length,
      localTransactions: localTransactions.length,
    };
  } catch (error) {
    console.error('❌ Error in comprehensive transaction sync:', error);
    throw error;
  }
};

