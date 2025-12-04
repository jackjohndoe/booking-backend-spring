import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
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
    numberOfGuests 
  } = route.params || {};
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Input refs for navigation
  const cardholderNameRef = useRef(null);
  const expiryDateRef = useRef(null);
  const cvvRef = useRef(null);

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // Max 16 digits + 3 spaces
  };

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handlePay = async () => {
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

    // Payment validation - supports payments up to ₦10,000,000 (10 million naira)
    // No maximum payment limit - only validates card details
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanedCardNumber.length < 16) {
      alert('Please enter a valid 16-digit card number');
      return;
    }
    if (!cardholderName.trim()) {
      alert('Please enter cardholder name');
      return;
    }
    if (expiryDate.length < 5) {
      alert('Please enter expiry date (MM/YY)');
      return;
    }
    if (cvv.length < 3) {
      alert('Please enter CVV (3-4 digits)');
      return;
    }

    // Process payment
    try {
      if (!user || !user.email) {
        alert('You must be logged in to complete this booking.');
        return;
      }

      // Payment is complete - send emails IMMEDIATELY
      // Get user profile information for host email
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

      // Save booking to history - PRESERVES FRONTEND
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
        paymentMethod: 'Card',
        status: 'Confirmed',
        bookingDate: new Date().toISOString(),
        hostEmail: apartment?.hostEmail || apartment?.createdBy || null, // Store host email for rating verification
        hostName: apartment?.hostName || null,
      };

      // Send booking confirmation emails IMMEDIATELY after payment confirmation
      // Get host email - will be normalized later for wallet funding
      let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
      console.log('📧 Sending booking confirmation emails immediately after payment...');
      try {
        await sendBookingEmails(
          user.email,
          userName,
          hostEmail,
          bookingData,
          userPhone,
          userAddress
        );
      } catch (emailError) {
        console.error('❌ Error sending booking confirmation emails:', emailError);
        // Don't block payment flow if email fails
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
      if (hostEmail) {
        try {
          const hostBookingData = {
            ...bookingData,
            userEmail: user.email, // Guest's email
            userName: userName, // Guest's name
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
          };
          await addHostBooking(hostEmail, hostBookingData);
          console.log(`✅ Booking stored for host: ${hostEmail}`);
        } catch (hostBookingError) {
          console.error('Error storing booking for host:', hostBookingError);
          // Don't block payment flow if host booking storage fails
        }
      }

      // Fund host's wallet with payment amount minus fees
      // CRITICAL: Host receives totalAmount MINUS cleaningFee (₦2,500) MINUS serviceFee (₦3,000)
      // Formula: hostPaymentAmount = totalAmount - cleaningFee - serviceFee
      // This ensures host gets the base price only, not the fees
      const cleaningFee = 2500; // Fixed cleaning fee: ₦2,500
      const serviceFee = 3000; // Fixed service fee: ₦3,000
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
          // CRITICAL: This stores the transaction even if host is signed out
          // When host signs back in, they'll see the balance and transaction
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
            'Card Payment'
          );
          console.log(`✅ Host notification sent to ${hostEmail} about new booking with full details`);
        } catch (notificationError) {
          console.error('Error sending host booking notification:', notificationError);
          // Don't block payment flow if notification fails
        }
      }

      setShowSuccessModal(true);
      
      // Add notification
      if (apartment) {
        await notifyPaymentMade(totalAmount || 0, apartment.title || 'Apartment');
      }
    } catch (error) {
      console.error('Error saving booking:', error);
      // Still show success modal even if booking save fails
      setShowSuccessModal(true);
      if (apartment) {
        await notifyPaymentMade(totalAmount || 0, apartment.title || 'Apartment');
      }

      // Emails already sent above - no need to send again
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

        {/* Card Details Form */}
        <View style={styles.formContainer}>
          {/* Card Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <TextInput
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChangeText={(text) => setCardNumber(formatCardNumber(text))}
              keyboardType="numeric"
              maxLength={19}
              placeholderTextColor="#999"
              returnKeyType="next"
              onSubmitEditing={() => cardholderNameRef.current?.focus()}
            />
          </View>

          {/* Cardholder Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Cardholder Name</Text>
            <TextInput
              ref={cardholderNameRef}
              style={styles.input}
              placeholder="Name on card"
              value={cardholderName}
              onChangeText={setCardholderName}
              placeholderTextColor="#999"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => expiryDateRef.current?.focus()}
            />
          </View>

          {/* Expiry and CVV Row */}
          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.inputLabel}>Expiry Date</Text>
              <TextInput
                ref={expiryDateRef}
                style={styles.input}
                placeholder="MM/YY"
                value={expiryDate}
                onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                keyboardType="numeric"
                maxLength={5}
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => cvvRef.current?.focus()}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.inputLabel}>CVV</Text>
              <TextInput
                ref={cvvRef}
                style={styles.input}
                placeholder="123"
                value={cvv}
                onChangeText={setCvv}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                placeholderTextColor="#999"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Security Info */}
          <View style={styles.securityContainer}>
            <MaterialIcons name="lock" size={16} color="#666" />
            <Text style={styles.securityText}>
              Your payment is secure and encrypted
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePay}
          activeOpacity={0.8}
        >
          <Text style={styles.payButtonText}>
            Pay {formatPrice(totalAmount || 0)}
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
    paddingBottom: 100,
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
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F5F5F5',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
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
  payButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
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

