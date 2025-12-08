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
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getEscrowByBooking, confirmPayment, isCheckInDateReached, refundEscrowPayment, declinePayment } from '../utils/escrow';
import { updateBookingStatus } from '../utils/bookings';
import { sendPaymentConfirmationEmail, sendBookingCancellationEmail } from '../utils/emailService';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UserBookingDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { booking } = route.params || {};
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [canConfirmPayment, setCanConfirmPayment] = useState(false);
  const [paymentRequestCountdown, setPaymentRequestCountdown] = useState(0); // Countdown in seconds
  const [showRequestRefund, setShowRequestRefund] = useState(false); // Show refund button after countdown expires
  const [showDeclineButton, setShowDeclineButton] = useState(false); // Show decline button on second request
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Load escrow information
  useEffect(() => {
    const loadEscrowAndCountdown = async () => {
      if (!booking || !booking.id) {
        setLoading(false);
        return;
      }

      try {
        const escrowEntry = await getEscrowByBooking(booking.id);
        setEscrow(escrowEntry);

        // Check if user can confirm payment
        // Support both 'requested' and 'payment_requested' status formats
        const isPaymentRequested = escrowEntry && (
          escrowEntry.status === 'requested' || 
          escrowEntry.status === 'payment_requested'
        );
        
        // Check if this is the second payment request (shows decline button)
        const isSecondRequest = escrowEntry && escrowEntry.paymentRequestAttempts >= 2;
        setShowDeclineButton(isSecondRequest && isPaymentRequested);
        
        // Check payment request countdown on initial load
        const countdownKey = `payment_request_countdown_${booking.id}`;
        const countdownEndTime = await AsyncStorage.getItem(countdownKey);
        
        let countdownRemaining = 0;
        if (countdownEndTime) {
          const endTime = parseInt(countdownEndTime, 10);
          const now = Date.now();
          countdownRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
          setPaymentRequestCountdown(countdownRemaining);
        } else {
          setPaymentRequestCountdown(0);
        }
        
        if (isPaymentRequested && booking.checkInDate) {
          // Use the utility function to check if check-in date has been reached
          const checkInReached = isCheckInDateReached(booking.checkInDate);
          
          // Debug logging
          console.log('UserBookingDetails - Payment confirmation check:', {
            checkInDate: booking.checkInDate,
            checkInReached,
            escrowStatus: escrowEntry?.status,
            isPaymentRequested,
            paymentRequestAttempts: escrowEntry?.paymentRequestAttempts,
            countdownRemaining,
            hasCountdown: !!countdownEndTime
          });
          
          if (checkInReached) {
            // If countdown exists and is active, show confirm button
            // If countdown expired, show refund button instead
            if (countdownRemaining > 0) {
              setCanConfirmPayment(true);
              setShowRequestRefund(false);
            } else if (countdownRemaining === 0 && isPaymentRequested) {
              // Countdown expired - show refund button
              setShowRequestRefund(true);
              setCanConfirmPayment(false);
            } else {
              // Payment requested but countdown not set yet - show confirm button
              setCanConfirmPayment(true);
              setShowRequestRefund(false);
            }
          } else {
            setCanConfirmPayment(false);
            setShowRequestRefund(false);
          }
        } else {
          // Also check if check-in date is reached even if payment hasn't been requested yet
          // This allows the button to show when check-in date arrives
          if (booking.checkInDate) {
            const checkInReached = isCheckInDateReached(booking.checkInDate);
            console.log('UserBookingDetails - Check-in date check (no payment requested):', {
              checkInDate: booking.checkInDate,
              checkInReached,
              escrowStatus: escrowEntry?.status
            });
            
            // If check-in date is reached but payment not requested, still allow confirmation
            // (in case escrow exists but status is pending)
            if (checkInReached && escrowEntry && escrowEntry.status === 'pending') {
              setCanConfirmPayment(false); // Can't confirm if payment not requested
            } else {
              setCanConfirmPayment(checkInReached && isPaymentRequested);
            }
          } else {
            setCanConfirmPayment(false);
          }
          setShowRequestRefund(false);
        }
      } catch (error) {
        console.error('Error loading escrow and countdown:', error);
        setCanConfirmPayment(false);
        setShowRequestRefund(false);
      } finally {
        setLoading(false);
      }
    };

    loadEscrowAndCountdown();
    
    // Refresh when screen comes into focus (user navigates to this screen)
    useFocusEffect(
      React.useCallback(() => {
        loadEscrowAndCountdown();
      }, [booking?.id])
    );
    
    // Set up countdown timer to check payment request countdown
    const countdownTimer = setInterval(async () => {
      if (!booking || !booking.id) {
        return;
      }
      
      // Check payment request countdown
      const countdownKey = `payment_request_countdown_${booking.id}`;
      try {
        const countdownEndTime = await AsyncStorage.getItem(countdownKey);
        
        // Always check escrow status to detect new payment requests
        const currentEscrow = await getEscrowByBooking(booking.id);
        const isPaymentRequested = currentEscrow && (
          currentEscrow.status === 'payment_requested' || 
          currentEscrow.status === 'requested'
        );
        
        // Update escrow state if it changed
        if (currentEscrow && currentEscrow.status !== escrow?.status) {
          setEscrow(currentEscrow);
          
          // Check if this is the second payment request (shows decline button)
          const isSecondRequest = currentEscrow.paymentRequestAttempts >= 2;
          setShowDeclineButton(isSecondRequest && isPaymentRequested);
        }
        
        if (countdownEndTime) {
          const endTime = parseInt(countdownEndTime, 10);
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
          
          if (remaining > 0) {
            setPaymentRequestCountdown(remaining);
            setShowRequestRefund(false); // Hide refund button while countdown is active
            
            // If countdown is active and payment is requested, ensure confirm button is visible
            if (isPaymentRequested && booking.checkInDate && isCheckInDateReached(booking.checkInDate)) {
              setCanConfirmPayment(true);
            }
          } else {
            setPaymentRequestCountdown(0);
            // Countdown expired - check if payment was requested
            if (isPaymentRequested) {
              // Payment was requested but not confirmed - show refund button
              setShowRequestRefund(true);
              setCanConfirmPayment(false);
            } else {
              setShowRequestRefund(false);
              setCanConfirmPayment(false);
            }
          }
        } else {
          setPaymentRequestCountdown(0);
          
          // Check if payment was just requested (countdown might not be set yet)
          if (isPaymentRequested && booking.checkInDate && isCheckInDateReached(booking.checkInDate)) {
            setCanConfirmPayment(true);
            setShowRequestRefund(false);
          } else if (!isPaymentRequested) {
            setShowRequestRefund(false);
            setCanConfirmPayment(false);
          }
        }
      } catch (error) {
        console.error('Error checking countdown:', error);
      }
    }, 1000);
    
    return () => clearInterval(countdownTimer);
  }, [booking]);

  const handleRequestRefund = async () => {
    if (requestingRefund || !escrow || !booking) {
      return;
    }

    Alert.alert(
      'Request Refund',
      'Are you sure you want to request a refund? This will cancel the booking and refund your payment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Refund',
          style: 'default',
          onPress: async () => {
            try {
              setRequestingRefund(true);
              
              // Refund escrow payment
              await refundEscrowPayment(user?.email || '', booking.id);
              
              // Update booking status
              if (user?.email) {
                await updateBookingStatus(user.email, booking.id, 'Refunded');
              }
              
              Alert.alert(
                'Refund Requested',
                'Your refund request has been processed. The booking has been cancelled.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error requesting refund:', error);
              Alert.alert('Error', error.message || 'Failed to request refund. Please try again.');
            } finally {
              setRequestingRefund(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclinePayment = async () => {
    if (declining || !escrow || !booking) {
      return;
    }

    const hostEmail = booking.hostEmail || escrow.hostEmail;
    if (!hostEmail) {
      Alert.alert('Error', 'Host email not found');
      return;
    }

    Alert.alert(
      'Decline Payment',
      'Are you sure you want to decline payment? This will cancel the booking and the host will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeclining(true);
              
              // Decline payment and cancel booking
              await declinePayment(
                user?.email || '',
                booking.id,
                hostEmail,
                'Payment declined by guest'
              );
              
              // Send cancellation email to host
              try {
                await sendBookingCancellationEmail(
                  hostEmail,
                  {
                    ...booking,
                    totalAmount: escrow.amount,
                  },
                  user?.name || 'Guest',
                  'Payment declined by guest'
                );
              } catch (emailError) {
                console.error('Error sending cancellation email:', emailError);
                // Don't fail the decline if email fails
              }
              
              Alert.alert(
                'Payment Declined',
                'The booking has been cancelled. The host has been notified and will receive an email with the cancellation details.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error declining payment:', error);
              Alert.alert('Error', error.message || 'Failed to decline payment. Please try again.');
            } finally {
              setDeclining(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmPayment = async () => {
    if (!canConfirmPayment || !escrow || confirming) {
      return;
    }

    Alert.alert(
      'Confirm Payment',
      `Are you sure you want to confirm payment of ${formatPrice(escrow.amount)} to the host? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              setConfirming(true);

              // Confirm payment and release escrow
              const hostEmail = booking.hostEmail || escrow.hostEmail;
              if (!hostEmail) {
                throw new Error('Host email not found');
              }

              await confirmPayment(booking.id, hostEmail);

              // Clear payment request countdown since payment is confirmed
              const countdownKey = `payment_request_countdown_${booking.id}`;
              await AsyncStorage.removeItem(countdownKey);
              setPaymentRequestCountdown(0);

              // Update booking status
              if (user?.email) {
                await updateBookingStatus(user.email, booking.id, 'payment_confirmed');
              }

              // Send confirmation email to host
              try {
                await sendPaymentConfirmationEmail(
                  hostEmail,
                  {
                    ...booking,
                    totalAmount: escrow.amount,
                  },
                  user?.name || 'Guest'
                );
              } catch (emailError) {
                console.error('Error sending confirmation email:', emailError);
                // Don't fail the payment if email fails
              }

              Alert.alert(
                'Payment Confirmed',
                'Payment has been released to the host. They will receive a notification.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Reload escrow to show updated status
                      getEscrowByBooking(booking.id).then(setEscrow);
                      setCanConfirmPayment(false);
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error confirming payment:', error);
              Alert.alert('Error', error.message || 'Failed to confirm payment. Please try again.');
            } finally {
              setConfirming(false);
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

  const getStatusColor = (status, escrowStatus) => {
    if (escrowStatus === 'requested') {
      return '#FF9800';
    }
    if (escrowStatus === 'confirmed' || escrowStatus === 'released') {
      return '#4CAF50';
    }
    if (escrowStatus === 'pending') {
      return '#2196F3';
    }
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'payment_confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status, escrowStatus) => {
    if (escrowStatus === 'requested') {
      return 'Payment Requested';
    }
    if (escrowStatus === 'confirmed' || escrowStatus === 'released') {
      return 'Payment Confirmed';
    }
    if (escrowStatus === 'pending') {
      return 'Payment in Escrow';
    }
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'payment_confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
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

  if (loading) {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </View>
    );
  }

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
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status, escrow?.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(booking.status, escrow?.status) }]}>
                  {getStatusText(booking.status, escrow?.status)}
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
              <Text style={styles.detailLabel}>Total Amount:</Text>
              <Text style={styles.detailValue}>
                {formatPrice(escrow?.amount || booking.totalAmount || 0)}
              </Text>
            </View>
            {escrow && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Status:</Text>
                <Text style={styles.detailValue}>
                  {escrow.status === 'pending' && 'In Escrow'}
                  {escrow.status === 'requested' && 'Payment Requested by Host'}
                  {escrow.status === 'confirmed' && 'Payment Confirmed'}
                  {escrow.status === 'released' && 'Payment Released to Host'}
                </Text>
              </View>
            )}
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

        {/* Confirm Payment Button - Show when check-in date is reached */}
        {booking.checkInDate && isCheckInDateReached(booking.checkInDate) && (
          <View style={styles.confirmPaymentSection}>
            {/* Show refund button if countdown expired and payment was requested but not confirmed */}
            {showRequestRefund && escrow && (escrow.status === 'requested' || escrow.status === 'payment_requested') ? (
              <>
                <View style={styles.infoCard}>
                  <MaterialIcons name="info-outline" size={20} color="#FF9800" />
                  <Text style={styles.infoText}>
                    The payment request time has expired. You can request a refund or wait for the host to request payment again.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.requestRefundButton, requestingRefund && styles.requestRefundButtonDisabled]}
                  onPress={handleRequestRefund}
                  disabled={requestingRefund}
                >
                  {requestingRefund ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="money-off" size={24} color="#FFFFFF" />
                      <Text style={styles.requestRefundButtonText}>Request Refund</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : escrow && (escrow.status === 'requested' || escrow.status === 'payment_requested') ? (
              canConfirmPayment ? (
                <>
                  {(paymentRequestCountdown > 0 || escrow?.status === 'payment_requested' || escrow?.status === 'requested') && (
                    <View style={styles.countdownCard}>
                      <MaterialIcons name="timer" size={24} color="#FF9800" />
                      <View style={styles.countdownContent}>
                        <Text style={styles.countdownLabel}>Time remaining to confirm payment:</Text>
                        <Text style={styles.countdownTime}>
                          {paymentRequestCountdown > 0 ? formatTimeRemaining(paymentRequestCountdown) : 'Loading...'}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.infoCard}>
                    <MaterialIcons name="info-outline" size={20} color="#FF9800" />
                    <Text style={styles.infoText}>
                      {paymentRequestCountdown > 0 
                        ? `The host has requested payment. Please confirm within ${formatTimeRemaining(paymentRequestCountdown)} to release the funds.`
                        : 'The check-in date has arrived. Please confirm payment to release the funds to the host\'s wallet.'}
                    </Text>
                  </View>
                  
                  {/* Show both Decline and Confirm buttons on second request */}
                  {showDeclineButton ? (
                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={[styles.declinePaymentButton, declining && styles.declinePaymentButtonDisabled]}
                        onPress={handleDeclinePayment}
                        disabled={declining}
                      >
                        {declining ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialIcons name="cancel" size={24} color="#FFFFFF" />
                            <Text style={styles.declinePaymentButtonText}>Decline Payment</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.confirmPaymentButton,
                          (confirming || paymentRequestCountdown === 0) && styles.confirmPaymentButtonDisabled
                        ]}
                        onPress={handleConfirmPayment}
                        disabled={confirming || paymentRequestCountdown === 0}
                      >
                        {confirming ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                            <Text style={styles.confirmPaymentButtonText}>
                              {paymentRequestCountdown === 0 ? 'Time Expired' : 'Confirm Payment'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.confirmPaymentButton,
                        (confirming || (paymentRequestCountdown === 0 && escrow && (escrow.status === 'payment_requested' || escrow.status === 'requested'))) && styles.confirmPaymentButtonDisabled
                      ]}
                      onPress={handleConfirmPayment}
                      disabled={confirming || (paymentRequestCountdown === 0 && escrow && (escrow.status === 'payment_requested' || escrow.status === 'requested'))}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
                          <Text style={styles.confirmPaymentButtonText}>
                            {paymentRequestCountdown === 0 ? 'Time Expired' : 'Confirm Payment'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.infoCard}>
                  <MaterialIcons name="schedule" size={20} color="#2196F3" />
                  <Text style={styles.infoText}>
                    Check-in date has arrived. Waiting for host to request payment.
                  </Text>
                </View>
              )
            ) : escrow && escrow.status === 'pending' ? (
              <View style={styles.infoCard}>
                <MaterialIcons name="info-outline" size={20} color="#2196F3" />
                <Text style={styles.infoText}>
                  Check-in date has arrived. Your payment is in escrow. The host can request payment release.
                </Text>
              </View>
            ) : (
              <View style={styles.infoCard}>
                <MaterialIcons name="info-outline" size={20} color="#2196F3" />
                <Text style={styles.infoText}>
                  Check-in date has arrived. Waiting for payment request from host.
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Show message if check-in date hasn't been reached yet */}
        {booking.checkInDate && !isCheckInDateReached(booking.checkInDate) && escrow && (escrow.status === 'requested' || escrow.status === 'payment_requested') && (
          <View style={styles.confirmPaymentSection}>
            <View style={styles.infoCard}>
              <MaterialIcons name="schedule" size={20} color="#2196F3" />
              <Text style={styles.infoText}>
                Payment confirmation will be available on the check-in date: {formatDate(booking.checkInDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Info messages */}
        {escrow?.status === 'pending' && booking.checkInDate && (
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Your payment is held in escrow. The host can request payment on the check-in date: {formatDate(booking.checkInDate)}
            </Text>
          </View>
        )}

        {escrow?.status === 'confirmed' || escrow?.status === 'released' ? (
          <View style={styles.infoCard}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>
              Payment has been confirmed and released to the host.
            </Text>
          </View>
        ) : null}

        {/* Information Text at Bottom */}
        <View style={styles.bottomInfoContainer}>
          <Text style={styles.bottomInfoText}>
            You can only confirm booking on check in dates.
          </Text>
        </View>
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
  confirmPaymentSection: {
    padding: 16,
    paddingTop: 0,
  },
  confirmPaymentButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  confirmPaymentButtonDisabled: {
    opacity: 0.6,
  },
  confirmPaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
  bottomInfoContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  bottomInfoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  declinePaymentButton: {
    flex: 1,
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  declinePaymentButtonDisabled: {
    opacity: 0.6,
  },
  declinePaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestRefundButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  requestRefundButtonDisabled: {
    opacity: 0.6,
  },
  requestRefundButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

