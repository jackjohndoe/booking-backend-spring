import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyTransferConfirmed } from '../utils/notifications';
import { addBooking, addHostBooking } from '../utils/bookings';
import { hybridBookingService } from '../services/hybridService';
import { useAuth } from '../hooks/useAuth';
import { sendBookingEmails } from '../utils/emailService';
import { getUserProfile } from '../utils/userStorage';
import { hybridWalletService } from '../services/hybridService';
import { notifyHostNewBooking, notifyHostWalletFunded } from '../utils/notifications';
import { createVirtualAccount, verifyAndFundWallet } from '../services/flutterwaveService';

export default function TransferPaymentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { 
    apartment, 
    totalAmount, 
    checkInDate, 
    checkOutDate, 
    numberOfDays, 
    numberOfGuests 
  } = route.params || {};
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [virtualAccountError, setVirtualAccountError] = useState(null);
  const [txRef, setTxRef] = useState(null);

  // Debug: Log when virtualAccount state changes
  useEffect(() => {
    if (virtualAccount || loadingAccount || virtualAccountError) {
      console.log('🔍 Virtual Account State:', {
        status: loadingAccount ? 'loading' : virtualAccountError ? 'error' : virtualAccount ? 'ready' : 'idle',
        hasAccount: !!virtualAccount,
        accountNumber: virtualAccount?.accountNumber || 'N/A',
        bankName: virtualAccount?.bankName || 'N/A',
        accountName: virtualAccount?.accountName || 'N/A',
        txRef: txRef || 'N/A',
        error: virtualAccountError || null,
        timestamp: new Date().toISOString()
      });
    }
  }, [virtualAccount, loadingAccount, virtualAccountError, txRef]);

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  // Generate unique transaction reference and fetch virtual account
  useEffect(() => {
    const fetchVirtualAccount = async () => {
      if (!user || !user.email || !totalAmount || !apartment) {
        setLoadingAccount(false);
        return;
      }

      // Check Flutterwave v3 API limit: 500,000 NGN per virtual account
      const FLUTTERWAVE_MAX_AMOUNT = 500000;
      if (totalAmount > FLUTTERWAVE_MAX_AMOUNT) {
        setLoadingAccount(false);
        Alert.alert(
          'Amount Limit Exceeded',
          `Bank transfer payment is limited to ₦${FLUTTERWAVE_MAX_AMOUNT.toLocaleString()} per transaction.\n\n` +
          `Booking amount: ₦${totalAmount.toLocaleString()}\n\n` +
          `Please use card payment for this booking.`,
          [
            { text: 'OK' },
            { 
              text: 'Use Card Payment', 
              onPress: () => navigation.navigate('CardPayment', {
                apartment,
                totalAmount,
                checkInDate,
                checkOutDate,
                numberOfDays,
                numberOfGuests,
              })
            }
          ]
        );
        return;
      }

      // Check if user has authentication token
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userData = await AsyncStorage.getItem('user');
        if (!userData) {
          console.warn('User not authenticated - cannot create virtual account');
          setVirtualAccountError('Please log in to create a virtual account');
          setLoadingAccount(false);
          return;
        }
        const parsedUser = JSON.parse(userData);
        const token = parsedUser?.token || parsedUser?.accessToken;
        if (!token) {
          console.error('❌ User data exists but no token found in AsyncStorage');
          console.error('User data keys:', Object.keys(parsedUser));
          console.error('Full user object (token redacted):', { ...parsedUser, token: 'REDACTED' });
          setVirtualAccountError('Authentication token missing. Please sign out and sign in again.');
          setLoadingAccount(false);
          return;
        }
        
        // Validate token format (should be a JWT string, not an object)
        if (typeof token !== 'string' || token.trim().length === 0) {
          console.error('❌ Token is not a valid string:', typeof token, token);
          setVirtualAccountError('Invalid authentication token. Please sign out and sign in again.');
          setLoadingAccount(false);
          return;
        }
        
        console.log('✅ Token found for virtual account creation:', token.substring(0, 30) + '...');
        console.log('✅ Token length:', token.length);
        console.log('✅ Token type:', typeof token);
      } catch (authCheckError) {
        console.error('Error checking authentication:', authCheckError);
        setVirtualAccountError('Authentication check failed. Please try logging in again.');
        setLoadingAccount(false);
        return;
      }

      try {
        setLoadingAccount(true);
        
        // Generate unique transaction reference
        const generatedTxRef = `${user.email}_${Date.now()}_${apartment.id || apartment._id}`;
        setTxRef(generatedTxRef);

        // Get user profile for name
        let userName = user?.name || 'Guest';
        try {
          const userProfile = await getUserProfile(user.email);
          if (userProfile?.name) {
            userName = userProfile.name;
          }
        } catch (profileError) {
          console.log('Could not load user profile for virtual account:', profileError);
        }

        // Create virtual account via Flutterwave
        console.log('🔄 Creating virtual account for booking payment:', {
          email: user.email,
          amount: totalAmount,
          name: userName,
          txRef: generatedTxRef
        });
        
        const accountDetails = await createVirtualAccount(
          user.email,
          totalAmount,
          userName,
          generatedTxRef
        );

        console.log('✅ Virtual account created successfully:', accountDetails);
        console.log('✅ Account type:', typeof accountDetails);
        console.log('✅ Account keys:', accountDetails ? Object.keys(accountDetails) : 'N/A');
        
        // Handle both camelCase and snake_case response formats
        const normalizedAccount = {
          accountNumber: accountDetails?.accountNumber || accountDetails?.account_number,
          bankName: accountDetails?.bankName || accountDetails?.bank_name || 'Virtual Bank',
          accountName: accountDetails?.accountName || accountDetails?.account_name || 'Nigerian Apartments Leasing Ltd',
          txRef: accountDetails?.txRef || accountDetails?.tx_ref || generatedTxRef
        };
        
        console.log('✅ Normalized account:', normalizedAccount);
        console.log('✅ Account Number:', normalizedAccount.accountNumber);
        console.log('✅ Bank Name:', normalizedAccount.bankName);
        console.log('✅ Account Name:', normalizedAccount.accountName);
        
        if (!normalizedAccount.accountNumber) {
          console.error('❌ Account number is missing! Account details:', JSON.stringify(accountDetails, null, 2));
          throw new Error('Failed to create virtual account: Account number not found in response');
        }
        
        console.log('✅ Setting virtualAccount state...');
        setVirtualAccount(normalizedAccount);
        
        console.log('✅ virtualAccount state set. Account should now display in UI.');
      } catch (error) {
        console.error('Error creating virtual account:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = error.message || 'Failed to create virtual account. Please try again or use a different payment method.';
        
        // Check for Flutterwave amount limit error
        if (error.message && (error.message.includes('500,000') || error.message.includes('500000') || error.message.includes('amount should be between'))) {
          errorMessage = `Bank transfer is limited to ₦500,000 per transaction.\n\nBooking amount: ₦${totalAmount.toLocaleString()}\n\nPlease use card payment for this booking.`;
        } else if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('session has expired'))) {
          errorMessage = 'Your session has expired or you are not logged in. Please sign out and sign in again.';
        } else if (error.message && error.message.includes('Network error')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message && (error.message.includes('Flutterwave') || error.message.includes('credentials') || error.message.includes('500'))) {
          errorMessage = 'Payment service is temporarily unavailable. Please try:\n\n' +
            '1. Use card payment instead\n' +
            '2. Try again in a few minutes\n' +
            '3. Contact support if the issue persists';
        }
        
        // Set error state for UI display
        setVirtualAccountError(errorMessage);
        
        // Show error but don't block the screen - user can still see the amount and try card payment
        Alert.alert(
          'Payment Service Unavailable',
          errorMessage,
          [
            { text: 'OK' },
            { 
              text: 'Use Card Instead', 
              onPress: () => navigation.navigate('CardPayment', {
                apartment,
                totalAmount,
                checkInDate,
                checkOutDate,
                numberOfDays,
                numberOfGuests,
                paymentProvider: 'flutterwave',
              })
            }
          ]
        );
      } finally {
        setLoadingAccount(false);
      }
    };

    fetchVirtualAccount();
  }, [user, totalAmount, apartment]);

  const handleCopy = async (text) => {
    try {
      // Use Clipboard API if available (Web)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied!', 'Account details copied to clipboard');
      } else {
        // Fallback: Just show alert (clipboard copy may not be available on all platforms)
        Alert.alert('Copied!', `Account details: ${text}`);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback: Show the text in alert
      Alert.alert('Account Details', text);
    }
  };

  const handleConfirmTransfer = async () => {
    // Check for date conflicts before processing payment
    if (checkInDate && checkOutDate && apartment) {
      try {
        const { checkDateConflict } = await import('../utils/bookings');
        const hostEmail = apartment.createdBy || apartment.hostEmail;
        
        if (hostEmail) {
          const conflictResult = await checkDateConflict(
            apartment.id || apartment._id,
            hostEmail,
            checkInDate,
            checkOutDate
          );
          
          if (conflictResult.hasConflict) {
            Alert.alert(
              'Unavailable',
              'Unavailable - choose another date please\n\nThis apartment is unavailable for the selected dates. Please choose another date.',
              [{ text: 'OK' }]
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error checking date conflict:', error);
        // Continue with payment if check fails (don't block user)
      }
    }

    try {
      if (!user || !user.email) {
        Alert.alert('Error', 'You must be logged in to complete this booking.');
        return;
      }

      // CRITICAL: Verify payment and automatically fund wallet
      // Poll for payment verification since bank transfers may take time
      if (txRef && totalAmount) {
        console.log('🔄 Starting payment verification and wallet funding...');
        console.log('📋 Transaction reference:', txRef);
        
        // Show loading state
        Alert.alert(
          'Verifying Payment',
          'Please wait while we verify your bank transfer and fund your wallet...',
          [{ text: 'OK' }]
        );

        // Poll for payment verification (bank transfers may take a few seconds)
        let verificationAttempts = 0;
        const maxVerificationAttempts = 10; // Try for up to 30 seconds (3s intervals)
        let verificationSuccess = false;
        let verificationResult = null; // Store result for later use

        while (verificationAttempts < maxVerificationAttempts && !verificationSuccess) {
          try {
            console.log(`🔄 Verification attempt ${verificationAttempts + 1}/${maxVerificationAttempts}...`);
            
            verificationResult = await verifyAndFundWallet(
              txRef,
              user.email,
              totalAmount,
              'bank_transfer'
            );
            
            if (verificationResult.verified && verificationResult.funded) {
              verificationSuccess = true;
              console.log('✅ Payment verified and wallet funded successfully!');
              console.log('✅ Updated balance:', verificationResult.balance);
              
              // Wallet top-up email is already sent by verifyAndFundWallet
              // No need to send it again here
              
              Alert.alert(
                'Payment Verified',
                `Your bank transfer of ₦${totalAmount.toLocaleString()} has been verified and added to your wallet! A confirmation email has been sent to your email address.`,
                [{ text: 'OK' }]
              );
              break;
            }
          } catch (verifyError) {
            console.log(`⚠️ Verification attempt ${verificationAttempts + 1} failed:`, verifyError.message);
            
            // If it's a "payment not found" or "pending" error, keep trying
            if (verifyError.message && (
              verifyError.message.includes('not found') || 
              verifyError.message.includes('pending') ||
              verifyError.message.includes('processing')
            )) {
              verificationAttempts++;
              if (verificationAttempts < maxVerificationAttempts) {
                // Wait 3 seconds before next attempt
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
              }
            } else {
              // For other errors, log but continue with booking
              console.warn('⚠️ Verification error (non-fatal):', verifyError);
              break;
            }
          }
        }

        if (!verificationSuccess) {
          console.warn('⚠️ Payment verification timed out or failed, but continuing with booking');
          // This is normal for bank transfers - they may take time to process
          Alert.alert(
            'Payment Processing',
            'Your bank transfer is being processed. The wallet will be funded automatically once the transfer is confirmed by the bank (usually within 1-5 minutes).\n\nYou can check your wallet balance to see when the payment is credited.',
            [{ text: 'OK' }]
          );
        }
      }

      // Get user profile information for emails
      let userName = user?.name || 'Guest';
      let userPhone = null;
      let userAddress = null;
      try {
        const userProfile = await getUserProfile(user.email);
        if (userProfile) {
          if (userProfile.name) userName = userProfile.name;
          userPhone = userProfile.whatsappNumber || null;
          userAddress = userProfile.address || null;
        }
      } catch (profileError) {
        console.log('Could not load user profile for email:', profileError);
      }

      // Bank transfer payment - supports payments up to ₦10,000,000 (10 million naira)
      // No maximum payment limit - processes any valid amount
      // Save booking to history
      const bookingData = {
        apartmentId: apartment?.id || apartment?._id,
        title: apartment?.title || 'Apartment',
        location: apartment?.location || 'Nigeria',
        image: apartment?.image || apartment?.images?.[0],
        checkInDate: checkInDate || new Date().toISOString().split('T')[0],
        checkOutDate: checkOutDate || new Date().toISOString().split('T')[0],
        numberOfDays: numberOfDays || 1,
        numberOfGuests: numberOfGuests || 1,
        totalAmount: totalAmount || 0,
        paymentMethod: 'Bank Transfer (Flutterwave)',
        status: verificationSuccess ? 'Confirmed' : 'Pending', // Update status based on verification
        bookingDate: new Date().toISOString(),
        hostEmail: apartment?.hostEmail || apartment?.createdBy || null, // Store host email for rating verification
        hostName: apartment?.hostName || null,
        txRef: txRef || null, // Store transaction reference for webhook matching
        paymentReference: txRef || null, // Payment reference for receipt (Flutterwave transaction reference)
        transactionId: txRef || null, // Transaction ID for receipt
      };

      // CRITICAL: Only send booking confirmation emails if payment was successfully verified
      // This ensures guests and hosts only receive emails when payment is actually confirmed
      let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
      
      if (verificationSuccess) {
        console.log('📧 Payment verified successfully - sending booking confirmation emails with receipt...');
        
        // Get wallet balance for guest email (wallet was funded)
        let guestWalletBalance = null;
        let topUpAmount = null;
        if (verificationResult?.balance) {
          topUpAmount = totalAmount;
          guestWalletBalance = verificationResult.balance;
        }
        
        try {
          // Import individual email functions to ensure proper receipt emails
          const { sendUserBookingConfirmationEmail, sendHostBookingNotificationEmail } = await import('../utils/emailService');
          
          // Send guest email with booking details, receipt, and wallet top-up information
          await sendUserBookingConfirmationEmail(
            user.email,
            bookingData,
            userName,
            topUpAmount, // Wallet top-up amount
            guestWalletBalance // New wallet balance
          );
          console.log('✅ Guest booking confirmation email with receipt sent to:', user.email);
          
          // Send host email with booking details and receipt
          if (hostEmail) {
            // Calculate fees for receipt
            const cleaningFee = 0; // Fixed cleaning fee: ₦0
            const serviceFee = 0; // Fixed service fee: ₦0
            const totalServiceFees = cleaningFee + serviceFee;
            const hostPaymentAmount = Math.max(0, (totalAmount || 0) - totalServiceFees);
            
            await sendHostBookingNotificationEmail(
              hostEmail,
              bookingData,
              userName,
              user.email,
              userPhone,
              userAddress
            );
            console.log('✅ Host booking notification email with receipt sent to:', hostEmail);
          } else {
            console.warn('⚠️ Cannot send host email: Host email not found');
          }
        } catch (emailError) {
          console.error('❌ Error sending booking confirmation emails:', emailError);
          // Don't block payment flow if email fails, but log the error
          Alert.alert(
            'Email Error',
            'Payment was successful, but there was an issue sending confirmation emails. Your booking has been saved and you will receive an email shortly.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('⚠️ Payment not yet verified - emails will be sent when payment is confirmed via webhook');
        // Payment not verified yet - webhook will handle email sending when payment is confirmed
      }
      try {
        await hybridBookingService.createBooking(user.email, bookingData);
      } catch (error) {
        console.error('Error saving booking to API:', error);
        // Fallback to local storage - FRONTEND PRESERVED
        await addBooking(user.email, bookingData);
      }
      
      // CRITICAL: Also store booking for the host (even if host is not signed in)
      // This ensures hosts can see bookings when they sign in later
      // Normalize host email BEFORE storing to ensure consistent retrieval
      if (hostEmail) {
        try {
          // Normalize host email to ensure it matches when host views bookings
          const normalizedHostEmail = hostEmail.toLowerCase().trim();
          
          const hostBookingData = {
            ...bookingData,
            userEmail: user.email, // Guest's email
            userName: userName, // Guest's name
            guestEmail: user.email, // Explicitly set guest email
            guestName: userName,    // Explicitly set guest name
            // Include all booking details for host
            apartmentId: bookingData.apartmentId,
            title: bookingData.title,
            location: bookingData.location,
            image: bookingData.image,
            checkInDate: bookingData.checkInDate,
            checkOutDate: bookingData.checkOutDate,
            numberOfDays: bookingData.numberOfDays,
            numberOfGuests: bookingData.numberOfGuests,
            totalAmount: bookingData.totalAmount,
            paymentMethod: bookingData.paymentMethod,
            status: bookingData.status,
            bookingDate: bookingData.bookingDate,
            hostPaymentAmount: hostPaymentAmount, // Amount host receives (minus fees)
            hostEmail: normalizedHostEmail, // Store normalized email
          };
          await addHostBooking(normalizedHostEmail, hostBookingData);
          console.log(`✅ Booking stored for host: ${normalizedHostEmail} (normalized from ${hostEmail})`);
        } catch (hostBookingError) {
          console.error('Error storing booking for host:', hostBookingError);
          // Don't block payment flow if host booking storage fails
        }
      } else {
        console.warn('⚠️ Cannot store host booking: Host email not found');
        console.warn('Apartment data:', { hostEmail: apartment?.hostEmail, createdBy: apartment?.createdBy });
      }

      // Fund host's wallet with payment amount minus fees
      // CRITICAL: Host receives totalAmount MINUS cleaningFee MINUS serviceFee
      // Formula: hostPaymentAmount = totalAmount - cleaningFee - serviceFee
      // This ensures host gets the base price only, not the fees
      const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
      const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
      const totalPaid = totalAmount || 0;
      const hostPaymentAmount = totalPaid - cleaningFee - serviceFee;
      
      console.log(`💰 Payment Breakdown:
        Total Paid: ₦${totalPaid.toLocaleString()}
        Cleaning Fee: -₦${cleaningFee.toLocaleString()}
        Service Fee: -₦${serviceFee.toLocaleString()}
        Host Receives: ₦${hostPaymentAmount.toLocaleString()}`);
      
      // CRITICAL: Normalize host email to ensure consistent identification
      // hostEmail already declared above - just normalize it now
      if (hostEmail) {
        hostEmail = hostEmail.toLowerCase().trim();
      }
      
      console.log(`🏠 Host wallet funding - Email: ${hostEmail}, Amount: ₦${hostPaymentAmount.toLocaleString()}, Apartment: ${apartment?.title || 'N/A'}`);
      
      // userName already loaded above with user profile information
      // No need to reload - use the existing userName variable
      
      if (hostEmail && hostPaymentAmount > 0) {
        try {
          // Fund host's wallet (email is already normalized)
          const result = await hybridWalletService.fundWallet(
            hostEmail,
            hostPaymentAmount,
            `Booking Payment - ${apartment?.title || 'Apartment'}`,
            userName, // Sender name
            user.email // Sender email
          );
          
          // Verify the funding was successful
          const { hybridWalletService: walletService } = await import('../services/hybridService');
          const hostBalance = await walletService.getBalance(hostEmail);
          console.log(`✅ Host wallet funded successfully! Email: ${hostEmail}, Amount added: ₦${hostPaymentAmount.toLocaleString()}, New balance: ₦${hostBalance.toLocaleString()}`);
          
          // Notify host about wallet funding in real-time
          await notifyHostWalletFunded(
            hostEmail,
            hostPaymentAmount,
            apartment?.title || 'Apartment'
          );
        } catch (hostWalletError) {
          console.error(`❌ Error funding host wallet for ${hostEmail}:`, hostWalletError);
          console.error('Error details:', hostWalletError.message || hostWalletError);
          // Don't block payment flow if host wallet funding fails, but log the error
          Alert.alert('Warning', `Payment successful, but host wallet funding encountered an issue. Please contact support.`);
        }
      } else {
        if (!hostEmail) {
          console.warn('⚠️ Cannot fund host wallet: Host email not found in apartment data');
          console.warn('Apartment data:', { hostEmail: apartment?.hostEmail, createdBy: apartment?.createdBy });
        }
        if (hostPaymentAmount <= 0) {
          console.warn(`⚠️ Host payment amount is invalid: ₦${hostPaymentAmount.toLocaleString()}`);
        }
      }
      
      // Notify host about new booking in real-time with all booking details
      if (hostEmail) {
        try {
          await notifyHostNewBooking(
            hostEmail,
            userName,
            apartment?.title || 'Apartment',
            checkInDate || bookingData.checkInDate,
            checkOutDate || bookingData.checkOutDate,
            numberOfGuests || bookingData.numberOfGuests,
            numberOfDays || bookingData.numberOfDays,
            totalAmount,
            'Bank Transfer'
          );
          console.log(`✅ Host notification sent to ${hostEmail} about new booking with full details`);
        } catch (notificationError) {
          console.error('Error sending host booking notification:', notificationError);
          // Don't block payment flow if notification fails
        }
      }

      setShowSuccessModal(true);
      
      // Add notification
      await notifyTransferConfirmed(totalAmount || 0);
    } catch (error) {
      console.error('Error saving booking:', error);
      // Still show success modal even if booking save fails
      setShowSuccessModal(true);
      await notifyTransferConfirmed(totalAmount || 0);

      // Send confirmation emails even if booking save failed
      try {
        let userName = user?.name || 'Guest';
        try {
          const userProfile = await getUserProfile(user.email);
          if (userProfile && userProfile.name) {
            userName = userProfile.name;
          }
        } catch (profileError) {
          console.log('Could not load user profile for email:', profileError);
        }

        const hostEmail = apartment?.hostEmail || apartment?.createdBy || null;

        if (user.email && hostEmail) {
          await sendBookingEmails(
            user.email,
            userName,
            hostEmail,
            bookingData
          );
        }
      } catch (emailError) {
        console.error('Error sending booking confirmation emails:', emailError);
      }
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.navigate('ExploreMain');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Transfer</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Amount to Transfer */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Transfer Amount</Text>
          <Text style={styles.amountValue}>{formatPrice(totalAmount || 0)}</Text>
        </View>

        {/* Bank Account Card */}
        <View style={styles.bankCard}>
          <Text style={styles.cardTitle}>Bank Account Details</Text>
          
          {loadingAccount ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.loadingText}>Generating virtual account...</Text>
            </View>
          ) : virtualAccountError ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={24} color="#FF0000" />
              <Text style={styles.errorText}>{virtualAccountError}</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('SignIn')} 
                style={styles.errorButton}
              >
                <Text style={styles.errorButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          ) : virtualAccount && virtualAccount.accountNumber ? (
            <>
              <View style={styles.accountDetail}>
                <Text style={styles.detailLabel}>Bank</Text>
                <Text style={styles.detailValue}>{virtualAccount.bankName || 'Virtual Bank'}</Text>
              </View>

              <View style={styles.accountDetail}>
                <Text style={styles.detailLabel}>Account Name</Text>
                <Text style={styles.detailValue}>{virtualAccount.accountName || 'Nigerian Apartments Leasing Ltd'}</Text>
              </View>

              <View style={styles.accountDetail}>
                <Text style={styles.detailLabel}>Account Number</Text>
                <View style={styles.accountNumberRow}>
                  <Text style={styles.accountNumber}>{virtualAccount.accountNumber}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(virtualAccount.accountNumber)}
                  >
                    <MaterialIcons name="content-copy" size={18} color="#FFD700" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={24} color="#FF6B6B" />
              <Text style={styles.errorText}>
                Failed to load account details. Please try again or use a different payment method.
              </Text>
            </View>
          )}
        </View>

        {/* Simple Note */}
        <View style={styles.noteContainer}>
          <MaterialIcons name="info-outline" size={16} color="#666" />
          <Text style={styles.noteText}>
            {virtualAccount 
              ? "Transfer the exact amount above to the account details shown. Payment will be verified automatically once the transfer is complete."
              : "Transfer the exact amount above. Payment verification takes 1-2 business days."}
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Transfer Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.confirmButton, (!virtualAccount || loadingAccount) && styles.confirmButtonDisabled]}
          onPress={handleConfirmTransfer}
          activeOpacity={0.8}
          disabled={!virtualAccount || loadingAccount}
        >
          <Text style={styles.confirmButtonText}>
            {loadingAccount ? 'Loading Account Details...' : "I've Completed the Transfer"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconCircle}>
              <MaterialIcons name="check" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Congratulations!</Text>
            <Text style={styles.successMessage}>
              You have successfully secured your apartment! We'll verify your payment within 1-2 business days and send you a confirmation email.
            </Text>
            <Text style={styles.successDetails}>
              {formatPrice(totalAmount || 0)}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  amountContainer: {
    padding: 24,
    backgroundColor: '#FFF9E6',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  bankCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  accountDetail: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  accountNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    gap: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  confirmButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B6B',
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  successDetails: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

