import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getBookings } from '../utils/bookings';
import { hybridBookingService } from '../services/hybridService';
import { getEscrowForUser } from '../utils/escrow';
import { useAuth } from '../hooks/useAuth';

export default function MyBookingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadBookings = async () => {
    try {
      if (!user || !user.email) {
        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const normalizedEmail = user.email.toLowerCase().trim();
      
      // Get user bookings (bookings where user is the guest)
      const userBookings = await hybridBookingService.getBookings(normalizedEmail);
      const mappedUserBookings = Array.isArray(userBookings) ? userBookings.map(booking => ({
        id: booking.id || booking._id || String(booking.id),
        apartmentId: booking.apartmentId || booking.apartment?.id || booking.apartmentId,
        title: booking.title || booking.apartment?.title || 'Apartment',
        location: booking.location || booking.apartment?.location || 'Nigeria',
        image: booking.image || booking.apartment?.image || booking.apartment?.images?.[0],
        checkInDate: booking.checkInDate || booking.checkIn || booking.checkInDate,
        checkOutDate: booking.checkOutDate || booking.checkOut || booking.checkOutDate,
        numberOfGuests: booking.numberOfGuests || booking.guests || 1,
        totalAmount: booking.totalAmount || booking.amount || booking.price || 0,
        paymentMethod: booking.paymentMethod || booking.payment?.method || 'Unknown',
        status: booking.status || 'Pending',
        bookingDate: booking.bookingDate || booking.createdAt || booking.date || new Date().toISOString(),
        hostEmail: booking.hostEmail || booking.apartment?.hostEmail || booking.apartment?.createdBy || null,
      })) : [];
      
      // Get escrow entries for user bookings
      let escrowEntries = [];
      try {
        escrowEntries = await getEscrowForUser(normalizedEmail);
      } catch (escrowError) {
        console.error('Error loading escrow entries:', escrowError);
        // Continue without escrow data if there's an error
      }
      const escrowMap = {};
      if (Array.isArray(escrowEntries)) {
        escrowEntries.forEach(escrow => {
          if (escrow && escrow.bookingId) {
            escrowMap[escrow.bookingId] = escrow;
          }
        });
      }
      
      // Enrich bookings with escrow status
      const enrichedBookings = mappedUserBookings.map(booking => {
        const escrow = escrowMap[booking.id];
        const escrowStatus = escrow?.status || null;
        // Check if payment can be confirmed (status is payment_requested and check-in date has arrived)
        const canConfirmPayment = (escrowStatus === 'payment_requested' || escrowStatus === 'requested') && isCheckInDate(booking.checkInDate);
        return {
          ...booking,
          escrowStatus: escrowStatus,
          escrowAmount: escrow?.amount || null,
          escrow: escrow, // Include full escrow object for details screen
          canConfirmPayment: canConfirmPayment,
        };
      });
      
      // Sort by date (most recent first)
      const sortedBookings = enrichedBookings.sort((a, b) => {
        const dateA = new Date(a.bookingDate || a.createdAt || 0);
        const dateB = new Date(b.bookingDate || b.createdAt || 0);
        return dateB - dateA;
      });
      
      setBookings(sortedBookings);
      console.log(`✅ Loaded ${sortedBookings.length} bookings for user`);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load your bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Check if check-in date has arrived
  const isCheckInDate = (checkInDate) => {
    if (!checkInDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    return today >= checkIn;
  };

  // Load bookings when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
    }, [user])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadBookings();
  }, []);

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'paid_escrow':
      case 'payment_confirmed':
        return '#4CAF50';
      case 'pending':
      case 'payment_requested':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status, escrowStatus) => {
    if (escrowStatus === 'payment_requested') {
      return 'Payment Requested';
    }
    if (escrowStatus === 'payment_confirmed' || escrowStatus === 'payment_released') {
      return 'Payment Confirmed';
    }
    if (escrowStatus === 'in_escrow') {
      return 'Payment in Escrow';
    }
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'payment confirmed':
        return 'Confirmed';
      case 'in escrow':
        return 'In Escrow';
      case 'payment requested':
        return 'Payment Requested';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const handleBookingPress = (booking) => {
    navigation.navigate('UserBookingDetails', { booking });
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
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <MaterialIcons name="event-busy" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Bookings Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your apartment bookings will appear here
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('ExploreMain')}
          >
            <Text style={styles.exploreButtonText}>Explore Apartments</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => handleBookingPress(booking)}
              activeOpacity={0.8}
            >
              {/* Booking Image */}
              {(booking.image || booking.apartmentImage) && (
                <Image
                  source={{ uri: booking.image || booking.apartmentImage }}
                  style={styles.bookingImage}
                />
              )}

              {/* Booking Info */}
              <View style={styles.bookingInfo}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingTitleContainer}>
                    <Text style={styles.bookingTitle} numberOfLines={2}>
                      {booking.title || booking.apartmentTitle || 'Apartment Booking'}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(booking.status, booking.escrowStatus) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(booking.status, booking.escrowStatus) },
                        ]}
                      >
                        {getStatusText(booking.status, booking.escrowStatus)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Location */}
                {booking.location && (
                  <View style={styles.bookingDetail}>
                    <MaterialIcons name="location-on" size={16} color="#666" />
                    <Text style={styles.bookingDetailText}>{booking.location}</Text>
                  </View>
                )}

                {/* Dates */}
                {booking.checkInDate && booking.checkOutDate && (
                  <View style={styles.bookingDetail}>
                    <MaterialIcons name="calendar-today" size={16} color="#666" />
                    <Text style={styles.bookingDetailText}>
                      {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                    </Text>
                  </View>
                )}

                {/* Guests */}
                {booking.numberOfGuests && (
                  <View style={styles.bookingDetail}>
                    <MaterialIcons name="people" size={16} color="#666" />
                    <Text style={styles.bookingDetailText}>
                      {booking.numberOfGuests} {booking.numberOfGuests === 1 ? 'guest' : 'guests'}
                    </Text>
                  </View>
                )}

                {/* Payment Method */}
                {booking.paymentMethod && (
                  <View style={styles.bookingDetail}>
                    <MaterialIcons name="payment" size={16} color="#666" />
                    <Text style={styles.bookingDetailText}>
                      Paid via {booking.paymentMethod}
                    </Text>
                  </View>
                )}

                {/* Approve Payment Button (if eligible) */}
                {booking.canConfirmPayment && (
                  <TouchableOpacity
                    style={styles.approvePaymentButton}
                    onPress={() => handleBookingPress(booking)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.approvePaymentButtonText}>
                      Approve Payment
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Payment Requested Badge (if payment requested but check-in not reached) */}
                {(booking.escrowStatus === 'payment_requested' || booking.escrowStatus === 'requested') && !booking.canConfirmPayment && (
                  <View style={styles.confirmPaymentContainer}>
                    <View style={styles.confirmPaymentBadge}>
                      <MaterialIcons name="payment" size={16} color="#FF9800" />
                      <Text style={styles.confirmPaymentText}>
                        Payment Requested - Available on check-in date
                      </Text>
                    </View>
                  </View>
                )}

                {/* Amount and Date */}
                <View style={styles.bookingFooter}>
                  <View>
                    <Text style={styles.bookingAmount}>
                      {booking.totalAmount ? formatPrice(booking.totalAmount) : 'N/A'}
                    </Text>
                    <Text style={styles.bookingDate}>
                      Booked on {formatDate(booking.bookingDate || booking.createdAt || booking.date)}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#999" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
    backgroundColor: '#FFFFFF',
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
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  exploreButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bookingCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bookingImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  bookingInfo: {
    padding: 16,
  },
  bookingHeader: {
    marginBottom: 12,
  },
  bookingTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  bookingDetailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  confirmPaymentContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  confirmPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 8,
  },
  confirmPaymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    flex: 1,
  },
  approvePaymentButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  approvePaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  bookingAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 12,
    color: '#999',
  },
});
