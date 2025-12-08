// Wallet utility functions - User-specific storage
// CRITICAL: Each user's wallet is completely isolated and independent
// - Each user has their own balance stored with user-specific key: walletBalance_{userEmail}
// - Each user has their own transaction history stored with user-specific key: walletTransactions_{userEmail}
// - NO wallet data is shared between users - each account is completely separate
// - Wallet operations (fund, payment, withdraw) only affect the specific user's wallet
// - Money can only appear in another user's wallet via sendMoneyToUser function
// - New users start with zero balance unless they claim the welcome bonus
// - Transaction history is unique to each user account
// - Balance validation: Maximum balance is ₦10,000,000 to prevent data corruption
// - Corrupted balances (NaN, negative, or > 10M) are automatically reset to 0
// - Transaction history is strictly isolated - no cross-user data leakage
//
// PERSISTENCE: Wallet data persists across sign-out and sign-in, just like profile data
// - Wallet balance is stored with user-specific key: walletBalance_{userEmail}
// - Transaction history is stored with user-specific key: walletTransactions_{userEmail}
// - When user signs out, wallet data REMAINS in AsyncStorage (not deleted)
// - When user signs back in, wallet data is automatically loaded using their email
// - This ensures wallet balance and transaction history are permanent per account
//
// EXCLUSIVE TRANSACTION STORAGE:
// - All wallet funding (including booking payments to hosts) creates transactions
// - Transactions are stored EXCLUSIVELY with the recipient's email as the key
// - When a host receives a booking payment, a transaction is created with their email
// - The transaction persists even if the host is signed out
// - When the host signs back in, they will see the transaction in their wallet history
// - Each user's wallet transaction page shows ONLY their own transactions
// - No cross-user transaction data leakage - complete isolation per account
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserStorageKey } from './userStorage';

/**
 * Clean up any old global transaction data to prevent cross-user leakage
 * This should be called once to remove the old shared storage key
 */
export const cleanupOldGlobalTransactions = async () => {
  try {
    // Remove old global transaction key if it exists
    const oldKey = 'walletTransactions';
    const oldData = await AsyncStorage.getItem(oldKey);
    if (oldData) {
      await AsyncStorage.removeItem(oldKey);
      console.log('✅ Cleaned up old global transaction data');
    }
  } catch (error) {
    console.error('Error cleaning up old global transactions:', error);
  }
};

/**
 * Validate and clean transactions for a specific user
 * Removes any transactions that don't belong to the user
 * @param {string} userEmail - User's email address
 */
export const validateUserTransactions = async (userEmail) => {
  try {
    if (!userEmail) {
      return;
    }
    
    const normalizedEmail = userEmail.toLowerCase().trim();
    const transactions = await getTransactions(normalizedEmail);
    
    // Filter to ensure ONLY this user's transactions
    const validTransactions = transactions.filter(txn => {
      if (txn.userEmail) {
        return txn.userEmail.toLowerCase().trim() === normalizedEmail;
      }
      // Legacy transactions without userEmail - add it for future validation
      txn.userEmail = normalizedEmail;
      return true;
    });
    
    // If any transactions were filtered out, update storage
    if (validTransactions.length !== transactions.length) {
      const key = getUserStorageKey('walletTransactions', normalizedEmail);
      await AsyncStorage.setItem(key, JSON.stringify(validTransactions));
      console.log(`✅ Cleaned ${transactions.length - validTransactions.length} invalid transactions for ${normalizedEmail}`);
    }
    
    return validTransactions;
  } catch (error) {
    console.error('Error validating user transactions:', error);
    return [];
  }
};

// Maximum reasonable wallet balance (₦10 million) - prevents data corruption
const MAX_WALLET_BALANCE = 10000000;

// Maximum payment amount allowed (₦10 million) - payments up to this amount are allowed
export const MAX_PAYMENT_AMOUNT = 10000000;

/**
 * Get wallet balance for a specific user
 * @param {string} userEmail - User's email address
 */
/**
 * Get wallet balance for a specific user
 * Each user's balance is stored separately and isolated from other users
 * @param {string} userEmail - User's email address (REQUIRED for user isolation)
 * @returns {Promise<number>} User's wallet balance (0 if not found or error)
 */
export const getWalletBalance = async (userEmail) => {
  try {
    if (!userEmail) {
      console.warn('getWalletBalance: No user email provided - returning 0 to prevent data leakage');
      return 0;
    }
    // Use user-specific key to ensure complete isolation
    // Each user has their own unique wallet - no data is shared between users
    const key = getUserStorageKey('walletBalance', userEmail);
    const balance = await AsyncStorage.getItem(key);
    
    // If no balance exists, return 0 (new users start with zero balance)
    // This ensures each user's wallet is independent and starts at zero
    if (!balance || balance === null || balance === undefined) {
      return 0;
    }
    
    // Parse as integer to avoid floating point precision issues with large amounts
    const parsedBalance = parseInt(balance, 10);
    
    // VALIDATION: Check for corrupted data only
    // Maximum reasonable balance: ₦10,000,000 (10 million)
    // If balance is corrupted (too high, negative, or NaN), reset to 0
    // NOTE: Large balances (up to MAX_WALLET_BALANCE) are legitimate for hosts receiving booking payments
    if (isNaN(parsedBalance) || parsedBalance < 0 || parsedBalance > MAX_WALLET_BALANCE) {
      console.warn(`⚠️ Corrupted wallet balance detected for ${userEmail}: ${balance}. Resetting to 0.`);
      // Reset corrupted balance to 0
      const key = getUserStorageKey('walletBalance', userEmail);
      await AsyncStorage.setItem(key, '0');
      return 0;
    }
    
    return parsedBalance;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    // Always return 0 on error to prevent data leakage
    return 0;
  }
};

/**
 * Update wallet balance for a specific user
 * @param {string} userEmail - User's email address
 * @param {number} newBalance - New balance amount
 */
export const updateWalletBalance = async (userEmail, newBalance) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    
    // VALIDATION: Ensure balance is a valid integer (wallet uses whole naira amounts)
    // Use Math.floor to ensure integer values and avoid floating point precision issues
    const validatedBalance = Math.floor(parseFloat(newBalance));
    if (isNaN(validatedBalance) || validatedBalance < 0) {
      console.warn(`⚠️ Invalid balance value: ${newBalance}. Setting to 0.`);
      await AsyncStorage.setItem(getUserStorageKey('walletBalance', userEmail), '0');
      return 0;
    }
    
    // Maximum reasonable balance: ₦10,000,000 (10 million)
    if (validatedBalance > MAX_WALLET_BALANCE) {
      console.warn(`⚠️ Balance exceeds maximum limit: ${validatedBalance}. Capping at ₦${MAX_WALLET_BALANCE.toLocaleString()}.`);
      const cappedBalance = MAX_WALLET_BALANCE;
      await AsyncStorage.setItem(getUserStorageKey('walletBalance', userEmail), cappedBalance.toString());
      return cappedBalance;
    }
    
    // Store as integer string to preserve precision for large amounts
    const key = getUserStorageKey('walletBalance', userEmail);
    await AsyncStorage.setItem(key, validatedBalance.toString());
    console.log(`✅ Wallet balance updated for ${userEmail}: ₦${validatedBalance.toLocaleString()}`);
    return validatedBalance;
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    throw error;
  }
};

/**
 * Add funds to wallet for a specific user
 * @param {string} userEmail - User's email address
 * @param {number} amount - Amount to add
 * @param {string} method - Payment method
 * @param {string} senderName - Name of the person sending the funds (optional)
 * @param {string} senderEmail - Email of the person sending the funds (optional)
 * @param {string} paymentReference - Paystack payment reference (optional)
 */
export const addFunds = async (userEmail, amount, method = 'Bank Transfer', senderName = null, senderEmail = null, paymentReference = null) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    
    // VALIDATION: Ensure amount is valid integer (wallet uses whole naira amounts)
    // Use Math.floor to ensure integer values and avoid floating point precision issues with large amounts
    const validatedAmount = Math.floor(parseFloat(amount));
    if (isNaN(validatedAmount) || validatedAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}. Amount must be a positive number.`);
    }
    
    const currentBalance = await getWalletBalance(userEmail);
    // Ensure integer arithmetic for large amounts
    const newBalance = Math.floor(currentBalance + validatedAmount);
    
    // Additional validation: Check if new balance would exceed maximum
    if (newBalance > MAX_WALLET_BALANCE) {
      console.warn(`⚠️ Adding ${validatedAmount} would exceed maximum balance. Current: ${currentBalance}, Requested: ${validatedAmount}`);
      throw new Error(`Balance would exceed maximum limit of ₦${MAX_WALLET_BALANCE.toLocaleString()}`);
    }
    
    await updateWalletBalance(userEmail, newBalance);
    
    // Add transaction with detailed description
    // PERSISTENCE: Transaction is stored with user-specific key (walletTransactions_{userEmail})
    // This ensures the transaction persists even if user is signed out
    // When user signs back in, they'll see this transaction in their history
    // CRITICAL: Each transaction is EXCLUSIVE to the user - stored with their email as the key
    // Transaction will appear in wallet transaction history when user signs back in
    
    // Create detailed transaction description
    let transactionDescription;
    let transactionMetadata = {};
    
    // For booking payments, create more detailed description
    if (method && method.includes('Booking Payment')) {
      const propertyTitle = method.replace('Booking Payment - ', '');
      transactionDescription = senderName 
        ? `Booking Payment from ${senderName} - ${propertyTitle}`
        : `Booking Payment Received - ${propertyTitle}`;
      transactionMetadata = {
        bookingPayment: true,
        propertyTitle: propertyTitle,
        transactionType: 'booking_payment',
        senderName: senderName || null,
        senderEmail: senderEmail || null,
      };
    } else {
      transactionDescription = senderName
        ? `Payment from ${senderName} - ${method || 'Bank Transfer'}`
        : `Wallet Top-up - ${method || 'Bank Transfer'}`;
      transactionMetadata = {
        transactionType: 'top_up',
        senderName: senderName || null,
        senderEmail: senderEmail || null,
      };
    }
    
    // Add transaction with detailed information
    // CRITICAL: Explicitly include senderName and senderEmail at top level so recipient can see who sent funds
    const transactionResult = await addTransaction(userEmail, {
      type: 'deposit',
      amount: validatedAmount,
      description: transactionDescription,
      status: 'completed',
      method: method || 'Bank Transfer',
      senderName: senderName || null, // Explicitly include sender name for recipient visibility
      senderEmail: senderEmail || null, // Explicitly include sender email for recipient visibility
      paymentReference: paymentReference || null, // Paystack payment reference for tracking
      ...transactionMetadata, // Also include in metadata for consistency
    });
    
    // Verify transaction was stored
    if (transactionResult && transactionResult.id) {
      console.log(`✅ Transaction stored EXCLUSIVELY for ${userEmail}: ${transactionDescription} - ₦${validatedAmount.toLocaleString()}`);
      console.log(`✅ Transaction ID: ${transactionResult.id}`);
      console.log(`✅ Transaction will be visible in wallet when user signs back in (persists across sign-out/sign-in)`);
      
      // Verify transaction is retrievable
      const verifyTransactions = await getTransactions(userEmail);
      const foundTransaction = verifyTransactions.find(t => t.id === transactionResult.id);
      if (foundTransaction) {
        console.log(`✅ Transaction verified in storage - will appear in wallet history`);
      } else {
        console.error(`❌ WARNING: Transaction ${transactionResult.id} not found in storage after creation!`);
      }
    } else {
      console.error(`❌ ERROR: Failed to create transaction for ${userEmail}`);
    }
    
    return newBalance;
  } catch (error) {
    console.error('Error adding funds:', error);
    throw error;
  }
};

/**
 * Get all transactions for a specific user
 * PERSISTENCE: Transaction history persists across sign-out and sign-in using user-specific key
 * Each user's transaction history is stored separately and isolated from other users
 * @param {string} userEmail - User's email address (REQUIRED for user isolation)
 * @returns {Promise<Array>} User's transaction history (empty array if not found or error)
 * 
 * Storage key: walletTransactions_{userEmail}
 * - Data persists when user signs out
 * - Data is automatically loaded when user signs back in
 * - Same persistence model as profile data
 */
export const getTransactions = async (userEmail) => {
  try {
    if (!userEmail) {
      console.warn('getTransactions: No user email provided - returning empty array to prevent data leakage');
      return [];
    }
    
    // VALIDATION: Normalize user email
    const normalizedEmail = userEmail.toLowerCase().trim();
    if (!normalizedEmail || normalizedEmail.length === 0) {
      console.warn('getTransactions: Invalid user email - returning empty array');
      return [];
    }
    
    // Use user-specific key to ensure complete isolation
    // Each user has their own unique transaction history - no data is shared
    const key = getUserStorageKey('walletTransactions', normalizedEmail);
    const transactionsJson = await AsyncStorage.getItem(key);
    
    // If no transactions exist, return empty array (new users start with empty history)
    if (!transactionsJson || transactionsJson === null || transactionsJson === undefined) {
      return [];
    }
    
    const transactions = JSON.parse(transactionsJson);
    
    // VALIDATION: Ensure transactions is an array
    if (!Array.isArray(transactions)) {
      console.warn(`⚠️ Invalid transaction data format for ${normalizedEmail}. Resetting to empty array.`);
      // Reset corrupted data to empty array
      await AsyncStorage.setItem(key, JSON.stringify([]));
      return [];
    }
    
    // CRITICAL: Filter transactions to ensure ONLY this user's transactions are returned
    // This prevents any cross-user data leakage
    const userTransactions = transactions.filter(txn => {
      // If transaction has userEmail, verify it matches exactly
      if (txn.userEmail) {
        const txnEmail = txn.userEmail.toLowerCase().trim();
        if (txnEmail !== normalizedEmail) {
          console.warn(`⚠️ Found transaction belonging to different user (${txnEmail} vs ${normalizedEmail}). Filtering out.`);
          return false;
        }
      }
      // If no userEmail in transaction (legacy data), assume it belongs to this user
      // But we should add userEmail to it for future validation
      return true;
    });
    
    // If we filtered out any transactions, update storage to remove them
    if (userTransactions.length !== transactions.length) {
      console.warn(`⚠️ Filtered out ${transactions.length - userTransactions.length} transactions not belonging to ${normalizedEmail}`);
      await AsyncStorage.setItem(key, JSON.stringify(userTransactions));
    }
    
    // Return ONLY this user's transactions
    return userTransactions;
  } catch (error) {
    console.error('Error getting transactions:', error);
    // Always return empty array on error to prevent data leakage
    return [];
  }
};

/**
 * Add a transaction for a specific user
 * CRITICAL: Each transaction is EXCLUSIVE to the user - no cross-user data
 * @param {string} userEmail - User's email address (REQUIRED for isolation)
 * @param {object} transaction - Transaction data
 */
export const addTransaction = async (userEmail, transaction) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required for transaction isolation');
    }
    
    // VALIDATION: Ensure userEmail is valid
    const normalizedEmail = userEmail.toLowerCase().trim();
    
    // Check for duplicates before adding
    const existingTransactions = await getTransactions(normalizedEmail);
    const transactionRef = transaction.reference || transaction.paymentReference || transaction.id;
    
    if (transactionRef) {
      const duplicate = existingTransactions.find(
        t => (t.reference || t.paymentReference || t.id) === transactionRef
      );
      if (duplicate) {
        console.log(`ℹ️ Transaction ${transactionRef} already exists, updating instead of creating duplicate`);
        // Update existing transaction with new data (prefer new data but keep old metadata)
        const updatedTransaction = {
          ...duplicate,
          ...transaction,
          id: duplicate.id, // Preserve original ID
          userEmail: normalizedEmail,
          // Ensure reference fields are preserved/updated
          reference: transaction.reference || duplicate.reference || transactionRef,
          paymentReference: transaction.paymentReference || duplicate.paymentReference || transactionRef,
          // Update timestamp to reflect modification
          updatedAt: new Date().toISOString(),
          // Preserve original creation date
          createdAt: duplicate.createdAt || duplicate.date || new Date().toISOString(),
        };
        // Update in storage
        const key = getUserStorageKey('walletTransactions', normalizedEmail);
        const updatedTransactions = existingTransactions.map(t => 
          (t.reference || t.paymentReference || t.id) === transactionRef ? updatedTransaction : t
        );
        await AsyncStorage.setItem(key, JSON.stringify(updatedTransactions));
        console.log(`✅ Transaction ${transactionRef} updated successfully`);
        return updatedTransaction;
      }
    }
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new Error('Invalid user email - cannot create transaction');
    }
    
    const transactions = await getTransactions(normalizedEmail);
    
    // Create transaction with user email embedded for additional security
    // CRITICAL: Ensure transaction has proper reference for tracking
    const transactionId = `txn_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTransaction = {
      id: transactionId,
      userEmail: normalizedEmail, // Embed user email in transaction for validation
      ...transaction,
      // Ensure reference is set (use paymentReference, reference, or id as fallback)
      reference: transaction.reference || transaction.paymentReference || transactionId,
      paymentReference: transaction.paymentReference || transaction.reference || transactionId,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      // Store creation date for tracking
      createdAt: new Date().toISOString(),
      // Store last update date
      updatedAt: new Date().toISOString(),
    };
    
    // CRITICAL: Filter out any transactions that don't belong to this user
    // This ensures no cross-user data contamination
    const userTransactions = transactions.filter(txn => {
      // If transaction has userEmail, verify it matches
      if (txn.userEmail) {
        return txn.userEmail.toLowerCase().trim() === normalizedEmail;
      }
      // If no userEmail in old transaction, assume it belongs to this user (legacy data)
      return true;
    });
    
    // Add new transaction to beginning of array (most recent first)
    userTransactions.unshift(newTransaction);
    
    // Store ONLY this user's transactions
    // CRITICAL: Transaction is stored with user-specific key (walletTransactions_{userEmail})
    // This ensures the transaction is EXCLUSIVE to this user and persists across sign-out/sign-in
    const key = getUserStorageKey('walletTransactions', normalizedEmail);
    await AsyncStorage.setItem(key, JSON.stringify(userTransactions));
    
    console.log(`✅ Transaction added EXCLUSIVELY for user: ${normalizedEmail}`);
    console.log(`✅ Transaction stored with key: ${key}`);
    console.log(`✅ Transaction will be visible in wallet when user signs back in (persists across sign-out/sign-in)`);
    console.log(`✅ Transaction details: ${transaction.description || 'N/A'} - ₦${(transaction.amount || 0).toLocaleString()}`);
    return newTransaction;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

/**
 * Make a payment from wallet for a specific user
 * Supports payments up to ₦10,000,000 (10 million naira)
 * @param {string} userEmail - User's email address
 * @param {number} amount - Payment amount (up to ₦10,000,000)
 * @param {string} description - Payment description
 */
export const makePayment = async (userEmail, amount, description) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    
    // VALIDATION: Ensure amount is valid integer (wallet uses whole naira amounts)
    // Use Math.floor to ensure integer values and avoid floating point precision issues with large amounts
    const validatedAmount = Math.floor(parseFloat(amount));
    if (isNaN(validatedAmount) || validatedAmount <= 0) {
      throw new Error(`Invalid payment amount: ${amount}. Amount must be a positive number.`);
    }
    
    // Payments up to ₦10,000,000 are allowed (no maximum limit for payments)
    // Only check for sufficient balance
    const currentBalance = await getWalletBalance(userEmail);
    
    if (currentBalance < validatedAmount) {
      throw new Error('Insufficient balance');
    }
    
    // Ensure integer arithmetic for large amounts
    const newBalance = Math.floor(currentBalance - validatedAmount);
    await updateWalletBalance(userEmail, newBalance);
    
    // Add transaction
    await addTransaction(userEmail, {
      type: 'payment',
      amount: amount,
      description: description,
      status: 'completed',
    });
    
    return newBalance;
  } catch (error) {
    console.error('Error making payment:', error);
    throw error;
  }
};

/**
 * Withdraw funds from wallet for a specific user
 * @param {string} userEmail - User's email address
 * @param {number} amount - Amount to withdraw
 * @param {string} method - Withdrawal method (e.g., 'Bank Transfer', 'Mobile Money')
 * @param {string} accountDetails - Account details for withdrawal
 */
export const withdrawFunds = async (userEmail, amount, method = 'Bank Transfer', accountDetails = '') => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    
    // VALIDATION: Ensure amount is valid integer (wallet uses whole naira amounts)
    // Use Math.floor to ensure integer values and avoid floating point precision issues with large amounts
    const validatedAmount = Math.floor(parseFloat(amount));
    if (isNaN(validatedAmount) || validatedAmount <= 0) {
      throw new Error(`Invalid withdrawal amount: ${amount}. Amount must be a positive number.`);
    }
    
    const currentBalance = await getWalletBalance(userEmail);
    
    if (currentBalance < validatedAmount) {
      throw new Error('Insufficient balance');
    }
    
    // Ensure integer arithmetic for large amounts
    const newBalance = Math.floor(currentBalance - validatedAmount);
    await updateWalletBalance(userEmail, newBalance);
    
    // Add transaction
    await addTransaction(userEmail, {
      type: 'withdrawal',
      amount: amount,
      description: `Withdrawal via ${method}${accountDetails ? ` - ${accountDetails}` : ''}`,
      status: 'pending', // Withdrawals are typically pending until processed
      method: method,
      accountDetails: accountDetails,
    });
    
    return newBalance;
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    throw error;
  }
};

/**
 * Send money from one user's wallet to another user's wallet
 * This is the ONLY way money should appear in another user's wallet
 * @param {string} fromUserEmail - Sender's email address
 * @param {string} toUserEmail - Recipient's email address
 * @param {number} amount - Amount to send
 * @param {string} description - Optional description for the transaction
 * @returns {Promise<{senderBalance: number, recipientBalance: number}>}
 */
export const sendMoneyToUser = async (fromUserEmail, toUserEmail, amount, description = '') => {
  try {
    if (!fromUserEmail || !toUserEmail) {
      throw new Error('Both sender and recipient emails are required');
    }
    
    if (fromUserEmail.toLowerCase().trim() === toUserEmail.toLowerCase().trim()) {
      throw new Error('Cannot send money to yourself');
    }
    
    // VALIDATION: Ensure amount is valid integer (wallet uses whole naira amounts)
    // Use Math.floor to ensure integer values and avoid floating point precision issues with large amounts
    const validatedAmount = Math.floor(parseFloat(amount));
    if (isNaN(validatedAmount) || validatedAmount <= 0) {
      throw new Error(`Invalid transfer amount: ${amount}. Amount must be a positive number.`);
    }
    
    // Get sender's current balance
    const senderBalance = await getWalletBalance(fromUserEmail);
    
    if (senderBalance < validatedAmount) {
      throw new Error('Insufficient balance');
    }
    
    // Deduct from sender - ensure integer arithmetic for large amounts
    const newSenderBalance = Math.floor(senderBalance - validatedAmount);
    await updateWalletBalance(fromUserEmail, newSenderBalance);
    
    // Add to recipient - ensure integer arithmetic for large amounts
    const recipientBalance = await getWalletBalance(toUserEmail);
    const newRecipientBalance = Math.floor(recipientBalance + validatedAmount);
    
    // Additional validation: Check if recipient balance would exceed maximum
    if (newRecipientBalance > MAX_WALLET_BALANCE) {
      throw new Error(`Recipient balance would exceed maximum limit of ₦${MAX_WALLET_BALANCE.toLocaleString()}`);
    }
    
    await updateWalletBalance(toUserEmail, newRecipientBalance);
    
    // Get sender's name for recipient's transaction
    let senderName = null;
    try {
      const { getUserProfile } = await import('./userStorage');
      const senderProfile = await getUserProfile(fromUserEmail);
      if (senderProfile && senderProfile.name) {
        senderName = senderProfile.name;
      }
    } catch (profileError) {
      console.log('Could not load sender profile for transaction:', profileError);
    }
    
    // Add transaction for sender (outgoing)
    await addTransaction(fromUserEmail, {
      type: 'transfer_out',
      amount: validatedAmount,
      description: description || `Money sent to ${toUserEmail}`,
      status: 'completed',
      recipientEmail: toUserEmail,
      userEmail: fromUserEmail, // Ensure transaction is user-specific
    });
    
    // Add transaction for recipient (incoming) with sender name
    await addTransaction(toUserEmail, {
      type: 'transfer_in',
      amount: validatedAmount,
      description: senderName 
        ? `Money received from ${senderName}`
        : description || `Money received from ${fromUserEmail}`,
      status: 'completed',
      senderEmail: fromUserEmail,
      senderName: senderName, // Include sender name so recipient can see who sent it
      userEmail: toUserEmail, // Ensure transaction is user-specific
    });
    
    console.log(`✅ Money transfer completed: ${fromUserEmail} → ${toUserEmail}, Amount: ₦${validatedAmount.toLocaleString()}, Sender name: ${senderName || 'N/A'}`);
    
    return {
      senderBalance: newSenderBalance,
      recipientBalance: newRecipientBalance,
    };
  } catch (error) {
    console.error('Error sending money to user:', error);
    throw error;
  }
};

