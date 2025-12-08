// Email service for sending booking confirmation emails
// Supports both backend API and SendGrid REST API
import { SENDGRID_CONFIG, isSendGridConfigured } from '../config/sendgrid';

/**
 * Send email via SendGrid REST API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML email content
 * @param {string} textContent - Plain text email content
 */
const sendEmailViaSendGrid = async (to, subject, htmlContent, textContent) => {
  try {
    if (!SENDGRID_CONFIG.API_KEY || SENDGRID_CONFIG.API_KEY === 'YOUR_SENDGRID_API_KEY') {
      console.error('❌ SendGrid API key is not configured');
      return false;
    }

    // Warn if FROM_EMAIL might not be verified, but still attempt to send
    if (!SENDGRID_CONFIG.FROM_EMAIL || SENDGRID_CONFIG.FROM_EMAIL === 'YOUR_EMAIL@example.com' || SENDGRID_CONFIG.FROM_EMAIL === 'noreply@bookingapp.com') {
      console.warn('⚠️ FROM_EMAIL might not be verified in SendGrid. Verify it in SendGrid Dashboard > Settings > Sender Authentication');
    }

    console.log(`📧 Sending email via SendGrid to: ${to}`);
    console.log(`📧 From: ${SENDGRID_CONFIG.FROM_EMAIL}`);
    console.log(`📧 API Key (first 10 chars): ${SENDGRID_CONFIG.API_KEY ? SENDGRID_CONFIG.API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);

    const requestBody = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: {
        email: SENDGRID_CONFIG.FROM_EMAIL,
        name: SENDGRID_CONFIG.FROM_NAME,
      },
      content: [
        {
          type: 'text/plain',
          value: textContent,
        },
        {
          type: 'text/html',
          value: htmlContent,
        },
      ],
    };

    // Log request details (without sensitive data)
    console.log('📧 SendGrid Request Details:', {
      to: to,
      from: SENDGRID_CONFIG.FROM_EMAIL,
      fromName: SENDGRID_CONFIG.FROM_NAME,
      subject: subject,
      hasHtmlContent: !!htmlContent,
      hasTextContent: !!textContent,
    });

    const response = await fetch(SENDGRID_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      console.log('✅ Email sent successfully via SendGrid to:', to);
      return true;
    } else {
      const errorText = await response.text();
      let errorMessage = `SendGrid API error (${response.status}): ${errorText}`;
      let detailedError = '';
      
      // Parse error details if available
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors && errorJson.errors.length > 0) {
          const errors = errorJson.errors.map((err, idx) => {
            let errMsg = `Error ${idx + 1}: ${err.message || 'Unknown error'}`;
            if (err.field) {
              errMsg += ` (Field: ${err.field})`;
            }
            if (err.help) {
              errMsg += ` (Help: ${err.help})`;
            }
            return errMsg;
          }).join(' | ');
          errorMessage = `SendGrid Errors: ${errors}`;
          detailedError = JSON.stringify(errorJson, null, 2);
        } else {
          detailedError = errorText;
        }
      } catch (e) {
        // Use errorText as is if JSON parsing fails
        detailedError = errorText;
      }
      
      console.error('❌ SendGrid API error:', errorMessage);
      console.error('❌ Full error response:', detailedError);
      console.error('❌ Status code:', response.status);
      console.error('❌ Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      // Provide helpful hints for common errors
      if (response.status === 401) {
        console.error('💡 Tip: Invalid API key. Check that your SendGrid API key is correct.');
      } else if (response.status === 403) {
        console.error('💡 Tip: API key permissions issue. Go to SendGrid Dashboard > Settings > API Keys');
        console.error('💡 Make sure your API key has "Mail Send" permissions enabled');
        console.error('💡 You may need to create a new API key with full access');
      } else if (response.status === 400) {
        console.error('💡 Tip: Bad request. Check the error details above.');
        if (errorText.includes('from') || errorText.toLowerCase().includes('sender')) {
          console.error('💡 The sender email must be verified in SendGrid Dashboard > Settings > Sender Authentication');
        }
      } else if (response.status === 422) {
        console.error('💡 Tip: Validation error. Check that all required fields are provided.');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending email via SendGrid:', error.message || error);
    if (error.message) {
      console.error('Full error:', error);
    }
    return false;
  }
};

/**
 * Generate HTML email template for booking confirmation
 */
/**
 * Generate HTML email template for wallet top-up confirmation
 */
const generateWalletTopUpHTML = (amount, paymentMethod, paymentReference, newBalance, userName) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: #FFFFFF; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .amount { color: #4CAF50; font-size: 1.2em; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Wallet Top-Up Confirmed!</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Your wallet has been successfully topped up. Here are the details:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Amount Added:</span> <span class="amount">₦${amount.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Method:</span> ${paymentMethod || 'N/A'}
              </div>
              ${paymentReference ? `<div class="detail-row">
                <span class="label">Payment Reference:</span> ${paymentReference}
              </div>` : ''}
              <div class="detail-row">
                <span class="label">New Wallet Balance:</span> <span class="amount">₦${newBalance.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Transaction Date:</span> ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <p>Your wallet is now ready for use. You can make bookings and payments directly from your wallet.</p>
            <p>Thank you for using our service!</p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

const generateBookingConfirmationHTML = (bookingData, userName, topUpAmount = null, newBalance = null) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FFC107; color: #333; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .amount { color: #FF9800; font-size: 1.2em; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Congratulations! Your booking has been confirmed. Here are your booking details:</p>
            
            ${topUpAmount ? `<div class="details" style="background-color: #e8f5e9; border-left: 4px solid #4CAF50; margin-bottom: 15px;">
              <div class="detail-row">
                <span class="label">💰 Wallet Top-Up:</span> <span class="amount">₦${topUpAmount.toLocaleString()}</span>
              </div>
              ${newBalance ? `<div class="detail-row">
                <span class="label">New Wallet Balance:</span> <span class="amount">₦${newBalance.toLocaleString()}</span>
              </div>` : ''}
            </div>` : ''}
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Apartment:</span> ${bookingData.title || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Location:</span> ${bookingData.location || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-in:</span> ${bookingData.checkInDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-out:</span> ${bookingData.checkOutDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Duration:</span> ${bookingData.numberOfDays || 1} day(s)
              </div>
              <div class="detail-row">
                <span class="label">Number of Guests:</span> ${bookingData.numberOfGuests || 1}
              </div>
              ${bookingData.paymentReference || bookingData.txRef ? `<div class="detail-row">
                <span class="label">Payment Reference:</span> ${bookingData.paymentReference || bookingData.txRef || 'N/A'}
              </div>` : ''}
              <div class="detail-row">
                <span class="label">Payment Method:</span> ${bookingData.paymentMethod || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Total Amount:</span> <span class="amount">₦${(bookingData.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Transaction Date:</span> ${new Date(bookingData.bookingDate || Date.now()).toLocaleDateString()}
              </div>
              <div class="detail-row">
                <span class="label">Booking Status:</span> ${bookingData.status || 'Confirmed'}
              </div>
            </div>
            
            <p>Thank you for choosing us! We look forward to hosting you.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generate HTML email template for host notification
 */
const generateHostNotificationHTML = (bookingData, userName, hostName, userEmail, userPhone, userAddress) => {
  // Fees set to 0 until changed
  const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
  const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
  const totalServiceFees = cleaningFee + serviceFee; // Total fees (currently 0)
  const hostReceives = Math.max(0, (bookingData.totalAmount || 0) - totalServiceFees);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FFC107; color: #333; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .user-info { background-color: #fffde7; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #FFC107; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .amount { color: #FF9800; font-size: 1.2em; font-weight: bold; }
          .user-section-title { font-weight: bold; color: #F57C00; margin-top: 10px; margin-bottom: 8px; font-size: 1.1em; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 New Booking Received!</h1>
          </div>
          <div class="content">
            <p>Dear ${hostName},</p>
            <p>Great news! You have received a new booking for your property. Payment has been confirmed and the booking is now active.</p>
            
            ${totalServiceFees > 0 ? `<div style="background-color: #fff3cd; border: 2px solid #FFC107; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold; color: #856404; font-size: 1.1em;">
                ⚠️ Important: A service fee of ₦${totalServiceFees.toLocaleString()} has been deducted from the total payment amount.
              </p>
              <p style="margin: 10px 0 0 0; color: #856404;">
                This includes ₦${cleaningFee.toLocaleString()} cleaning fee and ₦${serviceFee.toLocaleString()} service fee. The amount you receive is the total payment minus ₦${totalServiceFees.toLocaleString()}.
              </p>
            </div>` : ''}
            
            <div class="user-info">
              <div class="user-section-title">👤 Guest Information:</div>
              <div class="detail-row">
                <span class="label">Name:</span> ${userName}
              </div>
              ${userEmail ? `<div class="detail-row">
                <span class="label">Email:</span> ${userEmail}
              </div>` : ''}
              ${userPhone ? `<div class="detail-row">
                <span class="label">Phone/WhatsApp:</span> ${userPhone}
              </div>` : ''}
              ${userAddress ? `<div class="detail-row">
                <span class="label">Address:</span> ${userAddress}
              </div>` : ''}
            </div>
            
            <div class="details">
              <div class="user-section-title">📋 Booking Details:</div>
              <div class="detail-row">
                <span class="label">Apartment:</span> ${bookingData.title || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Location:</span> ${bookingData.location || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-in Date:</span> ${bookingData.checkInDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-out Date:</span> ${bookingData.checkOutDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Duration:</span> ${bookingData.numberOfDays || 1} day(s)
              </div>
              <div class="detail-row">
                <span class="label">Number of Guests:</span> ${bookingData.numberOfGuests || 1}
              </div>
              <div class="detail-row">
                <span class="label">Payment Method:</span> ${bookingData.paymentMethod || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Booking Date:</span> ${new Date().toLocaleDateString()}
              </div>
            </div>
            
            <div class="details" style="background-color: #fffde7; border-left: 4px solid #FFC107; margin-top: 20px;">
              <div class="user-section-title" style="color: #F57C00;">💰 Payment Breakdown:</div>
              <div class="detail-row">
                <span class="label">Total Amount Paid by Guest:</span> <span class="amount" style="color: #FF9800;">₦${(bookingData.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row" style="border-top: 2px solid #FFC107; margin-top: 10px; padding-top: 10px;">
                <span class="label" style="color: #F57C00;">Service Fees (Taken by App):</span>
              </div>
              <div class="detail-row" style="padding-left: 20px;">
                <span class="label">• Cleaning Fee:</span> <span style="color: #F57C00;">₦${cleaningFee.toLocaleString()}</span>
              </div>
              <div class="detail-row" style="padding-left: 20px;">
                <span class="label">• Service Fee:</span> <span style="color: #F57C00;">₦${serviceFee.toLocaleString()}</span>
              </div>
              <div class="detail-row" style="padding-left: 20px; border-top: 1px solid #FFE082;">
                <span class="label"><strong>Total Service Fees:</strong></span> <span style="color: #F57C00; font-weight: bold;">₦${totalServiceFees.toLocaleString()}</span>
              </div>
              <div class="detail-row" style="border-top: 2px solid #FFC107; margin-top: 10px; padding-top: 10px;">
                <span class="label" style="color: #F57C00; font-size: 1.1em;"><strong>Amount You Receive (Total - Fees):</strong></span> <span style="color: #F57C00; font-size: 1.2em; font-weight: bold;">₦${hostReceives.toLocaleString()}</span>
              </div>
              ${totalServiceFees > 0 ? `<div class="detail-row" style="margin-top: 10px; padding-top: 10px; font-size: 0.9em; color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 5px;">
                <strong>📌 Service Fee Notice:</strong> A service fee of ₦${totalServiceFees.toLocaleString()} is deducted from every booking payment. This consists of ₦${cleaningFee.toLocaleString()} cleaning fee and ₦${serviceFee.toLocaleString()} service fee. Your payment is calculated as: Total Amount - ₦${totalServiceFees.toLocaleString()} = Amount You Receive.
              </div>` : ''}
            </div>
            
            <p><strong>Action Required:</strong> Please prepare your property and ensure everything is ready for your guest's arrival. You can contact the guest using the information provided above.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Send wallet top-up confirmation email to user
 * @param {string} userEmail - User's email address
 * @param {number} amount - Amount added to wallet
 * @param {string} paymentMethod - Payment method used
 * @param {string} paymentReference - Payment reference (optional)
 * @param {number} newBalance - New wallet balance (optional)
 * @param {string} userName - User's name (optional)
 */
export const sendWalletTopUpEmail = async (userEmail, amount, paymentMethod, paymentReference = null, newBalance = null, userName = 'Valued Customer') => {
  if (!userEmail) {
    console.warn('Cannot send email: No user email provided');
    return false;
  }

  try {
    // Get current balance if not provided
    if (!newBalance) {
      try {
        const { getWalletBalance } = await import('../utils/wallet');
        newBalance = await getWalletBalance(userEmail);
      } catch (error) {
        console.log('Could not get wallet balance for email:', error);
      }
    }

    const receiptDetails = `
Wallet Top-Up Confirmation:
- Amount Added: ₦${amount.toLocaleString()}
- Payment Method: ${paymentMethod || 'N/A'}
${paymentReference ? `- Payment Reference: ${paymentReference}` : ''}
${newBalance ? `- New Wallet Balance: ₦${newBalance.toLocaleString()}` : ''}
- Transaction Date: ${new Date().toLocaleDateString()}
`;

    const subject = 'Wallet Top-Up Confirmed!';
    const htmlContent = generateWalletTopUpHTML(amount, paymentMethod, paymentReference, newBalance || 0, userName);

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: userEmail,
        subject: subject,
        amount: amount,
        paymentMethod: paymentMethod,
        paymentReference: paymentReference,
        newBalance: newBalance,
        userName: userName,
        emailType: 'wallet_topup',
      };

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_BOOKING_CONFIRMATION || '/api/email/send', emailPayload);
      
      if (response) {
        console.log('✅ Wallet top-up email sent via backend API');
        return true;
      }
    } catch (apiError) {
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send wallet top-up email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(userEmail, subject, htmlContent, receiptDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Email sending failed - both backend API and SendGrid failed');
    console.error('❌ User email that failed:', userEmail);
    return false;
  } catch (error) {
    console.error('Error sending wallet top-up email:', error);
    return false;
  }
};

/**
 * Send booking confirmation email to user
 * @param {string} userEmail - User's email address
 * @param {object} bookingData - Booking information
 * @param {string} bookingData.title - Apartment title
 * @param {string} bookingData.location - Apartment location
 * @param {number} bookingData.totalAmount - Total payment amount
 * @param {string} bookingData.checkInDate - Check-in date
 * @param {string} bookingData.checkOutDate - Check-out date
 * @param {number} bookingData.numberOfDays - Number of days
 * @param {number} bookingData.numberOfGuests - Number of guests
 * @param {string} bookingData.paymentMethod - Payment method used
 * @param {string} userName - User's name (optional)
 * @param {number} topUpAmount - Amount added to wallet (optional, for booking payments)
 * @param {number} newBalance - New wallet balance after top-up (optional)
 */
export const sendUserBookingConfirmationEmail = async (userEmail, bookingData, userName = 'Valued Customer', topUpAmount = null, newBalance = null) => {
  if (!userEmail) {
    console.warn('Cannot send email: No user email provided');
    return false;
  }

  try {
    // Format the receipt details with complete information
    const receiptDetails = `
BOOKING CONFIRMATION RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Booking Details:
- Apartment: ${bookingData.title || 'N/A'}
- Location: ${bookingData.location || 'N/A'}
- Check-in Date: ${bookingData.checkInDate || 'N/A'}
- Check-out Date: ${bookingData.checkOutDate || 'N/A'}
- Duration: ${bookingData.numberOfDays || 1} day(s)
- Number of Guests: ${bookingData.numberOfGuests || 1}
- Booking Date: ${new Date(bookingData.bookingDate || Date.now()).toLocaleDateString()}

Payment Information:
- Payment Method: ${bookingData.paymentMethod || 'N/A'}
${bookingData.paymentReference || bookingData.txRef ? `- Payment Reference: ${bookingData.paymentReference || bookingData.txRef}` : ''}
- Total Amount Paid: ₦${(bookingData.totalAmount || 0).toLocaleString()}
- Transaction Status: ${bookingData.status || 'Confirmed'}

${topUpAmount ? `Wallet Top-Up:
- Amount Added to Wallet: ₦${topUpAmount.toLocaleString()}
${newBalance ? `- New Wallet Balance: ₦${newBalance.toLocaleString()}` : ''}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thank you for your booking!
`;

    const subject = 'Congratulations on Your Successful Booking!';
    const htmlContent = generateBookingConfirmationHTML(bookingData, userName, topUpAmount, newBalance);

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: userEmail,
        subject: subject,
        bookingData: bookingData,
        receiptDetails: receiptDetails,
        userName: userName,
      };

      // Log only once to reduce console noise
      if (!global._emailAttemptLogged) {
        console.log('📧 Attempting to send booking confirmation email via backend API...');
        global._emailAttemptLogged = true;
        setTimeout(() => { global._emailAttemptLogged = false; }, 2000);
      }

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_BOOKING_CONFIRMATION, emailPayload);
      
      if (response) {
        if (!global._emailSuccessLogged) {
          console.log('✅ Booking confirmation email sent via backend API');
          global._emailSuccessLogged = true;
          setTimeout(() => { global._emailSuccessLogged = false; }, 3000);
        }
        return true;
      }
      // Backend returned null - try SendGrid as fallback
    } catch (apiError) {
      // Only log if it's an unexpected error (not already handled by API service)
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
      // Continue to SendGrid fallback
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(userEmail, subject, htmlContent, receiptDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Email sending failed - both backend API and SendGrid failed');
    console.error('❌ User email that failed:', userEmail);
    return false;
  } catch (error) {
    console.error('Error sending user booking confirmation email:', error);
    return false;
  }
};

/**
 * Send booking notification email to host
 * @param {string} hostEmail - Host's email address
 * @param {object} bookingData - Booking information
 * @param {string} bookingData.title - Apartment title
 * @param {string} bookingData.location - Apartment location
 * @param {number} bookingData.totalAmount - Total payment amount
 * @param {string} bookingData.checkInDate - Check-in date
 * @param {string} bookingData.checkOutDate - Check-out date
 * @param {number} bookingData.numberOfDays - Number of days
 * @param {number} bookingData.numberOfGuests - Number of guests
 * @param {string} bookingData.paymentMethod - Payment method used
 * @param {string} userName - Name of the user who made the booking
 * @param {string} userEmail - Email of the user who made the booking
 * @param {string} userPhone - Phone/WhatsApp of the user (optional)
 * @param {string} userAddress - Address of the user (optional)
 */
export const sendHostBookingNotificationEmail = async (hostEmail, bookingData, userName = 'A guest', userEmail = null, userPhone = null, userAddress = null) => {
  if (!hostEmail) {
    console.warn('Cannot send email: No host email provided');
    return false;
  }

  try {
    // Calculate fee breakdown - fees set to 0 until changed
    const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
    const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
    const totalServiceFees = cleaningFee + serviceFee; // Total fees (currently 0)
    const hostReceives = Math.max(0, (bookingData.totalAmount || 0) - totalServiceFees);

    // Format the booking details
    const bookingDetails = `
NEW BOOKING RECEIVED - Payment Confirmed!

Guest Information:
- Name: ${userName}
${userEmail ? `- Email: ${userEmail}` : ''}
${userPhone ? `- Phone/WhatsApp: ${userPhone}` : ''}
${userAddress ? `- Address: ${userAddress}` : ''}

Booking Details:
- Apartment: ${bookingData.title || 'N/A'}
- Location: ${bookingData.location || 'N/A'}
- Check-in Date: ${bookingData.checkInDate || 'N/A'}
- Check-out Date: ${bookingData.checkOutDate || 'N/A'}
- Duration: ${bookingData.numberOfDays || 1} day(s)
- Number of Guests: ${bookingData.numberOfGuests || 1}
- Payment Method: ${bookingData.paymentMethod || 'N/A'}
- Booking Date: ${new Date().toLocaleDateString()}

PAYMENT BREAKDOWN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Amount Paid by Guest: ₦${(bookingData.totalAmount || 0).toLocaleString()}

Service Fees (Taken by App): ₦${totalServiceFees.toLocaleString()}
  • Cleaning Fee: ₦${cleaningFee.toLocaleString()}
  • Service Fee: ₦${serviceFee.toLocaleString()}
  • Total Service Fee: ₦${totalServiceFees.toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AMOUNT YOU RECEIVE (Total - Fees): ₦${hostReceives.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Note: Your payment is calculated as Total Amount - Service Fees = Amount You Receive.

Please prepare your property and contact the guest using the information provided above.
`;

    const subject = 'New Booking - Your Property Has Been Booked!';
    const hostName = bookingData.hostName || 'Property Owner';
    const htmlContent = generateHostNotificationHTML(bookingData, userName, hostName, userEmail, userPhone, userAddress);

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: hostEmail,
        subject: subject,
        bookingData: bookingData,
        bookingDetails: bookingDetails,
        userName: userName,
        hostName: hostName,
      };

      // Logging handled in user email function to avoid duplicates

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_HOST_NOTIFICATION, emailPayload);
      
      if (response) {
        console.log('✅ Host notification email sent via backend API');
        return true;
      }
      // Backend returned null - try SendGrid as fallback
    } catch (apiError) {
      // Only log if it's an unexpected error (not already handled by API service)
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
      // Continue to SendGrid fallback
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send host notification email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(hostEmail, subject, htmlContent, bookingDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Host notification email failed - both backend API and SendGrid failed');
    console.error('❌ Host email that failed:', hostEmail);
    return false;
  } catch (error) {
    console.error('Error sending host booking notification email:', error);
    return false;
  }
};

/**
 * Send both user confirmation and host notification emails
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's name
 * @param {string} hostEmail - Host's email address
 * @param {object} bookingData - Booking information
 * @param {string} userPhone - User's phone/WhatsApp number (optional)
 * @param {string} userAddress - User's address (optional)
 */
export const sendBookingEmails = async (userEmail, userName, hostEmail, bookingData, userPhone = null, userAddress = null) => {
  try {
    console.log('📧 Starting to send booking confirmation emails...');
    console.log('📧 User email:', userEmail);
    console.log('📧 Host email:', hostEmail);
    console.log('📧 User name:', userName);
    console.log('📧 Booking ID:', bookingData?.id || 'N/A');
    console.log('📧 Booking data:', {
      title: bookingData?.title,
      location: bookingData?.location,
      checkInDate: bookingData?.checkInDate,
      totalAmount: bookingData?.totalAmount,
    });

    if (!userEmail) {
      console.error('❌ Cannot send emails: User email is missing');
      return { userEmailSent: false, hostEmailSent: false };
    }

    if (!hostEmail) {
      console.warn('⚠️ Host email is missing - will only send user confirmation');
    }
    
    if (!bookingData) {
      console.error('❌ Cannot send emails: Booking data is missing');
      return { userEmailSent: false, hostEmailSent: false };
    }

    // Send emails in parallel
    // Note: topUpAmount and newBalance can be passed if wallet was topped up during booking
    const [userEmailSent, hostEmailSent] = await Promise.allSettled([
      sendUserBookingConfirmationEmail(userEmail, bookingData, userName, null, null),
      hostEmail ? sendHostBookingNotificationEmail(hostEmail, bookingData, userName, userEmail, userPhone, userAddress) : Promise.resolve(false),
    ]);

    // Check for errors in the promises
    if (userEmailSent.status === 'rejected') {
      console.error('❌ User email promise rejected:', userEmailSent.reason);
    }
    if (hostEmailSent.status === 'rejected') {
      console.error('❌ Host email promise rejected:', hostEmailSent.reason);
    }

    const result = {
      userEmailSent: userEmailSent.status === 'fulfilled' && userEmailSent.value === true,
      hostEmailSent: hostEmailSent.status === 'fulfilled' && hostEmailSent.value === true,
    };

    // Log results clearly
    if (result.userEmailSent && result.hostEmailSent) {
      console.log('✅ Booking confirmation emails sent successfully to both user and host');
    } else if (result.userEmailSent) {
      console.log('✅ User confirmation email sent successfully');
      if (hostEmail) {
        console.warn('⚠️ Host notification email failed to send');
      }
    } else if (result.hostEmailSent) {
      console.warn('⚠️ User confirmation email failed to send');
      console.log('✅ Host notification email sent successfully');
    } else {
      console.error('❌ Both emails failed to send');
      console.error('❌ Check console for detailed error messages above');
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending booking emails:', error);
    console.error('Error stack:', error.stack);
    return {
      userEmailSent: false,
      hostEmailSent: false,
    };
  }
};

/**
 * Generate HTML email template for payment request
 */
const generatePaymentRequestHTML = (bookingData, userName) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: #FFFFFF; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .amount { color: #FF9800; font-size: 1.2em; font-weight: bold; }
          .action-button { background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Request</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>The host has requested payment for your booking. Please confirm the payment in the app to release the funds to the host.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Apartment:</span> ${bookingData.title || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Location:</span> ${bookingData.location || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-in:</span> ${bookingData.checkInDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Amount:</span> <span class="amount">₦${(bookingData.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
            
            <p><strong>Action Required:</strong> Please open the app and confirm the payment to release the funds to the host.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Send payment request email to user
 * @param {string} userEmail - User's email address
 * @param {object} bookingData - Booking information
 * @param {string} userName - User's name (optional)
 */
export const sendPaymentRequestEmail = async (userEmail, bookingData, userName = 'Valued Customer') => {
  if (!userEmail) {
    console.warn('Cannot send email: No user email provided');
    return false;
  }

  try {
    const receiptDetails = `
Payment Request Details:
- Apartment: ${bookingData.title || 'N/A'}
- Location: ${bookingData.location || 'N/A'}
- Check-in: ${bookingData.checkInDate || 'N/A'}
- Amount: ₦${(bookingData.totalAmount || 0).toLocaleString()}
- Action: Please confirm payment in the app
`;

    const subject = 'Payment Request - Action Required';
    const htmlContent = generatePaymentRequestHTML(bookingData, userName);

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: userEmail,
        subject: subject,
        bookingData: bookingData,
        receiptDetails: receiptDetails,
        userName: userName,
        emailType: 'payment_request',
      };

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_BOOKING_CONFIRMATION, emailPayload);
      
      if (response) {
        console.log('✅ Payment request email sent via backend API');
        return true;
      }
    } catch (apiError) {
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send payment request email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(userEmail, subject, htmlContent, receiptDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Payment request email failed - both backend API and SendGrid failed');
    return false;
  } catch (error) {
    console.error('Error sending payment request email:', error);
    return false;
  }
};

/**
 * Generate HTML email template for payment confirmation
 */
const generatePaymentConfirmationHTML = (bookingData, hostName) => {
  // Fees set to 0 until changed
  const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
  const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
  const totalServiceFees = cleaningFee + serviceFee; // Total fees (currently 0)
  const hostReceives = Math.max(0, (bookingData.totalAmount || 0) - totalServiceFees);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: #FFFFFF; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .amount { color: #4CAF50; font-size: 1.2em; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Confirmed!</h1>
          </div>
          <div class="content">
            <p>Dear ${hostName},</p>
            <p>Great news! The guest has confirmed payment for your booking. The funds have been released to your wallet.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Apartment:</span> ${bookingData.title || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Location:</span> ${bookingData.location || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Check-in:</span> ${bookingData.checkInDate || 'N/A'}
              </div>
              <div class="detail-row">
                <span class="label">Amount Received:</span> <span class="amount">₦${hostReceives.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Total Amount:</span> ₦${(bookingData.totalAmount || 0).toLocaleString()}
              </div>
              ${totalServiceFees > 0 ? `<div class="detail-row">
                <span class="label">Service Fee:</span> -₦${totalServiceFees.toLocaleString()}
              </div>` : ''}
            </div>
            
            <p><strong>Next Steps:</strong> You can now withdraw the funds from your wallet to your bank account.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Send booking cancellation email to host
 * @param {string} hostEmail - Host's email address
 * @param {object} bookingData - Booking information
 * @param {string} guestName - Guest's name (optional)
 * @param {string} reason - Reason for cancellation (optional)
 */
export const sendBookingCancellationEmail = async (hostEmail, bookingData, guestName = 'Guest', reason = 'Payment declined by guest') => {
  if (!hostEmail) {
    console.warn('Cannot send email: No host email provided');
    return false;
  }

  try {
    const bookingDetails = `
BOOKING CANCELLED

Guest Information:
- Name: ${guestName}
${bookingData.guestEmail ? `- Email: ${bookingData.guestEmail}` : ''}

Booking Details:
- Apartment: ${bookingData.title || 'N/A'}
- Location: ${bookingData.location || 'N/A'}
- Check-in Date: ${bookingData.checkInDate || 'N/A'}
- Check-out Date: ${bookingData.checkOutDate || 'N/A'}
- Duration: ${bookingData.numberOfDays || 1} day(s)
- Number of Guests: ${bookingData.numberOfGuests || 1}
- Total Amount: ₦${(bookingData.totalAmount || 0).toLocaleString()}

Cancellation Reason:
${reason}

The guest has declined to confirm payment, and the booking has been cancelled. The payment held in escrow will be refunded to the guest.

If you have any questions, please contact support.
`;

    const subject = 'Booking Cancelled - Payment Declined';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #F44336; color: #FFFFFF; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .reason { background-color: #FFEBEE; padding: 15px; margin: 10px 0; border-left: 4px solid #F44336; }
            .footer { text-align: center; padding: 20px; color: #777; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Dear Host,</p>
              <p>We regret to inform you that the booking for your property has been cancelled.</p>
              
              <div class="details">
                <h3>Guest Information:</h3>
                <p><strong>Name:</strong> ${guestName}</p>
                ${bookingData.guestEmail ? `<p><strong>Email:</strong> ${bookingData.guestEmail}</p>` : ''}
                
                <h3>Booking Details:</h3>
                <p><strong>Apartment:</strong> ${bookingData.title || 'N/A'}</p>
                <p><strong>Location:</strong> ${bookingData.location || 'N/A'}</p>
                <p><strong>Check-in:</strong> ${bookingData.checkInDate || 'N/A'}</p>
                <p><strong>Check-out:</strong> ${bookingData.checkOutDate || 'N/A'}</p>
                <p><strong>Total Amount:</strong> ₦${(bookingData.totalAmount || 0).toLocaleString()}</p>
              </div>
              
              <div class="reason">
                <h3>Cancellation Reason:</h3>
                <p>${reason}</p>
              </div>
              
              <p>The guest has declined to confirm payment, and the booking has been cancelled. The payment held in escrow will be refunded to the guest.</p>
              
              <p>If you have any questions, please contact support.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: hostEmail,
        subject: subject,
        bookingData: bookingData,
        receiptDetails: bookingDetails,
        guestName: guestName,
        reason: reason,
      };

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_HOST_NOTIFICATION, emailPayload);
      
      if (response) {
        console.log('✅ Booking cancellation email sent via backend API');
        return true;
      }
    } catch (apiError) {
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send cancellation email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(hostEmail, subject, htmlContent, bookingDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Cancellation email failed - both backend API and SendGrid failed');
    return false;
  } catch (error) {
    console.error('Error sending booking cancellation email:', error);
    return false;
  }
};

/**
 * Send payment confirmation email to host
 * @param {string} hostEmail - Host's email address
 * @param {object} bookingData - Booking information
 * @param {string} guestName - Guest's name (optional)
 */
export const sendPaymentConfirmationEmail = async (hostEmail, bookingData, guestName = 'Guest') => {
  if (!hostEmail) {
    console.warn('Cannot send email: No host email provided');
    return false;
  }

  try {
    // Fees set to 0 until changed
    const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
    const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
    const totalServiceFees = cleaningFee + serviceFee; // Total fees (currently 0)
    const hostReceives = Math.max(0, (bookingData.totalAmount || 0) - totalServiceFees);
    
    const receiptDetails = `
Payment Confirmation Details:
- Apartment: ${bookingData.title || 'N/A'}
- Location: ${bookingData.location || 'N/A'}
- Check-in: ${bookingData.checkInDate || 'N/A'}
- Guest: ${guestName}
- Amount Received: ₦${hostReceives.toLocaleString()}
- Total Amount: ₦${(bookingData.totalAmount || 0).toLocaleString()}
${totalServiceFees > 0 ? `- Service Fee: -₦${totalServiceFees.toLocaleString()}` : ''}
`;

    const subject = 'Payment Confirmed - Funds Released to Your Wallet';
    const hostName = bookingData.hostName || 'Property Owner';
    const htmlContent = generatePaymentConfirmationHTML(bookingData, hostName);

    // Try to use backend API first if available
    try {
      const { api } = await import('../services/api');
      const { API_ENDPOINTS } = await import('../config/api');
      
      const emailPayload = {
        to: hostEmail,
        subject: subject,
        bookingData: bookingData,
        receiptDetails: receiptDetails,
        guestName: guestName,
        hostName: hostName,
        emailType: 'payment_confirmation',
      };

      const response = await api.post(API_ENDPOINTS.EMAIL.SEND_HOST_NOTIFICATION, emailPayload);
      
      if (response) {
        console.log('✅ Payment confirmation email sent via backend API');
        return true;
      }
    } catch (apiError) {
      if (apiError?.status !== 500 && apiError?.status !== 401 && apiError?.status !== 403) {
        console.error('❌ Backend API email endpoint error:', apiError?.message || 'Unknown error');
      }
    }

    // Fallback to SendGrid if backend API is not available
    console.log('📧 Backend API unavailable, attempting to send payment confirmation email via SendGrid...');
    const sendGridSuccess = await sendEmailViaSendGrid(hostEmail, subject, htmlContent, receiptDetails);
    
    if (sendGridSuccess) {
      return true;
    }

    console.error('❌ Payment confirmation email failed - both backend API and SendGrid failed');
    return false;
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    return false;
  }
};

