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
    
    let response;
    let retryCount = 0;
    const maxRetries = 2;
    
    // Retry logic for network errors or temporary backend issues
    while (retryCount <= maxRetries) {
      try {
        response = await api.post(API_ENDPOINTS.PAYMENTS.CREATE_VIRTUAL_ACCOUNT, {
          email,
          amount,
          name,
          tx_ref: txRef,
        });
        
        // If we got a response, break out of retry loop
        if (response !== null && response !== undefined) {
          break;
        }
        
        // If response is null and we haven't exceeded retries, try again
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`⚠️ Null response, retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          continue;
        }
      } catch (apiError) {
        // Check if it's a retryable error (network error, 500, etc.)
        const isRetryable = apiError.isNetworkError || 
                          apiError.status === 0 || 
                          apiError.status === 500 ||
                          (apiError.message && (
                            apiError.message.includes('network') ||
                            apiError.message.includes('timeout') ||
                            apiError.message.includes('fetch')
                          ));
        
        if (isRetryable && retryCount < maxRetries) {
          retryCount++;
          console.log(`⚠️ API error (retryable), retrying (${retryCount}/${maxRetries}):`, apiError.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        // If not retryable or max retries reached, throw
        throw apiError;
      }
    }

    console.log('✅ Flutterwave API response received:', response);
    console.log('✅ Response type:', typeof response);
    console.log('✅ Response.data:', response?.data);
    console.log('✅ Response keys:', response ? Object.keys(response) : 'N/A');

    if (response === null || response === undefined) {
      console.error('❌ No response from server after retries - possible causes: Backend not running, network error, or authentication failed');
      throw new Error('Failed to create virtual account: Backend not responding. Please ensure you are logged in and the backend is running.');
    }

    // Handle different response structures
    // The api.post() function returns the parsed JSON data directly
    // So response should already be the data object
    let data = response;
    
    // Check if response is wrapped in a data property (shouldn't happen with our api.js, but be defensive)
    if (response && typeof response === 'object' && response.data !== undefined && !response.account_number && !response.accountNumber) {
      data = response.data;
      console.log('✅ Using response.data (wrapped response)');
    } else if (response && typeof response === 'object' && response.response?.data !== undefined) {
      data = response.response.data;
      console.log('✅ Using response.response.data (nested response)');
    } else {
      console.log('✅ Using response directly (expected behavior)');
    }
    
    console.log('✅ Parsed data:', JSON.stringify(data, null, 2));
    console.log('✅ Data type:', typeof data);
    console.log('✅ Data keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
    console.log('✅ Has account_number:', !!(data?.account_number));
    console.log('✅ Has accountNumber:', !!(data?.accountNumber));
    
    if (!data || typeof data !== 'object') {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    // Check for error in response first
    if (data.error || (data.message && !data.account_number)) {
      const errorMsg = data.error || data.message || 'Unknown error from server';
      console.error('❌ Server returned error:', errorMsg);
      console.error('Full response:', JSON.stringify(data, null, 2));
      throw new Error(`Flutterwave virtual account creation failed: ${errorMsg}`);
    }
    
    // Check for account_number in both snake_case and camelCase
    const accountNumber = data.account_number || data.accountNumber;
    if (!accountNumber) {
      console.error('❌ Account number missing in response:', JSON.stringify(data, null, 2));
      const errorMsg = data.error || data.message || 'Account number not found in response';
      throw new Error(`Failed to create virtual account: ${errorMsg}`);
    }

    // Prepare response immediately for fast UI update
    // Handle both snake_case and camelCase response formats
    const accountData = {
      accountNumber: accountNumber,
      accountName: data.account_name || data.accountName || 'Nigerian Apartments Leasing Ltd',
      bankName: data.bank_name || data.bankName || 'Virtual Bank',
      txRef: data.tx_ref || data.txRef || txRef,
    };

    console.log('✅ Virtual account created successfully:', accountData);
    console.log('✅ Account Number:', accountData.accountNumber);
    console.log('✅ Bank Name:', accountData.bankName);
    console.log('✅ Account Name:', accountData.accountName);
    console.log('✅ Returning account data immediately for UI update');

    return accountData;
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

/**
 * Initialize Flutterwave card payment
 * @param {number} amount - Payment amount in NGN
 * @param {string} email - Customer email
 * @param {string} name - Customer full name
 * @param {string} phone - Customer phone number (optional)
 * @param {string} paymentMethod - Payment method ('card', 'ussd', 'banktransfer', 'all')
 * @param {string} txRef - Unique transaction reference (optional)
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Payment initialization response
 */
export const initializePayment = async (amount, email, name, phone = null, paymentMethod = 'card', txRef = null, metadata = {}) => {
  try {
    console.log('🔄 Initializing Flutterwave payment:', { amount, email, name, paymentMethod });
    
    const response = await api.post(API_ENDPOINTS.PAYMENTS.INITIALIZE_PAYMENT, {
      amount,
      email,
      name,
      phone,
      payment_method: paymentMethod,
      tx_ref: txRef,
      metadata,
    });

    if (response === null || response === undefined) {
      throw new Error('Failed to initialize payment: Backend not responding. Please ensure you are logged in and the backend is running.');
    }

    let data = response;
    if (response && typeof response === 'object' && response.data !== undefined) {
      data = response.data;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from server');
    }

    if (data.error || (data.message && !data.status)) {
      const errorMsg = data.error || data.message || 'Unknown error from server';
      throw new Error(`Payment initialization failed: ${errorMsg}`);
    }

    console.log('✅ Payment initialized successfully');
    return data;
  } catch (error) {
    console.error('❌ Error initializing payment:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    if (error.response?.data?.error) {
      throw new Error(`Flutterwave error: ${error.response.data.error}`);
    }
    if (error.response?.data?.message) {
      throw new Error(`Flutterwave error: ${error.response.data.message}`);
    }
    
    throw new Error('Failed to initialize payment. Please check your connection and try again.');
  }
};

/**
 * Verify Flutterwave payment
 * @param {string} reference - Payment transaction reference
 * @returns {Promise<Object>} Payment verification response
 */
export const verifyPayment = async (reference) => {
  try {
    console.log('🔄 Verifying Flutterwave payment:', { reference });
    
    let response;
    let retryCount = 0;
    const maxRetries = 2;
    
    // Retry logic for network errors or temporary backend issues
    while (retryCount <= maxRetries) {
      try {
        response = await api.post(API_ENDPOINTS.PAYMENTS.VERIFY_PAYMENT, {
          reference,
        });
        
        // If we got a response, break out of retry loop
        if (response !== null && response !== undefined) {
          break;
        }
        
        // If response is null and we haven't exceeded retries, try again
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`⚠️ Null response, retrying verification (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
      } catch (apiError) {
        // Check if it's a retryable error
        const isRetryable = apiError.isNetworkError || 
                          apiError.status === 0 || 
                          apiError.status === 500 ||
                          (apiError.message && (
                            apiError.message.includes('network') ||
                            apiError.message.includes('timeout') ||
                            apiError.message.includes('fetch')
                          ));
        
        if (isRetryable && retryCount < maxRetries) {
          retryCount++;
          console.log(`⚠️ API error (retryable), retrying verification (${retryCount}/${maxRetries}):`, apiError.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        // If not retryable or max retries reached, throw
        throw apiError;
      }
    }

    if (response === null || response === undefined) {
      throw new Error('Failed to verify payment: Backend not responding after retries. Please ensure you are logged in and the backend is running.');
    }

    let data = response;
    if (response && typeof response === 'object' && response.data !== undefined) {
      data = response.data;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from server');
    }

    if (data.error || (data.message && !data.status)) {
      const errorMsg = data.error || data.message || 'Unknown error from server';
      throw new Error(`Payment verification failed: ${errorMsg}`);
    }

    console.log('✅ Payment verified successfully');
    return data;
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    if (error.response?.data?.error) {
      throw new Error(`Flutterwave error: ${error.response.data.error}`);
    }
    if (error.response?.data?.message) {
      throw new Error(`Flutterwave error: ${error.response.data.message}`);
    }
    
    throw new Error('Failed to verify payment. Please check your connection and try again.');
  }
};

/**
 * Verify payment and automatically fund wallet if verification succeeds
 * @param {string} reference - Payment transaction reference
 * @param {string} userEmail - User's email address
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method ('card' or 'bank_transfer')
 * @returns {Promise<Object>} Verification and funding result with updated balance
 */
export const verifyAndFundWallet = async (reference, userEmail, amount, paymentMethod = 'card') => {
  try {
    console.log('🔄 Verifying and funding wallet:', { reference, userEmail, amount, paymentMethod });
    
    if (!reference || !userEmail || !amount || amount <= 0) {
      throw new Error('Invalid parameters: reference, userEmail, and amount are required');
    }
    
    // Step 1: Verify payment with Flutterwave (with retry logic)
    let verificationResult;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 Verification attempt ${retryCount + 1}/${maxRetries}...`);
        verificationResult = await verifyPayment(reference);
        
        // Check payment status from various possible response formats
        const status = verificationResult?.status || 
                      verificationResult?.data?.status || 
                      verificationResult?.payment_status ||
                      verificationResult?.data?.payment_status ||
                      verificationResult?.data?.data?.status;
        
        const isSuccessful = status === 'successful' || 
                            status === 'completed' || 
                            status === 'success' ||
                            status === 'completed';
        
        if (isSuccessful) {
          console.log('✅ Payment verified as successful:', status);
          break;
        } else if (status === 'pending' || status === 'processing' || status === 'pending-validation') {
          console.log(`⏳ Payment is ${status}, will retry...`);
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = baseDelay * retryCount; // Exponential backoff: 2s, 4s, 6s
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            throw new Error(`Payment is still ${status} after ${maxRetries} verification attempts. Please wait a few minutes and check your wallet.`);
          }
        } else if (status === 'failed' || status === 'cancelled') {
          throw new Error(`Payment ${status}. Please try again or contact support.`);
        } else {
          // Unknown status - log but continue
          console.warn(`⚠️ Unknown payment status: ${status}, assuming successful`);
          break;
        }
      } catch (verifyError) {
        retryCount++;
        const isLastAttempt = retryCount >= maxRetries;
        
        // Check if error is retryable
        const isRetryable = verifyError.message && (
          verifyError.message.includes('not found') ||
          verifyError.message.includes('pending') ||
          verifyError.message.includes('processing') ||
          verifyError.message.includes('timeout') ||
          verifyError.message.includes('network')
        );
        
        if (isLastAttempt || !isRetryable) {
          console.error('❌ Payment verification failed:', verifyError);
          throw new Error(`Payment verification failed: ${verifyError.message || 'Unknown error'}`);
        }
        
        console.log(`⚠️ Verification attempt ${retryCount} failed (retryable), retrying...`);
        const delay = baseDelay * retryCount;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!verificationResult) {
      throw new Error('Payment verification failed: No result after retries');
    }
    
    // Step 2: Fund wallet if verification succeeded (with retry logic)
    console.log('💰 Funding wallet after successful verification...');
    const { hybridWalletService } = await import('../services/hybridService');
    const { addFunds, getWalletBalance } = await import('../utils/wallet');
    
    const methodLabel = paymentMethod === 'bank_transfer' ? 'Flutterwave Bank Transfer' : 'Flutterwave Card';
    
    let fundingResult;
    let fundingRetryCount = 0;
    const maxFundingRetries = 5;
    let fundingSuccess = false;
    
    while (fundingRetryCount < maxFundingRetries && !fundingSuccess) {
      try {
        console.log(`💰 Funding attempt ${fundingRetryCount + 1}/${maxFundingRetries}...`);
        
        // Try API funding first
        try {
          fundingResult = await hybridWalletService.fundWallet(
            userEmail,
            amount,
            methodLabel,
            null,
            null,
            reference
          );
          
          // Check if funding was successful
          if (fundingResult && (fundingResult.balance !== undefined || fundingResult.amount !== undefined)) {
            console.log('✅ Wallet funded successfully via API:', fundingResult);
            fundingSuccess = true;
            break;
          }
        } catch (apiError) {
          console.warn(`⚠️ API funding attempt ${fundingRetryCount + 1} failed:`, apiError.message);
          
          // If API fails, try local funding as fallback
          if (apiError.message && (apiError.message.includes('401') || apiError.message.includes('null') || apiError.message.includes('failed'))) {
            console.log('🔄 API funding failed, trying local wallet funding as fallback...');
            try {
              // Fund wallet locally as backup
              const currentBalance = await getWalletBalance(userEmail);
              const newBalance = currentBalance + Math.floor(parseFloat(amount));
              
              await addFunds(userEmail, amount, {
                type: 'top_up',
                method: methodLabel,
                reference: reference,
                status: 'completed',
                description: `Wallet top-up via ${methodLabel}`,
              });
              
              console.log(`✅ Wallet funded locally: ${userEmail}, Amount: ₦${amount.toLocaleString()}, New balance: ₦${newBalance.toLocaleString()}`);
              fundingResult = { balance: newBalance, amount: newBalance };
              fundingSuccess = true;
              break;
            } catch (localError) {
              console.error('❌ Local wallet funding also failed:', localError);
              // Continue to retry API
            }
          }
          
          // If not a retryable error, throw
          if (!apiError.message || (!apiError.message.includes('401') && !apiError.message.includes('null'))) {
            throw apiError;
          }
        }
        
        // If we get here, funding didn't succeed
        if (!fundingSuccess) {
          throw new Error('Funding returned invalid result or failed');
        }
      } catch (fundError) {
        fundingRetryCount++;
        const isLastFundingAttempt = fundingRetryCount >= maxFundingRetries;
        
        if (isLastFundingAttempt) {
          console.error('❌ Error funding wallet after verification (max retries reached):', fundError);
          
          // Last resort: Try local funding
          try {
            console.log('🔄 Attempting local wallet funding as last resort...');
            const currentBalance = await getWalletBalance(userEmail);
            const newBalance = currentBalance + Math.floor(parseFloat(amount));
            
            await addFunds(userEmail, amount, {
              type: 'top_up',
              method: methodLabel,
              reference: reference,
              status: 'completed',
              description: `Wallet top-up via ${methodLabel} (fallback)`,
            });
            
            console.log(`✅ Wallet funded locally (fallback): ${userEmail}, Amount: ₦${amount.toLocaleString()}, New balance: ₦${newBalance.toLocaleString()}`);
            fundingResult = { balance: newBalance, amount: newBalance };
            fundingSuccess = true;
          } catch (localError) {
            console.error('❌ Local wallet funding failed:', localError);
            console.warn('⚠️ Payment verified but wallet funding failed. Backend webhook should process funding.');
          }
          
          break;
        }
        
        console.log(`⚠️ Funding attempt ${fundingRetryCount} failed, retrying...`);
        const delay = 1000 * fundingRetryCount; // 1s, 2s, 3s, 4s, 5s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Send wallet top-up confirmation email if funding succeeded
    if (fundingSuccess && fundingResult) {
      try {
        const { sendWalletTopUpEmail } = await import('../utils/emailService');
        const newBalance = fundingResult.balance || fundingResult.amount || await getWalletBalance(userEmail);
        
        // Get user name for email
        let userName = 'Valued Customer';
        try {
          const { getUserProfile } = await import('../utils/userStorage');
          const userProfile = await getUserProfile(userEmail);
          if (userProfile?.name) {
            userName = userProfile.name;
          }
        } catch (profileError) {
          console.log('Could not get user profile for email:', profileError);
        }
        
        await sendWalletTopUpEmail(
          userEmail,
          amount,
          methodLabel,
          reference,
          newBalance,
          userName
        );
        console.log('✅ Wallet top-up confirmation email sent to:', userEmail);
      } catch (emailError) {
        console.error('⚠️ Error sending wallet top-up email (non-fatal):', emailError);
        // Don't block the flow if email fails
      }
    }
    
    // Step 3: Verify pending transactions and sync balance
    try {
      const { walletService } = await import('./walletService');
      
      // First, verify any pending transactions (this processes them)
      console.log('🔄 Verifying pending transactions...');
      try {
        await walletService.verifyPendingTransactions();
      } catch (verifyPendingError) {
        console.warn('⚠️ Pending transactions verification failed (non-fatal):', verifyPendingError.message);
      }
      
      // Then sync balance to ensure latest state
      await walletService.syncBalance();
    } catch (syncError) {
      console.warn('⚠️ Balance sync failed (non-fatal):', syncError.message);
    }
    
    // Get updated balance - prioritize funding result, then API, then local
    let updatedBalance = fundingResult?.balance || fundingResult?.amount;
    if (!updatedBalance || isNaN(parseFloat(updatedBalance))) {
      try {
        // Try API first
        updatedBalance = await hybridWalletService.getBalance(userEmail);
        if (!updatedBalance || isNaN(parseFloat(updatedBalance))) {
          // Fallback to local balance
          const { getWalletBalance } = await import('../utils/wallet');
          updatedBalance = await getWalletBalance(userEmail);
        }
      } catch (balanceError) {
        console.warn('⚠️ Could not get updated balance from API, trying local:', balanceError.message);
        try {
          const { getWalletBalance } = await import('../utils/wallet');
          updatedBalance = await getWalletBalance(userEmail);
        } catch (localBalanceError) {
          console.warn('⚠️ Could not get updated balance:', localBalanceError.message);
          updatedBalance = null;
        }
      }
    }
    
    console.log(`✅ Final wallet balance after funding: ₦${updatedBalance ? updatedBalance.toLocaleString() : 'N/A'}`);
    
    return {
      verified: true,
      funded: fundingSuccess && !!fundingResult,
      balance: updatedBalance,
      verificationResult,
      fundingResult,
    };
  } catch (error) {
    console.error('❌ Error in verifyAndFundWallet:', error);
    // Provide user-friendly error message
    const errorMessage = error.message || 'Unknown error occurred';
    throw new Error(errorMessage);
  }
};

export default {
  createVirtualAccount,
  initializePayment,
  verifyPayment,
  verifyAndFundWallet,
};
