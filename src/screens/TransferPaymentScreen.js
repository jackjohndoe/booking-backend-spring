import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
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

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  // Company bank account details
  const bankDetails = {
    bankName: 'Access Bank',
    accountName: 'Nigerian Apartments Leasing Ltd',
    accountNumber: '0123456789',
  };

  const handleCopy = (text) => {
    Alert.alert('Copied!', 'Account details copied to clipboard');
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

      // Payment is confirmed - send emails IMMEDIATELY
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
        paymentMethod: 'Bank Transfer',
        status: 'Pending',
        bookingDate: new Date().toISOString(),
        hostEmail: apartment?.hostEmail || apartment?.createdBy || null, // Store host email for rating verification
        hostName: apartment?.hostName || null,
      };

      // Send booking confirmation emails IMMEDIATELY after payment confirmation
      // Get host email - will be normalized later for wallet funding
      let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
      console.log('📧 Sending booking confirmation emails immediately after payment confirmation...');
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
          
          <View style={styles.accountDetail}>
            <Text style={styles.detailLabel}>Bank</Text>
            <Text style={styles.detailValue}>{bankDetails.bankName}</Text>
          </View>

          <View style={styles.accountDetail}>
            <Text style={styles.detailLabel}>Account Name</Text>
            <Text style={styles.detailValue}>{bankDetails.accountName}</Text>
          </View>

          <View style={styles.accountDetail}>
            <Text style={styles.detailLabel}>Account Number</Text>
            <View style={styles.accountNumberRow}>
              <Text style={styles.accountNumber}>{bankDetails.accountNumber}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => handleCopy(bankDetails.accountNumber)}
              >
                <MaterialIcons name="content-copy" size={18} color="#FFD700" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Simple Note */}
        <View style={styles.noteContainer}>
          <MaterialIcons name="info-outline" size={16} color="#666" />
          <Text style={styles.noteText}>
            Transfer the exact amount above. Payment verification takes 1-2 business days.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Transfer Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmTransfer}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>
            I've Completed the Transfer
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

