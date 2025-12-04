// SendGrid Configuration
// SendGrid API for sending emails directly from the mobile app
// Supports environment variables with fallback to hardcoded values

export const SENDGRID_CONFIG = {
  // Your SendGrid API Key
  // Can be set via SENDGRID_API_KEY environment variable or hardcoded here
  API_KEY: process.env.SENDGRID_API_KEY || 'YOUR_SENDGRID_API_KEY_HERE',
  
  // SendGrid API endpoint (REST API - recommended for React Native/Expo)
  API_URL: 'https://api.sendgrid.com/v3/mail/send',
  
  // SMTP Configuration (available but not used - REST API is used instead)
  // Server: smtp.sendgrid.net
  // Ports: 25, 587 (TLS), 465 (SSL)
  // Username: apikey
  // Password: (same as API_KEY above)
  
  // Sender email address (MUST be verified in SendGrid Dashboard)
  // Can be set via SENDGRID_FROM_EMAIL environment variable or hardcoded here
  // 
  // TO FIX EMAIL SENDING ISSUES:
  // 1. Go to https://app.sendgrid.com/
  // 2. Navigate to: Settings > Sender Authentication
  // 3. Click "Verify a Single Sender" or use an existing verified sender
  // 4. Follow the verification process (check your email inbox)
  // 5. Once verified, update the FROM_EMAIL below to match your verified email
  // 6. Update FROM_NAME to match your brand/app name
  //
  // IMPORTANT: SendGrid will reject emails if the FROM_EMAIL is not verified!
  FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'NigerianApartments@ledgeroofing.com', // Verified sender email
  FROM_NAME: process.env.SENDGRID_FROM_NAME || 'Nigerian Apartments',
};

// Check if SendGrid is configured
export const isSendGridConfigured = () => {
  const hasApiKey = SENDGRID_CONFIG.API_KEY && SENDGRID_CONFIG.API_KEY !== 'YOUR_SENDGRID_API_KEY';
  const hasFromEmail = SENDGRID_CONFIG.FROM_EMAIL && SENDGRID_CONFIG.FROM_EMAIL !== 'YOUR_EMAIL@example.com';
  
  if (hasApiKey && !hasFromEmail) {
    console.warn('⚠️ SendGrid API key is set, but FROM_EMAIL needs to be updated to your verified sender email in SendGrid Dashboard');
  }
  
  return hasApiKey && hasFromEmail;
};

