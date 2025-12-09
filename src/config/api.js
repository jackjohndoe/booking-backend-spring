// API Configuration
// Update this file if the backend URL changes

export const API_CONFIG = {
  BASE_URL: 'https://booking-backend-staging.up.railway.app',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/profile',
    ME: '/api/auth/me',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    VALIDATE_RESET_TOKEN: '/api/auth/validate-reset-token',
  },
  // Apartments
  APARTMENTS: {
    LIST: '/api/apartments',
    DETAIL: (id) => `/api/apartments/${id}`,
    CREATE: '/api/apartments',
    UPDATE: (id) => `/api/apartments/${id}`,
    DELETE: (id) => `/api/apartments/${id}`,
    MY_LISTINGS: '/api/apartments/my-listings',
    SEARCH: '/api/apartments/search',
  },
  // Bookings
  BOOKINGS: {
    LIST: '/api/bookings',
    DETAIL: (id) => `/api/bookings/${id}`,
    CREATE: '/api/bookings',
    UPDATE: (id) => `/api/bookings/${id}`,
    DELETE: (id) => `/api/bookings/${id}`,
    MY_BOOKINGS: '/api/bookings/my-bookings',
  },
  // Wallet
  WALLET: {
    BALANCE: '/api/wallet',
    FUND: '/api/wallet/deposit',
    WITHDRAW: '/api/wallet/withdraw',
    TRANSACTIONS: '/api/wallet/transactions',
    PAY: '/api/wallet/pay',
    SYNC: '/api/wallet/sync',
    VERIFY_TRANSACTION: '/api/wallet/verify-transaction',
    VERIFY_TRANSACTIONS: '/api/wallet/verify-transactions',
    SYNC_ALL: '/api/wallet/sync-all',
    VERIFY_PENDING: '/api/wallet/verify-pending', // Verify all pending transactions
  },
  // Favorites
  FAVORITES: {
    LIST: '/api/favorites',
    ADD: '/api/favorites',
    REMOVE: (id) => `/api/favorites/${id}`,
    CHECK: (id) => `/api/favorites/check/${id}`,
  },
  // Email
  EMAIL: {
    SEND_BOOKING_CONFIRMATION: '/api/email/send-booking-confirmation',
    SEND_HOST_NOTIFICATION: '/api/email/send-host-notification',
  },
  // Payments
  PAYMENTS: {
    CREATE_VIRTUAL_ACCOUNT: '/api/payments/flutterwave/create-virtual-account',
    INITIALIZE_PAYMENT: '/api/payments/flutterwave/initialize',
    VERIFY_PAYMENT: '/api/payments/flutterwave/verify',
  },
  // Escrow
  ESCROW: {
    CREATE: '/api/escrow/create',
    STATUS: (escrowId) => `/api/escrow/${escrowId}/status`,
    RELEASE: (escrowId) => `/api/escrow/${escrowId}/release`,
    CANCEL: (escrowId) => `/api/escrow/${escrowId}/cancel`,
    BY_BOOKING: (bookingId) => `/api/escrow/booking/${bookingId}`,
  },
};

