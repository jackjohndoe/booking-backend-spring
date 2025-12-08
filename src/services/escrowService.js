// Escrow.com Service
// All Escrow.com operations go through backend API for security
import { API_ENDPOINTS } from '../config/api';
import api from './api';

/**
 * Create an Escrow.com transaction
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Amount in naira
 * @param {string} buyerEmail - Buyer/Guest email
 * @param {string} sellerEmail - Seller/Host email
 * @param {string} paystackReference - Paystack payment reference
 * @param {object} conditions - Release conditions (e.g., { checkInDate, autoRelease: false })
 * @returns {Promise<object>} Escrow transaction response
 */
export const createEscrowTransaction = async (
  bookingId,
  amount,
  buyerEmail,
  sellerEmail,
  paystackReference,
  conditions = {}
) => {
  try {
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid escrow amount');
    }

    if (!buyerEmail) {
      throw new Error('Buyer email is required');
    }

    if (!sellerEmail) {
      throw new Error('Seller email is required');
    }

    if (!paystackReference) {
      throw new Error('Paystack reference is required');
    }

    console.log('Creating Escrow.com transaction via backend:', {
      bookingId,
      amount,
      buyerEmail,
      sellerEmail,
      paystackReference,
      conditions,
    });

    // Call backend API with retry logic
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await api.post(API_ENDPOINTS.ESCROW.CREATE, {
          bookingId,
          amount,
          buyerEmail,
          sellerEmail,
          paystackReference,
          conditions,
        });
        break; // Success, exit retry loop
      } catch (apiError) {
        lastError = apiError;
        
        // If it's an authentication error (401/403), don't retry - return null for graceful fallback
        if (apiError?.isAuthError || apiError?.status === 401 || apiError?.status === 403) {
          console.warn('⚠️ Authentication error creating escrow transaction - will use local escrow fallback');
          return null; // Return null to allow fallback to local escrow
        }
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          console.log(`Retrying Escrow.com transaction creation (attempt ${attempt + 1}/${maxRetries})...`);
        }
      }
    }

    if (!response) {
      const errorMessage = lastError?.message || 'Failed to create escrow transaction';
      
      // If it's an authentication error, return null for graceful fallback
      if (lastError?.isAuthError || lastError?.status === 401 || lastError?.status === 403) {
        console.warn('⚠️ Authentication error creating escrow transaction - will use local escrow fallback');
        return null;
      }
      
      if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (errorMessage.includes('500') || errorMessage.includes('server')) {
        throw new Error('Escrow service is temporarily unavailable. Please try again later.');
      }
      throw new Error(errorMessage || 'Failed to create escrow transaction. Please try again.');
    }

    return {
      escrowId: response.escrowId || response.id || response.data?.escrowId || response.data?.id,
      bookingId: response.bookingId || bookingId,
      status: response.status || response.data?.status || 'pending',
      amount: response.amount || amount,
      buyerEmail: response.buyerEmail || buyerEmail,
      sellerEmail: response.sellerEmail || sellerEmail,
      paystackReference: response.paystackReference || paystackReference,
      createdAt: response.createdAt || response.data?.createdAt || new Date().toISOString(),
      conditions: response.conditions || conditions,
    };
  } catch (error) {
    console.error('Error creating Escrow.com transaction:', error);
    
    // If it's an authentication error, return null for graceful fallback
    if (error?.isAuthError || error?.status === 401 || error?.status === 403) {
      console.warn('⚠️ Authentication error creating escrow transaction - will use local escrow fallback');
      return null;
    }
    
    // Re-throw with user-friendly message if not already formatted
    if (error.message && !error.message.includes('Please')) {
      throw new Error(`Escrow transaction creation failed: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Get Escrow.com transaction status
 * @param {string} escrowId - Escrow transaction ID
 * @returns {Promise<object>} Escrow transaction status
 */
export const getEscrowStatus = async (escrowId) => {
  try {
    if (!escrowId) {
      throw new Error('Escrow ID is required');
    }

    // Call backend API with retry logic
    let response;
    let lastError;
    const maxRetries = 2; // Fewer retries for status checks
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await api.get(API_ENDPOINTS.ESCROW.STATUS(escrowId));
        break;
      } catch (apiError) {
        lastError = apiError;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!response) {
      const errorMessage = lastError?.message || 'Failed to get escrow status';
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        throw new Error('Escrow transaction not found.');
      }
      throw new Error(errorMessage || 'Failed to get escrow status. Please try again.');
    }

    return {
      escrowId: response.escrowId || response.id || escrowId,
      status: response.status || response.data?.status || 'unknown',
      amount: response.amount || response.data?.amount,
      buyerEmail: response.buyerEmail || response.data?.buyerEmail,
      sellerEmail: response.sellerEmail || response.data?.sellerEmail,
      paystackReference: response.paystackReference || response.data?.paystackReference,
      createdAt: response.createdAt || response.data?.createdAt,
      paymentRequestedAt: response.paymentRequestedAt || response.data?.paymentRequestedAt,
      paymentReleasedAt: response.paymentReleasedAt || response.data?.paymentReleasedAt,
      conditions: response.conditions || response.data?.conditions,
    };
  } catch (error) {
    console.error('Error getting Escrow.com status:', error);
    throw error;
  }
};

/**
 * Release escrow funds to seller/host
 * @param {string} escrowId - Escrow transaction ID
 * @returns {Promise<object>} Release response
 */
export const releaseEscrowFunds = async (escrowId) => {
  try {
    if (!escrowId) {
      throw new Error('Escrow ID is required');
    }

    console.log('Releasing Escrow.com funds via backend:', escrowId);

    // Call backend API with retry logic
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await api.post(API_ENDPOINTS.ESCROW.RELEASE(escrowId), {});
        break;
      } catch (apiError) {
        lastError = apiError;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          console.log(`Retrying Escrow.com fund release (attempt ${attempt + 1}/${maxRetries})...`);
        }
      }
    }

    if (!response) {
      const errorMessage = lastError?.message || 'Failed to release escrow funds';
      if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (errorMessage.includes('400') || errorMessage.includes('invalid')) {
        throw new Error('Cannot release funds. Escrow transaction may not be in the correct state.');
      }
      throw new Error(errorMessage || 'Failed to release escrow funds. Please try again or contact support.');
    }

    return {
      escrowId: response.escrowId || escrowId,
      status: response.status || response.data?.status || 'released',
      releasedAt: response.releasedAt || response.data?.releasedAt || new Date().toISOString(),
      transferReference: response.transferReference || response.data?.transferReference,
    };
  } catch (error) {
    console.error('Error releasing Escrow.com funds:', error);
    throw error;
  }
};

/**
 * Cancel Escrow.com transaction
 * @param {string} escrowId - Escrow transaction ID
 * @param {string} reason - Cancellation reason (optional)
 * @returns {Promise<object>} Cancellation response
 */
export const cancelEscrowTransaction = async (escrowId, reason = 'Cancelled by user') => {
  try {
    if (!escrowId) {
      throw new Error('Escrow ID is required');
    }

    console.log('Cancelling Escrow.com transaction via backend:', escrowId, reason);

    const response = await api.post(API_ENDPOINTS.ESCROW.CANCEL(escrowId), {
      reason,
    });

    if (!response) {
      throw new Error('Failed to cancel escrow transaction. Backend API returned no response.');
    }

    return {
      escrowId: response.escrowId || escrowId,
      status: response.status || response.data?.status || 'cancelled',
      cancelledAt: response.cancelledAt || response.data?.cancelledAt || new Date().toISOString(),
      reason: response.reason || reason,
    };
  } catch (error) {
    console.error('Error cancelling Escrow.com transaction:', error);
    throw error;
  }
};

/**
 * Get escrow transaction by booking ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object|null>} Escrow transaction or null if not found
 */
export const getEscrowByBookingId = async (bookingId) => {
  try {
    if (!bookingId) {
      return null;
    }

    // Backend should provide an endpoint to get escrow by booking ID
    const response = await api.get(API_ENDPOINTS.ESCROW.BY_BOOKING(bookingId));

    if (!response) {
      // Try alternative endpoint format
      const altResponse = await api.get(`/api/escrow?bookingId=${bookingId}`);
      if (!altResponse) {
        return null;
      }
      return formatEscrowResponse(altResponse, bookingId);
    }

    return formatEscrowResponse(response, bookingId);
  } catch (error) {
    console.error('Error getting escrow by booking ID:', error);
    return null;
  }
};

/**
 * Format escrow response to standard format
 */
const formatEscrowResponse = (response, bookingId) => {
  return {
    escrowId: response.escrowId || response.id || response.data?.escrowId || response.data?.id,
    bookingId: response.bookingId || bookingId,
    status: response.status || response.data?.status,
    amount: response.amount || response.data?.amount,
    buyerEmail: response.buyerEmail || response.data?.buyerEmail,
    sellerEmail: response.sellerEmail || response.data?.sellerEmail,
    paystackReference: response.paystackReference || response.data?.paystackReference,
    createdAt: response.createdAt || response.data?.createdAt,
    paymentRequestedAt: response.paymentRequestedAt || response.data?.paymentRequestedAt,
    paymentReleasedAt: response.paymentReleasedAt || response.data?.paymentReleasedAt,
    conditions: response.conditions || response.data?.conditions,
  };
};

/**
 * Request payment from escrow (host requests payment)
 * @param {string} escrowId - Escrow transaction ID
 * @returns {Promise<object>} Request response
 */
export const requestEscrowPayment = async (escrowId) => {
  try {
    if (!escrowId) {
      throw new Error('Escrow ID is required');
    }

    console.log('Requesting payment from Escrow.com via backend:', escrowId);

    // Update escrow status to payment_requested
    // This might be done via a separate endpoint or as part of status update
    const response = await api.post(`${API_ENDPOINTS.ESCROW.STATUS(escrowId)}/request-payment`, {});

    if (!response) {
      throw new Error('Failed to request escrow payment. Backend API returned no response.');
    }

    return {
      escrowId: response.escrowId || escrowId,
      status: response.status || response.data?.status || 'payment_requested',
      paymentRequestedAt: response.paymentRequestedAt || response.data?.paymentRequestedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error requesting Escrow.com payment:', error);
    throw error;
  }
};

