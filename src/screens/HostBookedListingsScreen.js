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
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getHostBookings } from '../utils/bookings';
import { useAuth } from '../hooks/useAuth';

export default function HostBookedListingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasListings, setHasListings] = useState(false);

  // Check if user has listings - required to access this screen
  const checkUserListings = async () => {
    try {
      if (!user || !user.email) {
        return false;
      }

      const { getMyListings } = await import('../utils/listings');
      const userListings = await getMyListings();
      
      // Also check API listings
      let apiListings = [];
      try {
        const { hybridApartmentService } = await import('../services/hybridService');
        const apiResult = await hybridApartmentService.getMyApartments();
        if (apiResult && Array.isArray(apiResult) && apiResult.length > 0) {
          apiListings = apiResult;
        }
      } catch (apiError) {
        // API not available, use local only
      }

      const totalListings = userListings.length + apiListings.length;
      return totalListings > 0;
    } catch (error) {
      console.error('Error checking user listings:', error);
      return false;
    }
  };

  const loadBookings = async () => {
    try {
      if (!user || !user.email) {
        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        setHasListings(false);
        return;
      }
      
      // Check if user has listings - redirect if they don't
      const userHasListings = await checkUserListings();
      setHasListings(userHasListings);
      
      if (!userHasListings) {
        Alert.alert(
          'No Listings',
          'You need to upload at least one listing to view booked listings.',
          [
            {
              text: 'Go Back',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Upload Listing',
              onPress: () => {
                navigation.goBack();
                navigation.navigate('MyListings');
              },
            },
          ]
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const normalizedEmail = user.email.toLowerCase().trim();
      
      // Get host bookings (bookings where user is the host)
      const hostBookings = await getHostBookings(normalizedEmail);
      
      const mappedBookings = Array.isArray(hostBookings) ? hostBookings.map(booking => ({
        id: booking.id || String(booking.id),
        apartmentId: booking.apartmentId,
        title: booking.title || 'Apartment',
        location: booking.location || 'Nigeria',
        image: booking.image,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        numberOfDays: booking.numberOfDays || 1,
        numberOfGuests: booking.numberOfGuests || 1,
        totalAmount: booking.totalAmount || 0,
        hostPaymentAmount: booking.hostPaymentAmount || 0, // Amount host receives (after fees)
        paymentMethod: booking.paymentMethod || 'Unknown',
        status: booking.status || 'Pending',
        bookingDate: booking.bookingDate || booking.createdAt || new Date().toISOString(),
        guestName: booking.guestName || booking.userName || 'Guest',
        guestEmail: booking.guestEmail || booking.userEmail || null,
      })) : [];
      
      // Sort by date (most recent first)
      const sortedBookings = mappedBookings.sort((a, b) => {
        const dateA = new Date(a.bookingDate || 0);
        const dateB = new Date(b.bookingDate || 0);
        return dateB - dateA;
      });
      
      // Load apartment details for each booking
      const { getMyListings } = await import('../utils/listings');
      const userListings = await getMyListings();
      
      let apiListings = [];
      try {
        const { hybridApartmentService } = await import('../services/hybridService');
        const apiResult = await hybridApartmentService.getMyApartments();
        if (apiResult && Array.isArray(apiResult) && apiResult.length > 0) {
          apiListings = apiResult;
        }
      } catch (apiError) {
        // API not available
      }
      
      const allListings = [...userListings, ...apiListings];
      
      // Enrich bookings with apartment details
      const enrichedBookings = sortedBookings.map(booking => {
        const apartmentId = booking.apartmentId;
        const apartment = allListings.find(listing => 
          (listing.id || listing._id || String(listing.id)) === String(apartmentId)
        );
        
        return {
          ...booking,
          apartmentDetails: apartment ? {
            bedrooms: apartment.bedrooms || apartment.beds || null,
            bathrooms: apartment.bathrooms || apartment.baths || null,
            area: apartment.area || apartment.squareFeet || null,
            maxGuests: apartment.maxGuests || apartment.guests || null,
            price: apartment.price || apartment.rent || null,
          } : null,
        };
      });
      
      setBookings(enrichedBookings);
      console.log(`✅ Loaded ${enrichedBookings.length} individual bookings`);
    } catch (error) {
      console.error('Error loading host bookings:', error);
      Alert.alert('Error', 'Failed to load booked listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
          <Text style={styles.headerTitle}>Booked Listings</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
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
        <Text style={styles.headerTitle}>Booked Listings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!hasListings ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="add-business" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Listings Found</Text>
            <Text style={styles.emptyText}>
              You need to upload at least one listing to view booked listings.
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => {
                navigation.goBack();
                navigation.navigate('MyListings');
              }}
            >
              <Text style={styles.uploadButtonText}>Go to Upload Listing</Text>
            </TouchableOpacity>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="event-busy" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Bookings Yet</Text>
            <Text style={styles.emptyText}>
              You haven't received any bookings for your listings yet.
            </Text>
            <Text style={styles.emptySubtext}>
              When guests book your apartments, they will appear here.
            </Text>
          </View>
        ) : (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.card}
              onPress={() => {
                navigation.navigate('HostBookingDetails', {
                  booking: booking,
                });
              }}
              activeOpacity={0.8}
            >
              <View style={styles.imageContainer}>
                {booking.image ? (
                  <Image source={{ uri: booking.image }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="home" size={48} color="#CCC" />
                  </View>
                )}
                {/* Status Badge Overlay */}
                <View style={[styles.statusBadgeOverlay, { backgroundColor: getStatusColor(booking.status) + 'E6' }]}>
                  <Text style={styles.statusTextOverlay}>
                    {booking.status || 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    {/* Guest Name */}
                    <View style={styles.guestNameRow}>
                      <MaterialIcons name="person" size={16} color="#FFD700" />
                      <Text style={styles.guestName}>{booking.guestName || 'Guest'}</Text>
                    </View>
                    {/* Apartment Title */}
                    <Text style={styles.title} numberOfLines={1}>
                      {booking.title || 'Apartment'}
                    </Text>
                    {/* Location */}
                    <Text style={styles.location}>{booking.location || 'Nigeria'}</Text>
                    {/* Price and Booking Info Row */}
                    <View style={styles.priceRatingRow}>
                      <Text style={styles.price}>{formatPrice(booking.totalAmount || 0)}</Text>
                      <View style={styles.bookingInfoContainer}>
                        <MaterialIcons name="people" size={14} color="#666" />
                        <Text style={styles.bookingInfoText}>
                          {booking.numberOfGuests || 1}
                        </Text>
                        {booking.checkInDate && (
                          <>
                            <Text style={styles.bookingInfoSeparator}>•</Text>
                            <MaterialIcons name="calendar-today" size={14} color="#666" />
                            <Text style={styles.bookingInfoText}>
                              {formatDate(booking.checkInDate).split(',')[0]}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
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
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  uploadButton: {
    marginTop: 20,
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusTextOverlay: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  guestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  bookingInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  bookingInfoSeparator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
});

