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

export default function HostBookingDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { booking } = route.params || {};
  const [requestDisabled, setRequestDisabled] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [canRequestPayment, setCanRequestPayment] = useState(false);

  // Check if current date >= check-in date and load request state
  useEffect(() => {
    if (!booking || !booking.id) {
      return;
    }

    const checkPaymentEligibility = async () => {
      if (!booking.checkInDate) {
        setCanRequestPayment(false);
        return;
      }

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkIn = new Date(booking.checkInDate);
        checkIn.setHours(0, 0, 0, 0);

        // Check if check-in date has arrived
        if (today >= checkIn) {
          setCanRequestPayment(true);

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

    checkPaymentEligibility();

    // Update cooldown timer every second - checks AsyncStorage for THIS booking's cooldown
    const timer = setInterval(async () => {
      if (!booking || !booking.id) {
        return;
      }

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
    if (requestDisabled || !canRequestPayment || !booking || !booking.id) {
      return;
    }

    try {
      // Show notification
      Alert.alert(
        'Payment Request',
        'Payment will be made available in a bit.',
        [{ text: 'OK' }]
      );

      // Set 2-minute cooldown for THIS SPECIFIC BOOKING ONLY
      // Each booking uses its own unique key: payment_request_cooldown_{booking.id}
      const cooldownDuration = 2 * 60 * 1000; // 2 minutes in milliseconds
      const cooldownEndTime = Date.now() + cooldownDuration;
      const cooldownKey = `payment_request_cooldown_${booking.id}`;

      // Store cooldown end time for THIS booking only
      await AsyncStorage.setItem(cooldownKey, cooldownEndTime.toString());
      
      console.log(`✅ Payment request cooldown set for booking ${booking.id} until ${new Date(cooldownEndTime).toLocaleTimeString()}`);

      // Update state for THIS booking's button only
      setRequestDisabled(true);
      setCooldownRemaining(120); // 120 seconds = 2 minutes
    } catch (error) {
      console.error('Error requesting payment:', error);
      Alert.alert('Error', 'Failed to request payment. Please try again.');
    }
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

  const hostReceives = booking.hostPaymentAmount || (booking.totalAmount - 5500);

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
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service Fee (-₦5,500):</Text>
              <Text style={[styles.detailValue, styles.serviceFee]}>
                -{formatPrice(5500)}
              </Text>
            </View>
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
              disabled={requestDisabled}
            >
              <MaterialIcons 
                name={requestDisabled ? "timer" : "payment"} 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={styles.requestPaymentButtonText}>
                {requestDisabled 
                  ? `Request Payment (${formatTimeRemaining(cooldownRemaining)})` 
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

        {!canRequestPayment && booking.checkInDate && (
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              Payment request will be available on check-in date: {formatDate(booking.checkInDate)}
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
});

