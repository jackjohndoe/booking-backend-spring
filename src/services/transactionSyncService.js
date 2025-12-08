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
    // Skip Welcome Bonus Voucher transactions
    const description = (txn.description || '').toLowerCase();
    if (description.includes('welcome bonus') || description.includes('welcome bonus voucher')) {
      return; // Skip this transaction
    }
    
    const amount = parseFloat(txn.amount || 0);
    const type = txn.type || txn.transactionType || '';
    
    // Only count valid Flutterwave/wallet transactions
    // Valid types: deposit, top_up, withdrawal, payment, transfer_in, transfer_out
    const validTypes = ['deposit', 'top_up', 'withdrawal', 'payment', 'transfer_in', 'transfer_out'];
    if (!validTypes.includes(type.toLowerCase())) {
      // Check if it has Flutterwave reference or is a booking payment
      const hasFlutterwaveRef = !!(txn.flutterwaveTxRef || 
        (txn.reference && (txn.reference.includes('@') || txn.reference.includes('wallet_topup') || txn.reference.includes('listing'))) ||
        (txn.paymentReference && (txn.paymentReference.includes('@') || txn.paymentReference.includes('wallet_topup') || txn.paymentReference.includes('listing'))));
      const isBookingPayment = txn.bookingPayment || txn.propertyTitle;
      
      if (!hasFlutterwaveRef && !isBookingPayment) {
        return; // Skip invalid transactions
      }
    }
    
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
  // Filter out Welcome Bonus Voucher transactions
  localTransactions.forEach(txn => {
    // Skip Welcome Bonus Voucher transactions
    const description = (txn.description || '').toLowerCase();
    if (description.includes('welcome bonus') || description.includes('welcome bonus voucher')) {
      return; // Skip this transaction
    }
    
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
  // Filter out Welcome Bonus Voucher transactions
  apiTransactions.forEach(txn => {
    // Skip Welcome Bonus Voucher transactions
    const description = (txn.description || txn.narration || '').toLowerCase();
    if (description.includes('welcome bonus') || description.includes('welcome bonus voucher')) {
      return; // Skip this transaction
    }
    
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
    // Only sync valid Flutterwave transactions (funding, withdrawals, payments)
    for (const apiTxn of apiTransactions) {
      const ref = apiTxn.reference || apiTxn.id || apiTxn.paymentReference;
      
      // Skip Welcome Bonus Voucher transactions
      const description = (apiTxn.description || apiTxn.narration || '').toLowerCase();
      if (description.includes('welcome bonus') || description.includes('welcome bonus voucher')) {
        console.log(`🗑️ Skipping Welcome Bonus Voucher transaction from API: ${ref || 'unknown'}`);
        continue;
      }
      
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
        console.log(`✅ Synced Flutterwave transaction to local: ${ref} - ₦${localTxn.amount.toLocaleString()}`);
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
        console.log(`🔄 Attempt ${attempt}/${maxRetries}: Calling walletService.getTransactions()...`);
        const transactionsResult = await walletService.getTransactions();
        
        if (transactionsResult !== null && transactionsResult !== undefined) {
          // Handle different response formats
          if (Array.isArray(transactionsResult)) {
            apiTransactions = transactionsResult;
          } else if (transactionsResult && typeof transactionsResult === 'object') {
            apiTransactions = transactionsResult.data || transactionsResult.transactions || transactionsResult.items || [];
          } else {
            apiTransactions = [];
          }
          
          console.log(`✅ Fetched ${apiTransactions.length} transactions from backend (attempt ${attempt}/${maxRetries})`);
          
          // Log details about fetched transactions
          if (apiTransactions.length > 0) {
            console.log(`📋 Transaction types: ${apiTransactions.map(t => t.type || 'unknown').join(', ')}`);
            console.log(`📋 Transaction statuses: ${apiTransactions.map(t => t.status || 'unknown').join(', ')}`);
            console.log(`📋 Has Flutterwave refs: ${apiTransactions.filter(t => t.flutterwaveTxRef || t.reference).length}/${apiTransactions.length}`);
          } else {
            console.warn(`⚠️ Backend returned empty transactions array (attempt ${attempt}/${maxRetries})`);
            console.warn(`⚠️ This could mean: 1) No transactions exist in backend, 2) Backend filtering issue, 3) Response format mismatch`);
          }
          
          break; // Success, exit retry loop
        } else {
          console.warn(`⚠️ Backend returned null for transactions (attempt ${attempt}/${maxRetries})`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      } catch (fetchError) {
        console.error(`❌ Error fetching transactions from backend (attempt ${attempt}/${maxRetries}):`, {
          message: fetchError.message,
          status: fetchError.status,
          stack: fetchError.stack
        });
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          console.error('❌ Failed to fetch transactions after all retries');
        }
      }
    }
    
    if (apiTransactions.length === 0) {
      console.warn('⚠️ No transactions fetched from backend - will use local transactions only');
      
      // If API balance is non-zero but we have 0 transactions, try to verify transactions directly
      // This handles cases where transactions exist in Flutterwave but weren't fetched by email
      try {
        const balanceResult = await walletService.getBalance();
        let apiBalance = 0;
        if (balanceResult !== null && balanceResult !== undefined) {
          if (typeof balanceResult === 'number') {
            apiBalance = balanceResult;
          } else if (typeof balanceResult === 'object') {
            apiBalance = balanceResult.balance || balanceResult.amount || 0;
          }
        }
        
        if (apiBalance > 0) {
          console.log(`⚠️ API balance is ₦${apiBalance.toLocaleString()} but 0 transactions returned - transactions may exist but weren't fetched`);
          console.log('🔄 Attempting to verify transactions by common patterns...');
          
          // Try to verify transactions using common Flutterwave txRef patterns
          const emailPattern = normalizedEmail.replace(/[^a-z0-9]/g, '_');
          
          // Common patterns:
          // 1. wallet_topup_{email}_{timestamp}
          // 2. {email}_{timestamp}_listing_{listingId}_{random}
          // We'll try to verify recent transactions by checking if they exist
          
          // Get local transactions that might have Flutterwave references
          const localTransactions = await getTransactions(normalizedEmail);
          const txRefsToVerify = new Set();
          
          // Extract txRefs from local transactions
          localTransactions.forEach(txn => {
            if (txn.flutterwaveTxRef && !txn.flutterwaveTxRef.startsWith('txn_')) {
              txRefsToVerify.add(txn.flutterwaveTxRef);
            }
            if (txn.reference && !txn.reference.startsWith('txn_') && (txn.reference.includes('@') || txn.reference.includes('wallet_topup'))) {
              txRefsToVerify.add(txn.reference);
            }
            if (txn.paymentReference && !txn.paymentReference.startsWith('txn_') && (txn.paymentReference.includes('@') || txn.paymentReference.includes('wallet_topup'))) {
              txRefsToVerify.add(txn.paymentReference);
            }
          });
          
          // If we have txRefs to verify, try verifying them
          if (txRefsToVerify.size > 0) {
            console.log(`🔄 Found ${txRefsToVerify.size} potential transaction references to verify directly...`);
            try {
              const verifyResult = await walletService.verifyMultipleTransactions(Array.from(txRefsToVerify));
              if (verifyResult && verifyResult.processed > 0) {
                console.log(`✅ Verified ${verifyResult.processed} transactions directly by txRef`);
                // Wait for backend to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Refetch transactions after verification
                const retryTransactionsResult = await walletService.getTransactions();
                if (retryTransactionsResult !== null && retryTransactionsResult !== undefined) {
                  if (Array.isArray(retryTransactionsResult)) {
                    apiTransactions = retryTransactionsResult;
                  } else if (retryTransactionsResult && typeof retryTransactionsResult === 'object') {
                    apiTransactions = retryTransactionsResult.data || retryTransactionsResult.transactions || retryTransactionsResult.items || [];
                  }
                  console.log(`✅ After verification, fetched ${apiTransactions.length} transactions from backend`);
                }
              }
            } catch (verifyError) {
              console.warn('⚠️ Error verifying transactions by txRef (non-fatal):', verifyError.message);
            }
          } else {
            console.warn('⚠️ No local transaction references found to verify - transactions may need to be created from Flutterwave');
          }
        }
      } catch (balanceCheckError) {
        console.warn('⚠️ Error checking API balance (non-fatal):', balanceCheckError.message);
      }
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
    // Check balance FIRST to see if transactions exist but aren't being returned
    let apiBalance = 0;
    try {
      console.log('🔄 Step 6: Fetching API balance to verify if transactions exist...');
      const balanceResult = await walletService.getBalance();
      console.log('📦 Balance result:', balanceResult);
      console.log('📦 Balance result type:', typeof balanceResult);
      
      if (balanceResult !== null && balanceResult !== undefined) {
        if (typeof balanceResult === 'number') {
          apiBalance = balanceResult;
        } else if (typeof balanceResult === 'object') {
          apiBalance = balanceResult.balance || balanceResult.amount || balanceResult.value || 0;
          console.log('📦 Extracted balance from object:', apiBalance);
        } else if (typeof balanceResult === 'string') {
          apiBalance = parseFloat(balanceResult) || 0;
        }
        console.log(`✅ API balance: ₦${apiBalance.toLocaleString()}`);
        
        // If balance is non-zero but we have 0 transactions, this is a problem
        if (apiBalance > 0 && apiTransactions.length === 0) {
          console.error(`❌ CRITICAL: API balance is ₦${apiBalance.toLocaleString()} but 0 transactions returned!`);
          console.error(`❌ This indicates transactions exist in Flutterwave but backend isn't returning them`);
          console.error(`❌ Possible causes: 1) Backend not storing transactions, 2) Backend filtering them out, 3) Response format issue`);
        }
      } else {
        console.warn('⚠️ API balance returned null/undefined');
      }
    } catch (balanceError) {
      console.error('❌ Error fetching API balance:', balanceError.message);
      console.error('❌ Balance error details:', balanceError);
    }

    // Step 7: Use API balance if available (it's more authoritative than calculated)
    // If API balance is non-zero but we have 0 transactions, the balance is still valid
    // This handles cases where transactions exist in Flutterwave but aren't being returned
    let finalBalance = apiBalance > 0 ? apiBalance : calculatedBalance;
    
    // If API balance is non-zero but we have no transactions, log a warning
    if (apiBalance > 0 && mergedTransactions.length === 0) {
      console.warn(`⚠️ API balance is ₦${apiBalance.toLocaleString()} but 0 transactions returned`);
      console.warn(`⚠️ This suggests transactions exist in Flutterwave but aren't being fetched/returned by backend`);
      console.warn(`⚠️ Using API balance as source of truth: ₦${apiBalance.toLocaleString()}`);
      
      // Still use API balance - it's the authoritative source
      finalBalance = apiBalance;
    }
    
    // Update local balance to match final balance
    if (finalBalance > 0 || (finalBalance === 0 && apiBalance === 0 && calculatedBalance === 0)) {
      const currentLocalBalance = await getWalletBalance(normalizedEmail);
      if (Math.abs(currentLocalBalance - finalBalance) > 0.01) {
        console.log(`🔄 Updating local balance: ₦${currentLocalBalance.toLocaleString()} → ₦${finalBalance.toLocaleString()}`);
        await updateWalletBalance(normalizedEmail, Math.floor(finalBalance));
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

