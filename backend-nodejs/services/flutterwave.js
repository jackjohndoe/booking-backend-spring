const axios = require('axios');

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLUTTERWAVE_CLIENT_SECRET;
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || process.env.FLUTTERWAVE_CLIENT_ID;
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

// Validate Flutterwave keys on startup
if (!FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY.trim() === '') {
  console.warn('⚠️  FLUTTERWAVE_SECRET_KEY is not set. Flutterwave payments will not work.');
}

const flutterwaveApi = axios.create({
  baseURL: FLUTTERWAVE_BASE_URL,
  headers: {
    Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY || ''}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Add response interceptor to handle errors better
flutterwaveApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging
    if (error.response) {
      console.error('Flutterwave API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('Flutterwave API Request Error:', {
        message: 'No response received from Flutterwave',
        request: error.request
      });
    } else {
      console.error('Flutterwave API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Initialize Flutterwave payment
 * For bank transfers, creates a virtual account
 */
const initializePayment = async (paymentData) => {
  try {
    if (!FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY.trim() === '') {
      throw new Error('Flutterwave secret key is not configured. Please set FLUTTERWAVE_SECRET_KEY in environment variables.');
    }

    const { tx_ref, amount, currency, payment_options, customer, redirect_url, customizations, meta } = paymentData;

    // For bank transfers, create virtual account
    if (payment_options === 'banktransfer' || payment_options === 'bank_transfer') {
      return await createVirtualAccount({
        email: customer.email,
        firstname: customer.name.split(' ')[0] || customer.name,
        lastname: customer.name.split(' ').slice(1).join(' ') || customer.name.split(' ')[0] || 'Customer',
        phonenumber: customer.phone_number || '',
        tx_ref: tx_ref,
        amount: amount,
        currency: currency || 'NGN',
      });
    }

    // For other payment methods, use standard payment initialization
    const response = await flutterwaveApi.post('/payments', {
      tx_ref,
      amount,
      currency: currency || 'NGN',
      redirect_url: redirect_url || process.env.FLUTTERWAVE_CALLBACK_URL,
      payment_options: payment_options || 'card',
      customer: {
        email: customer.email,
        name: customer.name,
        ...(customer.phone_number && { phone_number: customer.phone_number }),
      },
      customizations: customizations || {
        title: 'Nigerian Apartments',
        description: 'Payment',
      },
      ...(meta && { meta }),
    });

    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to initialize payment');
    }

    return {
      status: 'success',
      message: response.data.message,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Flutterwave payment initialization error:', error);
    if (error.response?.data) {
      throw new Error(error.response.data.message || 'Flutterwave API error');
    }
    throw error;
  }
};

/**
 * Create Flutterwave virtual account for bank transfers
 * Returns a real Nigerian bank account number
 */
const createVirtualAccount = async (customerData) => {
  try {
    const { email, firstname, lastname, phonenumber, tx_ref, amount, currency } = customerData;

    // Create virtual account
    const response = await flutterwaveApi.post('/virtual-account-numbers', {
      email,
      is_permanent: false, // Temporary account for this transaction
      firstname,
      lastname,
      phonenumber: phonenumber || '',
      tx_ref,
      amount: amount,
      currency: currency || 'NGN',
    });

    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Failed to create virtual account');
    }

    const virtualAccount = response.data.data;

    // Return response in format expected by frontend
    return {
      status: 'success',
      message: 'Virtual account created successfully',
      data: {
        account_number: virtualAccount.account_number,
        bank_name: virtualAccount.bank_name,
        account_name: virtualAccount.account_name || `${firstname} ${lastname}`,
        expires_at: virtualAccount.expires_at,
        flw_ref: virtualAccount.flw_ref,
      },
      reference: tx_ref,
      // Also include at top level for easier access
      account_number: virtualAccount.account_number,
      bank: virtualAccount.bank_name,
      account_name: virtualAccount.account_name || `${firstname} ${lastname}`,
    };
  } catch (error) {
    console.error('Flutterwave virtual account creation error:', error);
    if (error.response?.data) {
      const errorMessage = error.response.data.message || 'Failed to create virtual account';
      throw new Error(errorMessage);
    }
    throw error;
  }
};

/**
 * Verify Flutterwave payment
 */
const verifyPayment = async (reference) => {
  try {
    if (!FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY.trim() === '') {
      throw new Error('Flutterwave secret key is not configured');
    }

    const response = await flutterwaveApi.get(`/transactions/${reference}/verify`);

    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'Payment verification failed');
    }

    const transaction = response.data.data;

    return {
      status: transaction.status === 'successful' ? 'success' : transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      transaction_id: transaction.id,
      customer: transaction.customer,
      created_at: transaction.created_at,
      paid_at: transaction.paid_at,
      message: response.data.message || 'Payment verified successfully',
    };
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    if (error.response?.data) {
      throw new Error(error.response.data.message || 'Payment verification failed');
    }
    throw error;
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  createVirtualAccount,
};

