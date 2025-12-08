import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEscrowByBooking, requestPayment, approvePayment } from '../utils/escrow';
import { sendPaymentRequestEmail } from '../utils/emailService';
import { ESCROW_STATUS } from '../config/escrow';

export default function HostBookingDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { booking } = route.params || {};
  const [requestDisabled, setRequestDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [canRequestPayment, setCanRequestPayment] = useState(false);
  const [escrow, setEscrow] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [canApprovePayment, setCanApprovePayment] = useState(false);
  const [paymentRequestCountdown, setPaymentRequestCountdown] = useState(0); // Countdown in seconds

  // Load escrow and check payment eligibility
  useEffect(() => {
    if (!booking || !booking.id) {
      return;
    }

    const loadEscrowAndCheckEligibility = async () => {
      try {
        // Load escrow entry
        const escrowEntry = await getEscrowByBooking(booking.id);
        setEscrow(escrowEntry);

        // Check payment request countdown on initial load
        const countdownKey = `payment_request_countdown_${booking.id}`;
        const countdownEndTime = await AsyncStorage.getItem(countdownKey);
        
        if (countdownEndTime) {
          const endTime = parseInt(countdownEndTime, 10);
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
          setPaymentRequestCountdown(remaining);
        } else {
          setPaymentRequestCountdown(0);
        }

        if (!booking.checkInDate) {
          setCanRequestPayment(false);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkIn = new Date(booking.checkInDate);
        checkIn.setHours(0, 0, 0, 0);

        // Check if check-in date has arrived and escrow exists
        if (today >= checkIn && escrowEntry) {
          // Support both old and new escrow status formats
          const status = escrowEntry.status;
          if (status === ESCROW_STATUS.PENDING || status === ESCROW_STATUS.IN_ESCROW || 
              status === 'pending' || status === 'in_escrow') {
            setCanRequestPayment(true);
            setCanApprovePayment(false);
          } else if (status === ESCROW_STATUS.PAYMENT_REQUESTED || status === 'payment_requested') {
            setCanRequestPayment(false);
            setCanApprovePayment(true);
          } else {
            setCanRequestPayment(false);
            setCanApprovePayment(false);
          }

          // Check if button is in cooldown for THIS specific booking
          const cooldownKey = `payment_request_cooldown_${booking.id}`;
          const cooldownEndTime = await AsyncStorage.getItem(cooldownKey);

          if (cooldownEndTime) {
            const endTime = parseInt(cooldownEndTime, 10);
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000)); // Remaining seconds

            if (remaining > 0) {
              setRequestDisabled(true);
              setCooldownRemaining(remaining);
            } else {
              setRequestDisabled(false);
              setCooldownRemaining(0);
              // Clear expired cooldown
              await AsyncStorage.removeItem(cooldownKey);
            }
          } else {
            setRequestDisabled(false);
            setCooldownRemaining(0);
          }
        } else {
          setCanRequestPayment(false);
          setRequestDisabled(false);
          setCooldownRemaining(0);
        }
      } catch (error) {
        console.error('Error checking payment eligibility:', error);
        setCanRequestPayment(false);
      }
    };

    loadEscrowAndCheckEligibility();
    
    // Refresh when screen comes into focus
    useFocusEffect(
      React.useCallback(() => {
        if (booking && booking.id) {
          loadEscrowAndCheckEligibility();
        }
      }, [booking?.id])
    );

    // Update cooldown timer and payment request countdown every second
    const timer = setInterval(async () => {
      if (!booking || !booking.id) {
        return;
      }

      // Check payment request countdown (2-minute timer for user to approve)
      const countdownKey = `payment_request_countdown_${booking.id}`;
      const countdownEndTime = await AsyncStorage.getItem(countdownKey);

      if (countdownEndTime) {
        const endTime = parseInt(countdownEndTime, 10);
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

        if (remaining > 0) {
          setPaymentRequestCountdown(remaining);
        } else {
          setPaymentRequestCountdown(0);
          
          // If countdown expires and payment not confirmed, reset escrow status
          try {
            const currentEscrow = await getEscrowByBooking(booking.id);
            // Only reset if still in payment_requested status (not confirmed)
            if (currentEscrow && (currentEscrow.status === 'payment_requested' || currentEscrow.status === 'requested')) {
              // Reset to pending status
              const { getUserStorageKey } = await import('../utils/userStorage');
              const escrowKey = getUserStorageKey('escrowPayments', currentEscrow.userEmail || '');
              const escrowPayments = await AsyncStorage.getItem(escrowKey);
              if (escrowPayments) {
                const payments = JSON.parse(escrowPayments);
                const escrowIndex = payments.findIndex(ep => ep.bookingId === booking.id);
                if (escrowIndex !== -1) {
                  payments[escrowIndex].status = 'pending';
                  payments[escrowIndex].paymentRequestedAt = null;
                  payments[escrowIndex].paymentRequestCountdownEnd = null;
                  await AsyncStorage.setItem(escrowKey, JSON.stringify(payments));
                  await AsyncStorage.removeItem(countdownKey);
                  
                  // Reload escrow
                  const updatedEscrow = await getEscrowByBooking(booking.id);
                  setEscrow(updatedEscrow);
                  setCanRequestPayment(true);
                  setCanApprovePayment(false);
                }
              }
            } else {
              // Payment was confirmed or status changed - just clear countdown
              await AsyncStorage.removeItem(countdownKey);
            }
          } catch (error) {
            console.error('Error resetting payment request:', error);
            await AsyncStorage.removeItem(countdownKey);
          }
        }
      } else {
        setPaymentRequestCountdown(0);
      }

      // Check cooldown timer (for preventing spam requests)
      const cooldownKey = `payment_request_cooldown_${booking.id}`;
      const cooldownEndTime = await AsyncStorage.getItem(cooldownKey);

      if (cooldownEndTime) {
        const endTime = parseInt(cooldownEndTime, 10);
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

        if (remaining > 0) {
          setRequestDisabled(true);
          setCooldownRemaining(remaining);
        } else {
          setRequestDisabled(false);
          setCooldownRemaining(0);
          await AsyncStorage.removeItem(cooldownKey);
        }
      } else {
        // No cooldown for this booking - ensure button is enabled if eligible
        if (canRequestPayment) {
          setRequestDisabled(false);
          setCooldownRemaining(0);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [booking?.id, canRequestPayment]);

  const handleRequestPayment = async () => {
    if (requestDisabled || !canRequestPayment || !booking || !booking.id || requesting) {
      return;
    }

    // Support both old and new escrow status formats
    const canRequest = escrow && (
      escrow.status === ESCROW_STATUS.PENDING || 
      escrow.status === ESCROW_STATUS.IN_ESCROW ||
      escrow.status === 'pending' ||
      escrow.status === 'in_escrow'
    );
    
    if (!canRequest) {
      Alert.alert('Error', `Cannot request payment. Current escrow status: ${escrow?.status || 'unknown'}`);
      return;
    }

    Alert.alert(
      'Request Payment',
      `Request payment of ${formatPrice(escrow.amount)} from the guest? An email will be sent to notify them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          style: 'default',
          onPress: async () => {
            try {
              setRequesting(true);

              // Update escrow status to 'requested'
              await requestPayment(booking.id);

              // Send email to user
              const userEmail = escrow.userEmail || booking.guestEmail;
              if (userEmail) {
                try {
                  await sendPaymentRequestEmail(
                    userEmail,
                    {
                      ...booking,
                      totalAmount: escrow.amount,
                    },
                    booking.guestName || 'Guest'
                  );
                } catch (emailError) {
                  console.error('Error sending payment request email:', emailError);
                  // Don't fail the request if email fails
                }
              }
              
              // In-app notification is sent automatically by requestPayment function
              // No need to call it here as it's handled in escrow.js

              // Set 2-minute countdown for user to approve payment
              const countdownDuration = 2 * 60 * 1000; // 2 minutes in milliseconds
              const countdownEndTime = Date.now() + countdownDuration;
              const countdownKey = `payment_request_countdown_${booking.id}`;
              await AsyncStorage.setItem(countdownKey, countdownEndTime.toString());
              
              // Set 2-minute cooldown for THIS SPECIFIC BOOKING ONLY (to prevent spam)
              const cooldownDuration = 2 * 60 * 1000; // 2 minutes in milliseconds
              const cooldownEndTime = Date.now() + cooldownDuration;
              const cooldownKey = `payment_request_cooldown_${booking.id}`;
              await AsyncStorage.setItem(cooldownKey, cooldownEndTime.toString());

              // Reload escrow to show updated status
              const updatedEscrow = await getEscrowByBooking(booking.id);
              setEscrow(updatedEscrow);

              Alert.alert(
                'Payment Requested',
                'Payment request has been sent to the guest. They have 2 minutes to approve the payment.',
                [{ text: 'OK' }]
              );

              // Update state for THIS booking's button only
              setRequestDisabled(true);
              setCooldownRemaining(120); // 120 seconds = 2 minutes
              setPaymentRequestCountdown(120); // Start 2-minute countdown
              setCanRequestPayment(false); // Disable since status is now 'requested'
              setCanApprovePayment(true); // Enable approve payment button
            } catch (error) {
              console.error('Error requesting payment:', error);
              Alert.alert('Error', error.message || 'Failed to request payment. Please try again.');
            } finally {
              setRequesting(false);
            }
          },
        },
      ]
    );
  };

  const handleApprovePayment = async () => {
    if (approving || !booking || !booking.id || !escrow) {
      return;
    }

    // Support both old and new escrow status formats
    const canApprove = escrow.status === ESCROW_STATUS.PAYMENT_REQUESTED || escrow.status === 'payment_requested';
    if (!canApprove) {
      Alert.alert('Error', `Payment has not been requested yet. Current status: ${escrow.status}`);
      return;
    }

    Alert.alert(
      'Approve Payment',
      `Approve and release payment of ${formatPrice(escrow.amount)} to your wallet? This will transfer the funds immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              setApproving(true);

              // Approve payment and release funds
              await approvePayment(booking.id);

              // Reload escrow to show updated status
              const updatedEscrow = await getEscrowByBooking(booking.id);
              setEscrow(updatedEscrow);

              Alert.alert(
                'Payment Approved',
                `Payment of ${formatPrice(escrow.amount)} has been approved and released to your wallet.`,
                [{ text: 'OK' }]
              );

              // Update state
              setCanApprovePayment(false);
              setCanRequestPayment(false);
            } catch (error) {
              console.error('Error approving payment:', error);
              Alert.alert('Error', error.message || 'Failed to approve payment. Please try again.');
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  if (!booking) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Booking not found</Text>
        </View>
      </View>
    );
  }

  // Fees set to 0 until changed
  const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
  const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
  const totalServiceFees = cleaningFee + serviceFee; // Total fees (currently 0)
  const hostReceives = booking.hostPaymentAmount || Math.max(0, (booking.totalAmount || 0) - totalServiceFees);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Apartment Image */}
        {booking.image ? (
          <Image source={{ uri: booking.image }} style={styles.apartmentImage} />
        ) : (
          <View style={styles.apartmentImagePlaceholder}>
            <MaterialIcons name="home" size={48} color="#CCC" />
          </View>
        )}

        {/* Guest Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={24} color="#FFD700" />
            <Text style={styles.sectionTitle}>Guest Information</Text>
          </View>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name:</Text>
              <Text style={styles.detailValue}>{booking.guestName || 'Guest'}</Text>
            </View>
            {booking.guestEmail && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{booking.guestEmail}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Booking Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event-note" size={24} color="#FFD700" />
            <Text style={styles.sectionTitle}>Booking Details</Text>
          </View>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Apartment:</Text>
              <Text style={styles.detailValue}>{booking.title || 'Apartment'}</Text>
            </View>
            {booking.location && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location:</Text>
                <Text style={styles.detailValue}>{booking.location}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-in:</Text>
              <Text style={styles.detailValue}>
                {booking.checkInDate ? formatDate(booking.checkInDate) : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-out:</Text>
              <Text style={styles.detailValue}>
                {booking.checkOutDate ? formatDate(booking.checkOutDate) : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>
                {booking.numberOfDays || 1} {booking.numberOfDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Guests:</Text>
              <Text style={styles.detailValue}>
                {booking.numberOfGuests || 1} {booking.numberOfGuests === 1 ? 'guest' : 'guests'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                  {booking.status || 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="account-balance-wallet" size={24} color="#FFD700" />
            <Text style={styles.sectionTitle}>Payment Details</Text>
          </View>
          <View style={[styles.detailCard, styles.paymentCard]}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount Paid:</Text>
              <Text style={styles.detailValue}>
                {formatPrice(booking.totalAmount || 0)}
              </Text>
            </View>
            {totalServiceFees > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Fee (-₦{totalServiceFees.toLocaleString()}):</Text>
                <Text style={[styles.detailValue, styles.serviceFee]}>
                  -{formatPrice(totalServiceFees)}
                </Text>
              </View>
            )}
            <View style={[styles.detailRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Amount You Receive:</Text>
              <Text style={styles.totalValue}>
                {formatPrice(hostReceives)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method:</Text>
              <Text style={styles.detailValue}>{booking.paymentMethod || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking Date:</Text>
              <Text style={styles.detailValue}>
                {booking.bookingDate ? formatDate(booking.bookingDate) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Request Payment Button */}
        {canRequestPayment && (
          <View style={styles.requestPaymentSection}>
            <TouchableOpacity
              style={[
                styles.requestPaymentButton,
                requestDisabled && styles.requestPaymentButtonDisabled
              ]}
              onPress={handleRequestPayment}
              disabled={requestDisabled || requesting}
            >
              {requesting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons 
                  name={requestDisabled ? "timer" : "payment"} 
                  size={24} 
                  color="#FFFFFF" 
                />
              )}
              <Text style={styles.requestPaymentButtonText}>
                {requestDisabled 
                  ? `Request Payment (${formatTimeRemaining(cooldownRemaining)})` 
                  : requesting
                  ? 'Requesting...'
                  : 'Request Payment'
                }
              </Text>
            </TouchableOpacity>
            {requestDisabled && (
              <Text style={styles.cooldownText}>
                Please wait before requesting payment again
              </Text>
            )}
          </View>
        )}

        {/* Approve Payment Button - Shows when payment is requested */}
        {canApprovePayment && escrow && (escrow.status === ESCROW_STATUS.PAYMENT_REQUESTED || escrow.status === 'payment_requested') && (
          <View style={styles.requestPaymentSection}>
            {paymentRequestCountdown > 0 && (
              <View style={styles.countdownCard}>
                <MaterialIcons name="timer" size={24} color="#FF9800" />
                <View style={styles.countdownContent}>
                  <Text style={styles.countdownLabel}>Time remaining for guest to approve:</Text>
                  <Text style={styles.countdownTime}>{formatTimeRemaining(paymentRequestCountdown)}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.approvePaymentButton}
              onPress={handleApprovePayment}
              disabled={approving}
            >
              {approving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons 
                  name="check-circle" 
                  size={24} 
                  color="#FFFFFF" 
                />
              )}
              <Text style={styles.approvePaymentButtonText}>
                {approving ? 'Approving...' : 'Approve Payment'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.approvePaymentInfoText}>
              Payment has been requested. Guest has 2 minutes to confirm payment. Click to approve and release funds to your wallet.
            </Text>
          </View>
        )}

        {!canRequestPayment && !canApprovePayment && booking.checkInDate && (
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              {escrow && escrow.status === 'payment_confirmed' 
                ? 'Payment has been approved and released to your wallet.'
                : `Payment request will be available on check-in date: ${formatDate(booking.checkInDate)}`
              }
            </Text>
          </View>
        )}
      </ScrollView>
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
    backgroundColor: '#FFFFFF',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  apartmentImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F5F5',
  },
  apartmentImagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  detailCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#FFFDE7',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  serviceFee: {
    color: '#F57C00',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#FFE082',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57C00',
    flex: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F57C00',
    flex: 1,
    textAlign: 'right',
  },
  requestPaymentSection: {
    padding: 16,
    paddingTop: 0,
  },
  requestPaymentButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  requestPaymentButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  requestPaymentButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cooldownText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  approvePaymentButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approvePaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  approvePaymentInfoText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  countdownContent: {
    flex: 1,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  countdownTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
  },
});

