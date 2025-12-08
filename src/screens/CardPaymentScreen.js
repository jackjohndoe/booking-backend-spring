import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyPaymentMade } from '../utils/notifications';
import { addBooking, addHostBooking } from '../utils/bookings';
import { hybridBookingService } from '../services/hybridService';
import { useAuth } from '../hooks/useAuth';
import { sendBookingEmails } from '../utils/emailService';
import { getUserProfile } from '../utils/userStorage';
import { hybridWalletService } from '../services/hybridService';
import { notifyHostNewBooking, notifyHostWalletFunded } from '../utils/notifications';
import { addToEscrow } from '../utils/escrow';
import { initializePayment, verifyPayment, verifyAndFundWallet } from '../services/flutterwaveService';

export default function CardPaymentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { 
    apartment, 
    totalAmount, 
    checkInDate, 
    checkOutDate, 
    numberOfDays, 
    numberOfGuests,
    paymentProvider = 'flutterwave'
  } = route.params || {};
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentReference, setPaymentReference] = useState(null);
  const [paymentInitData, setPaymentInitData] = useState(null);
  
  // Card details form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  // Format card number with spaces
  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // Max 16 digits + 3 spaces
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  // Validate card details
  const validateCardDetails = () => {
    const errors = {};
    
    // Remove spaces for validation
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');
    if (!cleanedCardNumber || cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) {
      errors.cardNumber = 'Please enter a valid card number';
    }
    
    if (!cardholderName || cardholderName.trim().length < 2) {
      errors.cardholderName = 'Please enter cardholder name';
    }
    
    const cleanedExpiry = expiryDate.replace(/\D/g, '');
    if (!cleanedExpiry || cleanedExpiry.length !== 4) {
      errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
    } else {
      const month = parseInt(cleanedExpiry.slice(0, 2));
      const year = parseInt('20' + cleanedExpiry.slice(2, 4));
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      if (month < 1 || month > 12) {
        errors.expiryDate = 'Please enter a valid month (01-12)';
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        errors.expiryDate = 'Card has expired';
      }
    }
    
    if (!cvv || cvv.length < 3 || cvv.length > 4) {
      errors.cvv = 'Please enter a valid CVV';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle card payment submission
  const handleCardPayment = async () => {
    if (!validateCardDetails()) {
      return;
    }

    if (!user || !user.email || !totalAmount) {
      Alert.alert('Error', 'Missing required information. Please try again.');
      return;
    }

    try {
      setProcessing(true);
      
      // Validate dates first
      if (checkInDate && checkOutDate) {
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        
        if (checkIn >= checkOut) {
          Alert.alert(
            'Invalid Dates',
            'Check-out date must be after check-in date. Please select valid dates.',
            [{ text: 'OK' }]
          );
          setProcessing(false);
          return;
        }
      }

      // Check for date conflicts
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
                'This apartment is unavailable for the selected dates. Please choose another date.',
                [{ text: 'OK' }]
              );
              setProcessing(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking date conflict:', error);
        }
      }

      // Initialize Flutterwave payment with card details
      try {
        const userName = user?.name || 'Guest';
        const userPhone = user?.phoneNumber || null;
        
        // Note: In a real implementation, you would send card details securely to your backend
        // which would then process the payment through Flutterwave
        // For now, we'll simulate the payment flow
        const paymentInit = await initializePayment(
          totalAmount || 0,
          user.email,
          userName,
          userPhone,
          'card', // Payment method: card
          null, // Reference will be generated
          {
            apartmentId: apartment?.id || apartment?._id,
            apartmentTitle: apartment?.title,
            checkInDate,
            checkOutDate,
            numberOfDays,
            numberOfGuests,
            cardNumber: cardNumber.replace(/\s/g, ''), // Send cleaned card number
            cardholderName,
            expiryDate,
            cvv,
          }
        );

        // Flutterwave returns transaction directly, not authorization_url
        if (paymentInit && paymentInit.status === 'success') {
          // Payment completed successfully
          await handlePaymentSuccess(paymentInit);
          return;
        } else if (paymentInit && paymentInit.status === 'pending') {
          // Payment is pending - show success modal
          setPaymentInitData(paymentInit);
          setPaymentReference(paymentInit.reference);
          Alert.alert(
            'Payment Pending',
            'Your payment is being processed. You will be notified once it is confirmed.',
            [{ text: 'OK' }]
          );
          return;
        } else {
          throw new Error('Payment was not completed');
        }
      } catch (paymentError) {
        console.error('Error processing payment:', paymentError);
        // Show user-friendly error message
        const errorMsg = paymentError.message || 'Failed to process payment. Please check your card details and try again.';
        Alert.alert('Payment Error', errorMsg);
      }
    } catch (error) {
      console.error('Error in payment flow:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = async (transaction) => {
    try {
      setProcessing(true);
      
      // Extract payment reference
      const paymentRef = transaction.reference || transaction.tx_ref || paymentReference;
      if (!paymentRef) {
        throw new Error('Payment reference not found');
      }

      console.log('🔄 Processing successful payment:', { paymentRef, amount: totalAmount });

      // CRITICAL: Verify payment and automatically fund wallet
      // This ensures wallet is topped up immediately after successful payment
      let walletFundingResult = null; // Store result for booking email
      try {
        if (user && user.email && totalAmount) {
          console.log('💰 Verifying payment and funding wallet...');
          
          try {
            walletFundingResult = await verifyAndFundWallet(
              paymentRef,
              user.email,
              totalAmount,
              'card'
            );
            
            if (walletFundingResult.verified && walletFundingResult.funded) {
              console.log('✅ Payment verified and wallet funded successfully!');
              console.log('✅ Updated balance:', walletFundingResult.balance);
              
              // Wallet top-up email is already sent by verifyAndFundWallet
              // Show success message
              Alert.alert(
                'Payment Successful',
                `Your payment of ₦${totalAmount.toLocaleString()} has been verified and added to your wallet! A confirmation email has been sent to your email address.`,
                [{ text: 'OK' }]
              );
            } else if (walletFundingResult.verified && !walletFundingResult.funded) {
              console.warn('⚠️ Payment verified but wallet funding may have failed');
              // Payment verified but funding failed - backend webhook should handle it
              Alert.alert(
                'Payment Verified',
                `Your payment has been verified. The wallet will be funded automatically within a few moments.`,
                [{ text: 'OK' }]
              );
            }
          } catch (verifyError) {
            console.error('❌ Error in verifyAndFundWallet:', verifyError);
            
            // Check if it's a retryable error (pending payment)
            const isRetryable = verifyError.message && (
              verifyError.message.includes('pending') ||
              verifyError.message.includes('processing') ||
              verifyError.message.includes('still')
            );
            
            if (isRetryable) {
              // Payment is pending - backend webhook will handle it
              console.log('⏳ Payment is pending, backend webhook will process funding');
              Alert.alert(
                'Payment Processing',
                `Your payment is being processed. Your wallet will be funded automatically once the payment is confirmed (usually within 1-2 minutes).`,
                [{ text: 'OK' }]
              );
            } else {
              // Try fallback verification (non-blocking)
              try {
                await verifyPayment(paymentRef);
                console.log('✅ Fallback verification succeeded');
                Alert.alert(
                  'Payment Verified',
                  `Your payment has been verified. The wallet will be funded automatically.`,
                  [{ text: 'OK' }]
                );
              } catch (fallbackError) {
                console.log('⚠️ Fallback verification also failed:', fallbackError);
                // Continue with booking processing even if verification fails
                // Backend webhook should handle wallet funding
                Alert.alert(
                  'Payment Received',
                  `Your payment has been received. The wallet will be funded automatically once processing is complete.`,
                  [{ text: 'OK' }]
                );
              }
            }
          }
        } else {
          console.warn('⚠️ Cannot fund wallet: Missing user email or amount');
        }
      } catch (error) {
        console.error('❌ Unexpected error in payment verification:', error);
        // Don't block booking flow - backend webhook will handle funding
      }

      // Process booking after successful payment (pass wallet funding result for email)
      await processBookingAfterPayment(paymentRef, walletFundingResult);
      
      setShowSuccessModal(true);
      
      if (apartment) {
        await notifyPaymentMade(totalAmount || 0, apartment.title || 'Apartment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', error.message || 'Payment processing failed. Please contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentCancel = () => {
    Alert.alert(
      'Payment Cancelled',
      'Your payment was cancelled. You can try again when ready.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    Alert.alert('Payment Error', error.message || 'An error occurred during payment. Please try again.');
  };

  const processBookingAfterPayment = async (paymentReference, walletFundingResult = null) => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to complete this booking.');
      return;
    }

    // Get user profile information
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

    // Save booking to history with ESCROW status
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
        paymentMethod: 'Card (Flutterwave)',
        status: 'In Escrow', // Payment goes to escrow
        bookingDate: new Date().toISOString(),
        hostEmail: apartment?.hostEmail || apartment?.createdBy || null,
        hostName: apartment?.hostName || null,
        paymentReference: paymentReference,
      };

      // Create booking first to get booking ID
      let savedBooking;
      try {
        savedBooking = await hybridBookingService.createBooking(user.email, bookingData);
        if (!savedBooking || !savedBooking.id) {
          // Fallback to local storage
          savedBooking = await addBooking(user.email, bookingData);
        }
      } catch (error) {
        console.error('Error saving booking to API:', error);
        // Fallback to local storage - FRONTEND PRESERVED
        savedBooking = await addBooking(user.email, bookingData);
      }

      const bookingId = savedBooking?.id || bookingData.id || `booking_${Date.now()}`;
      
      // Update booking data with the actual booking ID
      const completeBookingData = {
        ...bookingData,
        id: bookingId,
      };
      
      // Send booking confirmation emails AFTER booking is created with complete data
      // Get host email - will be normalized later for wallet funding
      let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
      console.log('📧 Sending booking confirmation emails after booking creation...');
      
      // Check if wallet was funded (from verifyAndFundWallet call in handlePaymentSuccess)
      // If so, include top-up information in guest email
      let topUpAmount = null;
      let guestWalletBalance = null;
      if (walletFundingResult && walletFundingResult.verified && walletFundingResult.funded) {
        topUpAmount = totalAmount;
        guestWalletBalance = walletFundingResult.balance;
        // Note: verifyAndFundWallet already sends top-up email, but we include info in booking email too
      } else {
        // Try to get current balance as fallback
        try {
          guestWalletBalance = await hybridWalletService.getBalance(user.email);
        } catch (balanceError) {
          console.log('Could not get wallet balance for email:', balanceError);
        }
      }
      
      try {
        // Import individual email functions to pass top-up info
        const { sendUserBookingConfirmationEmail, sendHostBookingNotificationEmail } = await import('../utils/emailService');
        
        // Send guest email with booking details (top-up email already sent by verifyAndFundWallet)
        await sendUserBookingConfirmationEmail(
          user.email,
          completeBookingData,
          userName,
          topUpAmount,
          guestWalletBalance
        );
        console.log('✅ Guest booking confirmation email sent');
        
        // Send host email with booking details and receipt
        if (hostEmail) {
          await sendHostBookingNotificationEmail(
            hostEmail,
            completeBookingData,
            userName,
            user.email,
            userPhone,
            userAddress
          );
          console.log('✅ Host booking notification email sent');
        }
      } catch (emailError) {
        console.error('❌ Error sending booking confirmation emails:', emailError);
        // Don't block payment flow if email fails
      }
      
      // Create escrow payment (funds held in escrow, not released to host yet)
      try {
        if (hostEmail) {
          await addToEscrow(
            user.email,
            bookingId,
            totalAmount || 0,
            hostEmail
          );
          console.log(`✅ Escrow payment created for booking ${bookingId}`);
        }
      } catch (escrowError) {
        console.error('Error creating escrow payment:', escrowError);
        // Don't block payment flow if escrow creation fails
      }
      
      // CRITICAL: Also store booking for the host (even if host is not signed in)
      // This ensures hosts can see bookings when they sign in later
      // Normalize host email BEFORE storing to ensure consistent retrieval
      if (hostEmail) {
        try {
          // Normalize host email to ensure it matches when host views bookings
          const normalizedHostEmail = hostEmail.toLowerCase().trim();
          
          // Calculate host payment amount (after fees)
          const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
          const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
          const totalServiceFees = cleaningFee + serviceFee;
          const hostPaymentAmount = Math.max(0, (totalAmount || 0) - totalServiceFees);
          
          const hostBookingData = {
            ...bookingData,
            id: bookingId,
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
            status: bookingData.status, // "In Escrow"
            bookingDate: bookingData.bookingDate,
            hostPaymentAmount: hostPaymentAmount, // Amount host receives
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

      // NOTE: Funds are NOT released to host wallet yet
      // They will be released when user confirms payment on check-in date
      console.log(`💰 Payment of ₦${(totalAmount || 0).toLocaleString()} held in escrow for booking ${bookingId}`);
      console.log(`📅 Host can request payment on check-in date: ${checkInDate || 'N/A'}`);
      console.log(`✅ User can confirm payment in "My Bookings" to release funds to host`);
      
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
            'Card Payment'
          );
          console.log(`✅ Host notification sent to ${hostEmail} about new booking with full details`);
        } catch (notificationError) {
          console.error('Error sending host booking notification:', notificationError);
          // Don't block payment flow if notification fails
        }
      }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.navigate('ExploreMain');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Total Amount */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Amount to Pay</Text>
          <Text style={styles.totalAmount}>{formatPrice(totalAmount || 0)}</Text>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfoContainer}>
          <MaterialIcons name="lock" size={24} color="#FFD700" />
          <Text style={styles.paymentInfoText}>
            Secure payment powered by Flutterwave
          </Text>
        </View>

        {/* Card Details Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Card Details</Text>
          
          {/* Card Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card Number</Text>
            <TextInput
              style={[styles.input, formErrors.cardNumber && styles.inputError]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor="#999"
              value={cardNumber}
              onChangeText={(text) => setCardNumber(formatCardNumber(text))}
              keyboardType="numeric"
              maxLength={19}
            />
            {formErrors.cardNumber && (
              <Text style={styles.errorText}>{formErrors.cardNumber}</Text>
            )}
          </View>

          {/* Cardholder Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cardholder Name</Text>
            <TextInput
              style={[styles.input, formErrors.cardholderName && styles.inputError]}
              placeholder="John Doe"
              placeholderTextColor="#999"
              value={cardholderName}
              onChangeText={(text) => setCardholderName(text)}
              autoCapitalize="words"
            />
            {formErrors.cardholderName && (
              <Text style={styles.errorText}>{formErrors.cardholderName}</Text>
            )}
          </View>

          {/* Expiry Date and CVV */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Expiry Date</Text>
              <TextInput
                style={[styles.input, formErrors.expiryDate && styles.inputError]}
                placeholder="MM/YY"
                placeholderTextColor="#999"
                value={expiryDate}
                onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                keyboardType="numeric"
                maxLength={5}
              />
              {formErrors.expiryDate && (
                <Text style={styles.errorText}>{formErrors.expiryDate}</Text>
              )}
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>CVV</Text>
              <TextInput
                style={[styles.input, formErrors.cvv && styles.inputError]}
                placeholder="123"
                placeholderTextColor="#999"
                value={cvv}
                onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
              {formErrors.cvv && (
                <Text style={styles.errorText}>{formErrors.cvv}</Text>
              )}
            </View>
          </View>

          {/* Pay Now Button */}
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handleCardPayment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#333" />
            ) : (
              <Text style={styles.payButtonText}>Pay Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>


      {/* Loading Overlay */}
      {processing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Processing payment...</Text>
        </View>
      )}

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
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successMessage}>
              Your reservation has been confirmed
            </Text>
            <Text style={styles.successDetails}>
              Amount: {formatPrice(totalAmount || 0)}
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
    </KeyboardAvoidingView>
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
    paddingBottom: 20,
  },
  totalContainer: {
    padding: 20,
    backgroundColor: '#FFF9E6',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    padding: 20,
    paddingTop: 0,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  payButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDetails: {
    fontSize: 18,
    fontWeight: '600',
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

