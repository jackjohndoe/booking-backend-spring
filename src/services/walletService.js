// Wallet Service
import api from './api';

export const walletService = {
  // Get wallet balance
  getBalance: async () => {
    try {
      const response = await api.get('/api/wallet/balance');
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

  // Fund wallet
  fundWallet: async (amount, paymentMethod = 'bank_transfer') => {
    try {
      const response = await api.post('/api/wallet/fund', {
        amount,
        paymentMethod,
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

  // Get transactions
  getTransactions: async () => {
    try {
      const response = await api.get('/api/wallet/transactions');
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

  // Make payment from wallet
  makePayment: async (amount, description, bookingId = null) => {
    try {
      const response = await api.post('/api/wallet/pay', {
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
};

