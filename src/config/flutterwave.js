// Flutterwave configuration
// Replace with your actual Flutterwave public and secret keys

export const FLUTTERWAVE_CONFIG = {
  // Public key for client-side operations (safe to expose)
  // Get your keys from: https://dashboard.flutterwave.com/dashboard/settings/apis
  // Test keys: Use for development/testing
  // Live keys: Use for production
  PUBLIC_KEY: process.env.FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-97675915e5451308802b09c1f5a91726-X',
  
  // Secret key should only be used on backend (not in mobile app)
  // IMPORTANT: Never expose secret key in mobile app - use backend API only
  // Get your secret key from the same dashboard page
  SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK-xxxx-xxxxxx-X',
  
  // Flutterwave API base URL
  API_BASE_URL: 'https://api.flutterwave.com/v3',
  
  // Currency
  CURRENCY: 'NGN',
  
  // Callback URL (for webhook verification - backend only)
  CALLBACK_URL: process.env.FLUTTERWAVE_CALLBACK_URL || 'https://booking-backend-staging.up.railway.app/api/payments/flutterwave/callback',
};

/**
 * Check if Flutterwave is configured
 */
export const isFlutterwaveConfigured = () => {
  return (
    FLUTTERWAVE_CONFIG.PUBLIC_KEY &&
    FLUTTERWAVE_CONFIG.PUBLIC_KEY !== 'FLWPUBK-xxxx-xxxxxx-X' &&
    FLUTTERWAVE_CONFIG.PUBLIC_KEY !== 'FLWPUBK-YOUR_PUBLIC_KEY_HERE'
  );
};

