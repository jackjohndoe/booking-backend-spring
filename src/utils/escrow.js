// Escrow Payment Utilities
// Handles escrow payment logic: payments go to escrow, host requests payment, user confirms, funds transfer to host
// Now uses Escrow.com API via backend instead of AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserStorageKey } from './userStorage';
import { updateBookingStatus, getBookingById } from './bookings';
import { hybridWalletService } from '../services/hybridService';
import * as escrowService from '../services/escrowService';
import { ESCROW_STATUS, DEFAULT_ESCROW_CONDITIONS } from '../config/escrow';

// Feature flag to toggle between old and new escrow systems
const USE_ESCROW_COM = true; // Set to false to use old AsyncStorage system during migration

/**
 * Escrow statuses (mapped to Escrow.com statuses):
 * - 'pending': Transaction pending
 * - 'in_escrow': Payment is held in escrow
 * - 'payment_requested': Host has requested payment on check-in date
 * - 'payment_confirmed': User confirmed payment, funds transferred to host
 * - 'payment_released': Funds have been released to host wallet
 */

/**
 * Create an escrow payment entry
 * @param {string} bookingId - Booking ID
 * @param {string} userEmail - User email (guest)
 * @param {string} hostEmail - Host email
 * @param {number} amount - Amount in escrow
 * @param {object} paymentData - Payment data (method, reference, etc.)
 */
export const createEscrowPayment = async (bookingId, userEmail, hostEmail, amount, paymentData = {}) => {
  try {
    // Use Escrow.com if enabled and Paystack reference is provided
    if (USE_ESCROW_COM && paymentData.paymentReference) {
      const conditions = {
        ...DEFAULT_ESCROW_CONDITIONS,
        checkInDate: paymentData.checkInDate || null,
        checkOutDate: paymentData.checkOutDate || null,
        description: `Apartment booking: ${paymentData.apartmentTitle || 'Booking'}`,
      };

      const escrowTransaction = await escrowService.createEscrowTransaction(
        bookingId,
        amount,
        userEmail,
        hostEmail,
        paymentData.paymentReference,
        conditions
      );

      // If escrowTransaction is null (auth error or API failure), fall through to local storage
      if (!escrowTransaction) {
        console.warn('⚠️ Escrow.com transaction creation returned null - falling back to local escrow storage');
        // Fall through to local storage fallback below
      } else {
        // Map Escrow.com response to legacy format for compatibility
        return {
          id: escrowTransaction.escrowId,
          escrowId: escrowTransaction.escrowId,
          bookingId: escrowTransaction.bookingId,
          userEmail: escrowTransaction.buyerEmail,
          hostEmail: escrowTransaction.sellerEmail,
          amount: escrowTransaction.amount,
          status: escrowTransaction.status,
          paymentMethod: paymentData.paymentMethod || 'Paystack',
          paymentReference: escrowTransaction.paystackReference,
          createdAt: escrowTransaction.createdAt,
          paymentRequestedAt: null,
          paymentConfirmedAt: null,
          paymentReleasedAt: null,
          checkInDate: conditions.checkInDate,
        };
      }
    }

    // Fallback to old AsyncStorage system for backward compatibility
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowJson = await AsyncStorage.getItem(escrowKey);
    const escrowPayments = escrowJson ? JSON.parse(escrowJson) : [];
    
    const escrowPayment = {
      id: `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      escrowId: paymentData.escrowId || null, // Include escrowId from paymentData if provided
      bookingId,
      userEmail: userEmail.toLowerCase().trim(),
      hostEmail: hostEmail ? hostEmail.toLowerCase().trim() : null,
      amount,
      status: 'in_escrow',
      paymentMethod: paymentData.paymentMethod || 'Unknown',
      paymentReference: paymentData.paymentReference || null,
      createdAt: new Date().toISOString(),
      paymentRequestedAt: null,
      paymentConfirmedAt: null,
      paymentReleasedAt: null,
      checkInDate: paymentData.checkInDate || null,
    };
    
    escrowPayments.unshift(escrowPayment);
    await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));
    
    return escrowPayment;
  } catch (error) {
    console.error('Error creating escrow payment:', error);
    throw error;
  }
};

/**
 * Get all escrow payments for a user
 * @param {string} userEmail - User email
 */
export const getEscrowPayments = async (userEmail) => {
  try {
    if (!userEmail) {
      return [];
    }
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowJson = await AsyncStorage.getItem(escrowKey);
    return escrowJson ? JSON.parse(escrowJson) : [];
  } catch (error) {
    console.error('Error getting escrow payments:', error);
    return [];
  }
};

/**
 * Get escrow payment by booking ID
 * @param {string} userEmail - User email
 * @param {string} bookingId - Booking ID
 */
export const getEscrowPaymentByBookingId = async (userEmail, bookingId) => {
  try {
    const escrowPayments = await getEscrowPayments(userEmail);
    return escrowPayments.find(ep => ep.bookingId === bookingId) || null;
  } catch (error) {
    console.error('Error getting escrow payment by booking ID:', error);
    return null;
  }
};

/**
 * Request payment from escrow (host requests payment on check-in date)
 * @param {string} userEmail - Guest email
 * @param {string} bookingId - Booking ID
 * @param {string} hostEmail - Host email
 */
export const requestEscrowPayment = async (userEmail, bookingId, hostEmail) => {
  try {
    // Try Escrow.com first if enabled
    if (USE_ESCROW_COM) {
      try {
        const escrow = await getEscrowByBooking(bookingId);
        if (escrow && escrow.escrowId) {
          const result = await escrowService.requestEscrowPayment(escrow.escrowId);
          
          // Update booking status
          try {
            await updateBookingStatus(userEmail, bookingId, 'Payment Requested');
          } catch (error) {
            console.error('Error updating booking status:', error);
          }
          
          // Send in-app notification to guest
          try {
            const { notifyPaymentRequested } = await import('./notifications');
            const { getBookingById } = await import('./bookings');
            const booking = await getBookingById(bookingId, userEmail);
            const propertyTitle = booking?.title || booking?.apartmentTitle || 'your booking';
            await notifyPaymentRequested(userEmail, escrow.amount, propertyTitle, bookingId);
            console.log(`✅ Payment request notification sent to guest: ${userEmail}`);
          } catch (notificationError) {
            console.error('Error sending payment request notification:', notificationError);
            // Don't fail the request if notification fails
          }
          
          // Map to legacy format
          return {
            ...escrow,
            status: result.status,
            paymentRequestedAt: result.paymentRequestedAt,
          };
        }
      } catch (error) {
        console.error('Error requesting payment from Escrow.com, falling back to local:', error);
        // Fall through to local system
      }
    }

    // Fallback to old AsyncStorage system
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowPayments = await getEscrowPayments(userEmail);
    const escrowIndex = escrowPayments.findIndex(ep => ep.bookingId === bookingId);
    
    if (escrowIndex === -1) {
      throw new Error('Escrow payment not found');
    }
    
    if (escrowPayments[escrowIndex].status !== 'in_escrow') {
      throw new Error(`Cannot request payment. Current status: ${escrowPayments[escrowIndex].status}`);
    }
    
    escrowPayments[escrowIndex].status = 'payment_requested';
    escrowPayments[escrowIndex].paymentRequestedAt = new Date().toISOString();
    escrowPayments[escrowIndex].requestedBy = hostEmail ? hostEmail.toLowerCase().trim() : null;
    
    // Track payment request attempts (first or second)
    if (!escrowPayments[escrowIndex].paymentRequestAttempts) {
      escrowPayments[escrowIndex].paymentRequestAttempts = 1;
    } else {
      escrowPayments[escrowIndex].paymentRequestAttempts += 1;
    }
    
    // Store payment request countdown timestamp (2 minutes from now)
    const countdownEndTime = Date.now() + (2 * 60 * 1000); // 2 minutes in milliseconds
    escrowPayments[escrowIndex].paymentRequestCountdownEnd = countdownEndTime;
    
    await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));
    
    // Also store countdown separately for easy access
    const countdownKey = `payment_request_countdown_${bookingId}`;
    await AsyncStorage.setItem(countdownKey, countdownEndTime.toString());
    
    // Update booking status
    try {
      await updateBookingStatus(userEmail, bookingId, 'Payment Requested');
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
    
    // Send in-app notification to guest
    try {
      const { notifyPaymentRequested } = await import('./notifications');
      const { getBookingById } = await import('./bookings');
      const booking = await getBookingById(bookingId, userEmail);
      const propertyTitle = booking?.title || booking?.apartmentTitle || 'your booking';
      await notifyPaymentRequested(userEmail, escrowPayments[escrowIndex].amount, propertyTitle, bookingId);
      console.log(`✅ Payment request notification sent to guest: ${userEmail}`);
    } catch (notificationError) {
      console.error('Error sending payment request notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    return escrowPayments[escrowIndex];
  } catch (error) {
    console.error('Error requesting escrow payment:', error);
    throw error;
  }
};

/**
 * Confirm payment and release funds from escrow to host wallet
 * @param {string} userEmail - Guest email
 * @param {string} bookingId - Booking ID
 */
export const confirmEscrowPayment = async (userEmail, bookingId) => {
  try {
    // Try Escrow.com first if enabled
    if (USE_ESCROW_COM) {
      try {
        const escrow = await getEscrowByBooking(bookingId);
        if (escrow && escrow.escrowId) {
          if (escrow.status !== ESCROW_STATUS.PAYMENT_REQUESTED) {
            throw new Error(`Cannot confirm payment. Current status: ${escrow.status}. Payment must be requested first.`);
          }

          // Release funds via Escrow.com (backend handles Paystack transfer to host)
          const result = await escrowService.releaseEscrowFunds(escrow.escrowId);
          
          // Update booking status
          try {
            await updateBookingStatus(userEmail, bookingId, 'Payment Confirmed');
          } catch (error) {
            console.error('Error updating booking status:', error);
          }
          
          // Map to legacy format
          return {
            ...escrow,
            status: result.status,
            paymentReleasedAt: result.releasedAt,
            paymentConfirmedAt: result.releasedAt,
          };
        }
      } catch (error) {
        console.error('Error confirming payment via Escrow.com, falling back to local:', error);
        // Fall through to local system
      }
    }

    // Fallback to old AsyncStorage system
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowPayments = await getEscrowPayments(userEmail);
    const escrowIndex = escrowPayments.findIndex(ep => ep.bookingId === bookingId);
    
    if (escrowIndex === -1) {
      throw new Error('Escrow payment not found');
    }
    
    const escrowPayment = escrowPayments[escrowIndex];
    
    if (escrowPayment.status !== 'payment_requested') {
      throw new Error(`Cannot confirm payment. Current status: ${escrowPayment.status}. Payment must be requested first.`);
    }
    
    // Calculate host payment amount (total amount minus fees)
    // Fees: cleaning fee + service fee (both set to 0 until changed)
    const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
    const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
    const totalFees = cleaningFee + serviceFee;
    const hostPaymentAmount = Math.max(0, escrowPayment.amount - totalFees);
    
    // Transfer funds to host wallet
    if (escrowPayment.hostEmail && hostPaymentAmount > 0) {
      try {
        // Get current host balance
        const currentBalance = await hybridWalletService.getBalance(escrowPayment.hostEmail);
        
        // Add funds to host wallet
        await hybridWalletService.fundWallet(
          escrowPayment.hostEmail,
          hostPaymentAmount,
          `Escrow payment released for booking ${bookingId}`
        );
        
        console.log(`✅ Released ₦${hostPaymentAmount.toLocaleString()} to host wallet (${escrowPayment.hostEmail})`);
      } catch (walletError) {
        console.error('Error funding host wallet:', walletError);
        // Don't throw - we'll mark as confirmed even if wallet funding fails
        // The escrow payment is still confirmed
      }
    }
    
    // Update escrow payment status
    escrowPayments[escrowIndex].status = 'payment_confirmed';
    escrowPayments[escrowIndex].paymentConfirmedAt = new Date().toISOString();
    escrowPayments[escrowIndex].paymentReleasedAt = new Date().toISOString();
    escrowPayments[escrowIndex].hostPaymentAmount = hostPaymentAmount;
    escrowPayments[escrowIndex].fees = totalFees;
    
    await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));
    
    // Update booking status
    try {
      await updateBookingStatus(userEmail, bookingId, 'Payment Confirmed');
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
    
    return escrowPayments[escrowIndex];
  } catch (error) {
    console.error('Error confirming escrow payment:', error);
    throw error;
  }
};

/**
 * Get escrow payments that need payment request (check-in date has arrived)
 * @param {string} hostEmail - Host email
 */
export const getEscrowPaymentsNeedingRequest = async (hostEmail) => {
  try {
    if (!hostEmail) {
      return [];
    }
    
    // Get all escrow payments from all users
    // In a real app, this would be done server-side
    // For now, we'll check bookings and match with escrow payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // This is a simplified version - in production, this would query a database
    // For now, we'll return empty and handle it through booking checks
    return [];
  } catch (error) {
    console.error('Error getting escrow payments needing request:', error);
    return [];
  }
};

/**
 * Check if check-in date has arrived for a booking
 * @param {string} checkInDate - Check-in date (YYYY-MM-DD)
 */
/**
 * Check if check-in date has been reached (including today)
 * Returns true if today is the check-in date or later
 * This activates the "Request Payment" button on the check-in date
 * @param {string} checkInDate - Check-in date string (YYYY-MM-DD format)
 * @returns {boolean} True if check-in date is today or has passed
 */
export const isCheckInDateReached = (checkInDate) => {
  try {
    if (!checkInDate) {
      return false;
    }
    
    // Get today's date (local timezone, midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse check-in date (handle both YYYY-MM-DD and other formats)
    let checkIn;
    if (typeof checkInDate === 'string') {
      // Handle YYYY-MM-DD format
      if (checkInDate.includes('-')) {
        const [year, month, day] = checkInDate.split('-').map(Number);
        checkIn = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        checkIn = new Date(checkInDate);
      }
    } else {
      checkIn = new Date(checkInDate);
    }
    
    // Set to midnight for accurate date comparison
    checkIn.setHours(0, 0, 0, 0);
    
    // Return true if check-in date is today or has passed
    // This means the button activates ON the check-in date
    const isReached = checkIn.getTime() <= today.getTime();
    
    console.log(`📅 Check-in date check: ${checkInDate} | Today: ${today.toISOString().split('T')[0]} | Reached: ${isReached}`);
    
    return isReached;
  } catch (error) {
    console.error('Error checking check-in date:', error);
    return false;
  }
};

/**
 * Alias for getEscrowPayments - for compatibility
 * @param {string} userEmail - User email
 */
export const getEscrowForUser = async (userEmail) => {
  return await getEscrowPayments(userEmail);
};

/**
 * Add payment to escrow (alias for createEscrowPayment with different parameter order)
 * @param {string} userEmail - User email (guest)
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Amount in escrow
 * @param {string} hostEmail - Host email
 * @param {object} paymentData - Payment data (optional)
 */
export const addToEscrow = async (userEmail, bookingId, amount, hostEmail, paymentData = {}) => {
  return await createEscrowPayment(bookingId, userEmail, hostEmail, amount, paymentData);
};

/**
 * Get escrow payment by booking ID (searches across all users)
 * This is used by hosts who don't know the guest email
 * @param {string} bookingId - Booking ID
 */
export const getEscrowByBooking = async (bookingId) => {
  try {
    if (!bookingId) {
      return null;
    }

    // Try Escrow.com first if enabled
    if (USE_ESCROW_COM) {
      try {
        const escrowTransaction = await escrowService.getEscrowByBookingId(bookingId);
        if (escrowTransaction) {
          // Map Escrow.com response to legacy format
          return {
            id: escrowTransaction.escrowId,
            escrowId: escrowTransaction.escrowId,
            bookingId: escrowTransaction.bookingId,
            userEmail: escrowTransaction.buyerEmail,
            hostEmail: escrowTransaction.sellerEmail,
            amount: escrowTransaction.amount,
            status: escrowTransaction.status,
            paymentReference: escrowTransaction.paystackReference,
            createdAt: escrowTransaction.createdAt,
            paymentRequestedAt: escrowTransaction.paymentRequestedAt,
            paymentReleasedAt: escrowTransaction.paymentReleasedAt,
            checkInDate: escrowTransaction.conditions?.checkInDate || null,
          };
        }
      } catch (error) {
        console.error('Error getting escrow from Escrow.com, falling back to local:', error);
        // Fall through to local search
      }
    }

    // Fallback to old AsyncStorage system
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const escrowKeys = allKeys.filter(key => key.includes('escrowPayments'));
      
      for (const key of escrowKeys) {
        try {
          const escrowJson = await AsyncStorage.getItem(key);
          if (escrowJson) {
            const escrowPayments = JSON.parse(escrowJson);
            const escrow = escrowPayments.find(ep => ep.bookingId === bookingId);
            if (escrow) {
              return escrow;
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error('Error searching escrow payments:', error);
    }

    return null;
  } catch (error) {
    console.error('Error getting escrow by booking:', error);
    return null;
  }
};

/**
 * Request payment (simplified version that finds guest email from booking)
 * @param {string} bookingId - Booking ID
 */
export const requestPayment = async (bookingId) => {
  try {
    const escrow = await getEscrowByBooking(bookingId);
    if (!escrow) {
      throw new Error('Escrow payment not found for this booking');
    }

    if (escrow.status !== ESCROW_STATUS.IN_ESCROW && escrow.status !== ESCROW_STATUS.PENDING) {
      throw new Error(`Cannot request payment. Current status: ${escrow.status}`);
    }

    // Use Escrow.com if escrowId is present
    if (USE_ESCROW_COM && escrow.escrowId) {
      try {
        const result = await escrowService.requestEscrowPayment(escrow.escrowId);
        return {
          ...escrow,
          status: result.status,
          paymentRequestedAt: result.paymentRequestedAt,
        };
      } catch (error) {
        console.error('Error requesting payment via Escrow.com:', error);
        throw error;
      }
    }

    return await requestEscrowPayment(escrow.userEmail, bookingId, escrow.hostEmail);
  } catch (error) {
    console.error('Error requesting payment:', error);
    throw error;
  }
};

/**
 * Refund escrow payment to user
 * @param {string} userEmail - User's email
 * @param {string} bookingId - Booking ID
 */
export const refundEscrowPayment = async (userEmail, bookingId) => {
  try {
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowPayments = await getEscrowPayments(userEmail);
    const escrowIndex = escrowPayments.findIndex(ep => ep.bookingId === bookingId);
    
    if (escrowIndex === -1) {
      throw new Error('Escrow payment not found');
    }
    
    // Update escrow status to refunded
    escrowPayments[escrowIndex].status = 'refunded';
    escrowPayments[escrowIndex].refundedAt = new Date().toISOString();
    
    await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));
    
    // Clear countdown
    const countdownKey = `payment_request_countdown_${bookingId}`;
    await AsyncStorage.removeItem(countdownKey);
    
    return escrowPayments[escrowIndex];
  } catch (error) {
    console.error('Error refunding escrow payment:', error);
    throw error;
  }
};

/**
 * Decline payment and cancel booking
 * @param {string} userEmail - User's email
 * @param {string} bookingId - Booking ID
 * @param {string} hostEmail - Host's email
 * @param {string} reason - Reason for declining (optional)
 */
export const declinePayment = async (userEmail, bookingId, hostEmail, reason = 'Payment declined by guest') => {
  try {
    // Update escrow status to cancelled/refunded
    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowPayments = await getEscrowPayments(userEmail);
    const escrowIndex = escrowPayments.findIndex(ep => ep.bookingId === bookingId);
    
    if (escrowIndex !== -1) {
      escrowPayments[escrowIndex].status = 'cancelled';
      escrowPayments[escrowIndex].cancelledAt = new Date().toISOString();
      escrowPayments[escrowIndex].cancellationReason = reason;
      await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));
    }
    
    // Clear countdown
    const countdownKey = `payment_request_countdown_${bookingId}`;
    await AsyncStorage.removeItem(countdownKey);
    
    // Update booking status to cancelled
    await updateBookingStatus(userEmail, bookingId, 'Cancelled');
    
    return { success: true, escrow: escrowPayments[escrowIndex] };
  } catch (error) {
    console.error('Error declining payment:', error);
    throw error;
  }
};

/**
 * Approve payment (alias for confirmEscrowPayment)
 * @param {string} bookingId - Booking ID
 */
export const approvePayment = async (bookingId) => {
  try {
    const escrow = await getEscrowByBooking(bookingId);
    if (!escrow) {
      throw new Error('Escrow payment not found for this booking');
    }

    // Use Escrow.com if escrowId is present
    if (USE_ESCROW_COM && escrow.escrowId) {
      try {
        const result = await escrowService.releaseEscrowFunds(escrow.escrowId);
        return {
          ...escrow,
          status: result.status,
          paymentReleasedAt: result.releasedAt,
          paymentConfirmedAt: result.releasedAt,
        };
      } catch (error) {
        console.error('Error approving payment via Escrow.com:', error);
        throw error;
      }
    }

    return await confirmEscrowPayment(escrow.userEmail, bookingId);
  } catch (error) {
    console.error('Error approving payment:', error);
    throw error;
  }
};
