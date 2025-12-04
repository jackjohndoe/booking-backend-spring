// API Configuration
// Update this file if the backend URL changes

export const API_CONFIG = {
  BASE_URL: 'https://booking-staging-54a6.up.railway.app',
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
    BALANCE: '/api/wallet/balance',
    FUND: '/api/wallet/fund',
    TRANSACTIONS: '/api/wallet/transactions',
    PAY: '/api/wallet/pay',
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
};

