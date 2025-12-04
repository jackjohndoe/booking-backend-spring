import React, { useState, useEffect } from 'react';
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
import { getBookings, deleteBooking, getHostBookings, deleteHostBooking } from '../utils/bookings';
import { hybridBookingService } from '../services/hybridService';
import { useAuth } from '../hooks/useAuth';

export default function BookingHistoryScreen() {
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
      
      // Load both user bookings (as guest) and host bookings (as host)
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
        bookingType: 'guest', // Mark as guest booking
      })) : [];
      
      // Get host bookings (bookings where user is the host)
      const hostBookings = await getHostBookings(normalizedEmail);
      const mappedHostBookings = Array.isArray(hostBookings) ? hostBookings.map(booking => ({
        id: booking.id || String(booking.id),
        apartmentId: booking.apartmentId,
        title: booking.title || 'Apartment',
        location: booking.location || 'Nigeria',
        image: booking.image,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        numberOfGuests: booking.numberOfGuests || 1,
        totalAmount: booking.totalAmount || 0,
        hostPaymentAmount: booking.hostPaymentAmount || 0, // Amount host receives
        paymentMethod: booking.paymentMethod || 'Unknown',
        status: booking.status || 'Pending',
        bookingDate: booking.bookingDate || booking.createdAt || booking.date || new Date().toISOString(),
        bookingType: 'host', // Mark as host booking
        guestName: booking.guestName || booking.userName || 'Guest',
        guestEmail: booking.guestEmail || booking.userEmail || null,
      })) : [];
      
      // Combine both types of bookings
      const allBookings = [...mappedUserBookings, ...mappedHostBookings];
      
      // Sort by date (most recent first)
      const sortedBookings = allBookings.sort((a, b) => {
        const dateA = new Date(a.bookingDate || a.createdAt || 0);
        const dateB = new Date(b.bookingDate || b.createdAt || 0);
        return dateB - dateA;
      });
      
      setBookings(sortedBookings);
      console.log(`✅ Loaded bookings: ${mappedUserBookings.length} as guest, ${mappedHostBookings.length} as host`);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load booking history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load bookings when screen comes into focus (real-time updates)
  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
    }, [user])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadBookings();
  }, []);

  const handleDeleteBooking = (bookingId, apartmentTitle) => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to delete bookings.');
      return;
    }
    Alert.alert(
      'Delete Booking',
      `Are you sure you want to delete the booking for "${apartmentTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBooking(user.email, bookingId);
              loadBookings(); // Reload to show updated list
              Alert.alert('Success', 'Booking deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete booking');
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
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
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
        <Text style={styles.headerTitle}>Booking History</Text>
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
          <MaterialIcons name="history" size={64} color="#CCC" />
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
            <View key={booking.id} style={styles.bookingCard}>
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
                    <View style={styles.bookingTitleRow}>
                      <Text style={styles.bookingTitle} numberOfLines={2}>
                        {booking.title || booking.apartmentTitle || 'Apartment Booking'}
                      </Text>
                      {/* Booking Type Badge */}
                      {booking.bookingType === 'host' && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>Host</Text>
                        </View>
                      )}
                      {booking.bookingType === 'guest' && (
                        <View style={styles.guestBadge}>
                          <Text style={styles.guestBadgeText}>Guest</Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(booking.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(booking.status) },
                        ]}
                      >
                        {getStatusText(booking.status)}
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

                {/* Guest Name (for host bookings) */}
                {booking.bookingType === 'host' && booking.guestName && (
                  <View style={styles.bookingDetail}>
                    <MaterialIcons name="person" size={16} color="#666" />
                    <Text style={styles.bookingDetailText}>
                      Guest: {booking.guestName}
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

                {/* Amount and Date */}
                <View style={styles.bookingFooter}>
                  <View>
                    {booking.bookingType === 'host' && booking.hostPaymentAmount ? (
                      <>
                        <Text style={styles.bookingAmount}>
                          {formatPrice(booking.hostPaymentAmount)}
                        </Text>
                        <Text style={styles.bookingSubtext}>
                          (You received - fees deducted)
                        </Text>
                        <Text style={styles.bookingSubtext}>
                          Total paid: {formatPrice(booking.totalAmount || 0)}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.bookingAmount}>
                        {booking.totalAmount ? formatPrice(booking.totalAmount) : 'N/A'}
                      </Text>
                    )}
                    <Text style={styles.bookingDate}>
                      Booked on {formatDate(booking.bookingDate || booking.createdAt || booking.date)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() =>
                      handleDeleteBooking(
                        booking.id,
                        booking.title || booking.apartmentTitle || 'Apartment',
                        booking.bookingType || 'guest'
                      )
                    }
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
  bookingSubtext: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  bookingSubtext: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
});

