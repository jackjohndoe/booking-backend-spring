// Wallet Service
import api from './api';
import { API_ENDPOINTS } from '../config/api';

export const walletService = {
  // Get wallet balance
  getBalance: async () => {
    try {
      console.log('🔄 Fetching wallet balance from backend...');
      const response = await api.get(API_ENDPOINTS.WALLET.BALANCE);
      
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        console.warn('⚠️ Wallet balance API returned null - may indicate authentication or backend issues');
        return null;
      }
      
      // Log response for debugging
      console.log('📦 Balance response type:', typeof response);
      console.log('📦 Balance response:', response);
      console.log('📦 Balance response keys:', response && typeof response === 'object' ? Object.keys(response) : 'N/A');
      
      // Handle different response formats
      let balance = null;
      if (typeof response === 'number') {
        balance = response;
        console.log(`✅ Balance (number): ₦${balance.toLocaleString()}`);
      } else if (response && typeof response === 'object') {
        balance = response.balance !== undefined ? response.balance : 
                  response.amount !== undefined ? response.amount : 
                  response.value !== undefined ? response.value : 
                  response.data !== undefined ? response.data : null;
        console.log(`✅ Balance (object): ₦${balance !== null ? balance.toLocaleString() : 'null'}`);
      } else if (typeof response === 'string') {
        balance = parseFloat(response);
        console.log(`✅ Balance (string): ₦${balance.toLocaleString()}`);
      }
      
      return balance !== null ? balance : (response.data || response);
    } catch (error) {
      // Log error but don't throw - allow graceful fallback
      console.error('❌ Wallet balance API error:', {
        message: error.message,
        status: error.status,
        isNetworkError: error.isNetworkError,
        endpoint: API_ENDPOINTS.WALLET.BALANCE
      });
      if (error.status !== 401 && error.status !== 403) {
        console.warn('⚠️ Wallet balance API error (non-fatal):', error.message || 'Unknown error');
      }
      return null;
    }
  },

  // Fund wallet
  fundWallet: async (amount, paymentMethod = 'bank_transfer', reference = null) => {
    try {
      console.log(`💰 Calling wallet fund API: Amount: ₦${amount}, Method: ${paymentMethod}, Reference: ${reference || 'N/A'}`);
      
      const response = await api.post(API_ENDPOINTS.WALLET.FUND, {
        amount,
        description: paymentMethod,
        reference: reference || null,
      });
      
      // If response is null (403, 401, etc.), log and return null for hybrid service to handle
      if (response === null || response === undefined) {
        console.warn('⚠️ Wallet fund API returned null - this may indicate authentication or backend issues');
        return null;
      }
      
      console.log('✅ Wallet fund API response:', response);
      return response.data || response;
    } catch (error) {
      // Log error details for debugging
      console.error('❌ Wallet fund API error:', {
        message: error.message,
        status: error.status,
        isNetworkError: error.isNetworkError,
        endpoint: API_ENDPOINTS.WALLET.FUND
      });
      
      // Return null instead of throwing to allow graceful fallback
      // The hybrid service will handle local funding as fallback
      return null;
    }
  },

  // Get transactions
  getTransactions: async () => {
    try {
      console.log('🔄 Fetching transactions from backend API...');
      const response = await api.get(API_ENDPOINTS.WALLET.TRANSACTIONS);
      
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        console.warn('⚠️ Backend transactions API returned null');
        return null;
      }
      
      // Log the response structure for debugging
      console.log('📦 Backend transactions response type:', typeof response);
      console.log('📦 Backend transactions response keys:', response && typeof response === 'object' ? Object.keys(response) : 'N/A');
      
      // Handle different response formats
      let transactions = null;
      if (Array.isArray(response)) {
        transactions = response;
        console.log(`✅ Backend returned array with ${transactions.length} transactions`);
      } else if (response && typeof response === 'object') {
        transactions = response.data || response.transactions || response.items || [];
        console.log(`✅ Backend returned object, extracted ${transactions.length} transactions`);
      } else {
        console.warn('⚠️ Unexpected response format from backend:', response);
        return null;
      }
      
      // Log transaction details for debugging
      if (transactions && transactions.length > 0) {
        console.log('📋 Sample transaction:', JSON.stringify(transactions[0], null, 2));
        console.log(`📋 Transaction types: ${transactions.map(t => t.type || 'unknown').join(', ')}`);
        console.log(`📋 Transaction references: ${transactions.slice(0, 3).map(t => t.reference || t.flutterwaveTxRef || t.id || 'N/A').join(', ')}`);
      } else {
        console.warn('⚠️ Backend returned empty transactions array');
      }
      
      return transactions;
    } catch (error) {
      console.error('❌ Error getting transactions from backend:', {
        message: error.message,
        status: error.status,
        isNetworkError: error.isNetworkError,
        endpoint: API_ENDPOINTS.WALLET.TRANSACTIONS
      });
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Make payment from wallet
  makePayment: async (amount, description, bookingId = null) => {
    try {
      const response = await api.post(API_ENDPOINTS.WALLET.PAY, {
        amount,
        description,
        bookingId,
      });
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Withdraw funds from wallet
  withdrawFunds: async (amount, method = 'Bank Transfer', accountDetails = '', accountBank = null, accountNumber = null, beneficiaryName = null) => {
    try {
      const response = await api.post(API_ENDPOINTS.WALLET.WITHDRAW, {
        amount,
        method,
        accountDetails,
        accountBank,
        accountNumber,
        beneficiaryName,
        description: `Withdrawal via ${method}`,
      });
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      return null;
    }
  },

  // Sync wallet balance with Flutterwave
  syncBalance: async () => {
    try {
      const response = await api.post(API_ENDPOINTS.WALLET.SYNC);
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      // Don't throw error - sync failures shouldn't block wallet operations
      // Log error but return null so calling code can continue
      if (error.status === 500) {
        console.warn('⚠️ Wallet sync endpoint returned 500 - backend may be processing. Continuing without sync.');
      } else {
        console.warn('⚠️ Wallet sync failed (non-fatal):', error.message || 'Unknown error');
      }
      return null;
    }
  },

  // Verify and process a specific transaction
  verifyTransaction: async (txRef) => {
    try {
      const response = await api.post(API_ENDPOINTS.WALLET.VERIFY_TRANSACTION, { txRef });
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      console.error('Error verifying transaction:', error);
      throw error;
    }
  },

  // Sync all transactions from Flutterwave
  syncAllTransactions: async () => {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Syncing all transactions (attempt ${attempt}/${maxRetries})...`);
        const response = await api.post(API_ENDPOINTS.WALLET.SYNC_ALL);
        if (response === null || response === undefined) {
          if (attempt < maxRetries) {
            console.warn(`⚠️ Sync returned null, retrying... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          return null;
        }
        console.log('✅ Sync all transactions completed successfully');
        return response.data || response;
      } catch (error) {
        lastError = error;
        console.error(`❌ Error syncing all transactions (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Retry on network errors or 500 errors
        if (attempt < maxRetries && (error.isNetworkError || error.status === 500)) {
          const delay = 1000 * attempt; // 1s, 2s, 3s
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Don't retry on auth errors
        if (error.status === 401 || error.status === 403) {
          throw error;
        }
      }
    }
    
    // If all retries failed, throw the last error
    console.error('❌ All sync attempts failed');
    throw lastError || new Error('Failed to sync all transactions after retries');
  },

  // Verify and process multiple transactions
  verifyMultipleTransactions: async (txRefs) => {
    try {
      const response = await api.post(API_ENDPOINTS.WALLET.VERIFY_TRANSACTIONS, { txRefs });
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      console.error('Error verifying multiple transactions:', error);
      throw error;
    }
  },

  // Verify all pending transactions for the current user
  verifyPendingTransactions: async () => {
    try {
      console.log('🔄 Verifying all pending transactions...');
      // Call sync-all which verifies pending transactions
      const response = await api.post(API_ENDPOINTS.WALLET.SYNC_ALL);
      if (response === null || response === undefined) {
        console.warn('⚠️ Verify pending transactions returned null');
        return null;
      }
      console.log('✅ Pending transactions verification completed');
      return response.data || response;
    } catch (error) {
      console.error('Error verifying pending transactions:', error);
      // Don't throw - this is a background operation
      return null;
    }
  },
};

