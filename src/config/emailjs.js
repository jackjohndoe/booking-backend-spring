// EmailJS Configuration
// To set up EmailJS:
// 1. Create a free account at https://www.emailjs.com
// 2. Create an email service (Gmail, Outlook, etc.)
// 3. Create email templates for user booking confirmation and host notification
// 4. Get your Service ID, Public Key, and Template IDs from EmailJS dashboard
// 5. Replace the placeholder values below with your actual EmailJS credentials

export const EMAILJS_CONFIG = {
  // Your EmailJS Service ID
  SERVICE_ID: 'service_wr2rj5a',
  
  // Your EmailJS Public Key
  PUBLIC_KEY: 'wrwdfGR63VciHCPMn',
  
  // Template ID for user booking confirmation email
  USER_BOOKING_TEMPLATE_ID: 'template_s55ecli',
  
  // Template ID for host booking notification email
  HOST_BOOKING_TEMPLATE_ID: 'template_yvmpnqa',
};

// Check if EmailJS is configured
export const isEmailJSConfigured = () => {
  return (
    EMAILJS_CONFIG.SERVICE_ID !== 'YOUR_SERVICE_ID' &&
    EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' &&
    EMAILJS_CONFIG.USER_BOOKING_TEMPLATE_ID !== 'YOUR_USER_BOOKING_TEMPLATE_ID' &&
    EMAILJS_CONFIG.HOST_BOOKING_TEMPLATE_ID !== 'YOUR_HOST_BOOKING_TEMPLATE_ID'
  );
};

