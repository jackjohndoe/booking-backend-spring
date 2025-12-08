// Escrow.com Configuration
// Note: All Escrow.com API credentials are stored on the backend for security
// This file contains frontend configuration constants only

/**
 * Escrow transaction statuses
 */
export const ESCROW_STATUS = {
  PENDING: 'pending',
  IN_ESCROW: 'in_escrow',
  PAYMENT_REQUESTED: 'payment_requested',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PAYMENT_RELEASED: 'payment_released',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

/**
 * Escrow release conditions
 */
export const ESCROW_CONDITIONS = {
  // Auto-release conditions
  AUTO_RELEASE_ON_CHECKIN: 'auto_release_on_checkin',
  MANUAL_RELEASE: 'manual_release',
  
  // Release triggers
  HOST_REQUEST_PAYMENT: 'host_request_payment',
  GUEST_CONFIRM_PAYMENT: 'guest_confirm_payment',
  CHECKIN_DATE_REACHED: 'checkin_date_reached',
};

/**
 * Default escrow conditions for bookings
 */
export const DEFAULT_ESCROW_CONDITIONS = {
  autoRelease: false,
  releaseTrigger: ESCROW_CONDITIONS.HOST_REQUEST_PAYMENT,
  checkInDate: null,
  checkOutDate: null,
  description: 'Apartment booking escrow',
};

/**
 * Escrow transaction metadata structure
 */
export const ESCROW_METADATA = {
  bookingId: null,
  apartmentId: null,
  apartmentTitle: null,
  checkInDate: null,
  checkOutDate: null,
  numberOfDays: null,
  numberOfGuests: null,
  buyerName: null,
  sellerName: null,
};

/**
 * Get escrow status display name
 */
export const getEscrowStatusDisplayName = (status) => {
  const statusMap = {
    [ESCROW_STATUS.PENDING]: 'Pending',
    [ESCROW_STATUS.IN_ESCROW]: 'In Escrow',
    [ESCROW_STATUS.PAYMENT_REQUESTED]: 'Payment Requested',
    [ESCROW_STATUS.PAYMENT_CONFIRMED]: 'Payment Confirmed',
    [ESCROW_STATUS.PAYMENT_RELEASED]: 'Payment Released',
    [ESCROW_STATUS.CANCELLED]: 'Cancelled',
    [ESCROW_STATUS.REFUNDED]: 'Refunded',
  };
  return statusMap[status] || status;
};

/**
 * Get escrow status color for UI
 */
export const getEscrowStatusColor = (status) => {
  const colorMap = {
    [ESCROW_STATUS.PENDING]: '#FF9800',
    [ESCROW_STATUS.IN_ESCROW]: '#2196F3',
    [ESCROW_STATUS.PAYMENT_REQUESTED]: '#FFC107',
    [ESCROW_STATUS.PAYMENT_CONFIRMED]: '#4CAF50',
    [ESCROW_STATUS.PAYMENT_RELEASED]: '#4CAF50',
    [ESCROW_STATUS.CANCELLED]: '#F44336',
    [ESCROW_STATUS.REFUNDED]: '#9E9E9E',
  };
  return colorMap[status] || '#666';
};

/**
 * Check if escrow status allows payment request
 */
export const canRequestPayment = (status) => {
  return status === ESCROW_STATUS.IN_ESCROW;
};

/**
 * Check if escrow status allows payment release
 */
export const canReleasePayment = (status) => {
  return status === ESCROW_STATUS.PAYMENT_REQUESTED;
};

/**
 * Check if escrow is in a final state
 */
export const isEscrowFinal = (status) => {
  return [
    ESCROW_STATUS.PAYMENT_RELEASED,
    ESCROW_STATUS.CANCELLED,
    ESCROW_STATUS.REFUNDED,
  ].includes(status);
};


















