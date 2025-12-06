// Flutterwave Service
import api from './api';
import { API_ENDPOINTS } from '../config/api';

/**
 * Create a Flutterwave virtual account for bank transfer payment
 * @param {string} email - Customer email
 * @param {number} amount - Payment amount in NGN
 * @param {string} name - Customer full name
 * @param {string} txRef - Unique transaction reference
 * @returns {Promise<Object>} Virtual account details
 */
export const createVirtualAccount = async (email, amount, name, txRef) => {
  try {
    console.log('🔄 Creating Flutterwave virtual account:', { email, amount, name, txRef });
    
    const response = await api.post(API_ENDPOINTS.PAYMENTS.CREATE_VIRTUAL_ACCOUNT, {
      email,
      amount,
      name,
      tx_ref: txRef,
    });

    console.log('✅ Flutterwave API response received:', response);

    if (response === null || response === undefined) {
      console.error('❌ No response from server - possible causes: Backend not running, network error, or authentication failed');
      throw new Error('Failed to create virtual account: Backend not responding. Please ensure you are logged in and the backend is running.');
    }

    const data = response.data || response;
    
    if (!data || typeof data !== 'object') {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    // Check for error in response first
    if (data.error || data.message) {
      const errorMsg = data.error || data.message || 'Unknown error from server';
      console.error('❌ Server returned error:', errorMsg);
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error(`Flutterwave virtual account creation failed: ${errorMsg}`);
    }
    
    if (!data.account_number) {
      console.error('❌ Account number missing in response:', JSON.stringify(data, null, 2));
      const errorMsg = data.error || data.message || 'Account number not found in response';
      throw new Error(`Failed to create virtual account: ${errorMsg}`);
    }

    console.log('✅ Virtual account created successfully:', {
      accountNumber: data.account_number,
      bankName: data.bank_name,
      accountName: data.account_name
    });

    return {
      accountNumber: data.account_number,
      accountName: data.account_name || 'Nigerian Apartments Leasing Ltd',
      bankName: data.bank_name || 'Virtual Bank',
      txRef: data.tx_ref || txRef,
    };
  } catch (error) {
    console.error('❌ Error creating Flutterwave virtual account:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response,
      stack: error.stack
    });
    
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      // If error message is empty or generic, try to extract from response
      if ((!error.message || error.message.includes('Flutterwave virtual account creation failed:')) && error.response?.data) {
        const errorData = error.response.data;
        const errorMsg = errorData.error || errorData.message || errorData.toString() || 'Unknown server error';
        console.error('📋 Extracted error from response:', errorMsg);
        throw new Error(`Flutterwave virtual account creation failed: ${errorMsg}`);
      }
      throw error;
    }
    
    // Handle different error formats
    if (error.response?.data?.error) {
      throw new Error(`Flutterwave error: ${error.response.data.error}`);
    }
    if (error.response?.data?.message) {
      throw new Error(`Flutterwave error: ${error.response.data.message}`);
    }
    if (typeof error === 'string') {
      throw new Error(error);
    }
    
    throw new Error('Failed to create virtual account. Please check your connection and try again.');
  }
};

export default {
  createVirtualAccount,
};
