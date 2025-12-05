// API Configuration
// Update this file if the backend URL changes
import { Platform } from 'react-native';

// Determine the base URL based on platform and environment
const getBaseURL = () => {
  // Check if we're in development and local backend is available
  const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
  
  // Check if we have a Railway backend URL set
  const railwayUrl = process.env.EXPO_PUBLIC_RAILWAY_URL || 'https://booking-backend-staging.up.railway.app';
  
  // Try local backend first in development
  if (isDevelopment) {
    // Use localhost for local Node.js backend
    const localUrl = 'http://localhost:3000';
    
    // In browser, try to detect if backend is available
    if (typeof window !== 'undefined') {
      // For web, prefer Railway if localhost fails
      // User can override with EXPO_PUBLIC_RAILWAY_URL
      if (railwayUrl && railwayUrl !== 'https://booking-backend-staging.up.railway.app') {
        console.log('🌐 Using Railway backend URL:', railwayUrl);
        return railwayUrl;
      }
    }
    
    console.log('🌐 Using local Node.js backend URL:', localUrl);
    return localUrl;
  }
  
  // Production: Use Railway backend
  console.log('🌐 Using Railway backend URL:', railwayUrl);
  return railwayUrl;
};

export const API_CONFIG = {
  BASE_URL: getBaseURL(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // Initial delay in ms (exponential backoff)
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
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
  // Payments (Paystack)
  PAYMENTS: {
    PAYSTACK_INITIALIZE: '/api/payments/paystack/initialize',
    PAYSTACK_VERIFY: '/api/payments/paystack/verify',
  },
  // Flutterwave
  FLUTTERWAVE: {
    INITIALIZE: '/api/payments/flutterwave/initialize',
    VERIFY: '/api/payments/flutterwave/verify',
    VIRTUAL_ACCOUNT: '/api/payments/flutterwave/virtual-account',
  },
  // Escrow
  ESCROW: {
    CREATE: '/api/escrow',
    STATUS: (id) => `/api/escrow/${id}`,
    RELEASE: (id) => `/api/escrow/${id}/release`,
    CANCEL: (id) => `/api/escrow/${id}/cancel`,
    BY_BOOKING: (bookingId) => `/api/escrow/booking/${bookingId}`,
  },
};

