import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyFavoriteAdded, notifyFavoriteRemoved } from '../utils/notifications';
import { hybridApartmentService, hybridFavoriteService } from '../services/hybridService';
import { useAuth } from '../hooks/useAuth';
import WelcomeDealModal from '../components/WelcomeDealModal';
import { hasSeenWelcomeDeal, markWelcomeDealSeen } from '../utils/userStorage';

const { width } = Dimensions.get('window');

const apartments = [
  {
    id: '1',
    title: 'Modern 3-Bedroom Apartment in Victoria Island',
    price: 83333, // Daily rate (within 100K range)
    location: 'Lagos',
    beds: 3,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    isFavorite: false,
    rating: 4.92,
  },
  {
    id: '2',
    title: 'Luxury 2-Bedroom Penthouse in Lekki',
    price: 95000, // Daily rate (under 100K)
    location: 'Lagos',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800',
    isFavorite: false,
    rating: 4.85,
  },
  {
    id: '3',
    title: 'Cozy 1-Bedroom Studio in Garki',
    price: 26667, // Daily rate (within 100K range)
    location: 'Abuja',
    beds: 1,
    baths: 1,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    isFavorite: false,
    rating: 4.98,
  },
  {
    id: '4',
    title: 'Spacious 4-Bedroom Family Home in Port Harcourt',
    price: 60000, // Daily rate (within 100K range)
    location: 'Port Harcourt',
    beds: 4,
    baths: 3,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    isFavorite: false,
    rating: 4.91,
  },
  {
    id: '5',
    title: 'Elegant 2-Bedroom Apartment in Ibadan',
    price: 20000, // Daily rate (within 100K range)
    location: 'Ibadan',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    isFavorite: false,
    rating: 4.99,
  },
  {
    id: '6',
    title: 'Contemporary 3-Bedroom Duplex in Kano',
    price: 40000, // Daily rate (within 100K range)
    location: 'Kano',
    beds: 3,
    baths: 3,
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    isFavorite: false,
    rating: 4.88,
  },
  {
    id: '7',
    title: 'Stylish 2-Bedroom Apartment in Ikeja',
    price: 50000, // Daily rate (within 100K range)
    location: 'Lagos',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
    isFavorite: false,
    rating: 4.93,
  },
  {
    id: '8',
    title: 'Luxury 5-Bedroom Mansion in Asokoro',
    price: 98000, // Daily rate (under 100K)
    location: 'Abuja',
    beds: 5,
    baths: 4,
    image: 'https://images.unsplash.com/photo-1600585152915-d208bec867a1?w=800',
    isFavorite: false,
    rating: 4.95,
  },
];

export default function ExploreScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [apartmentList, setApartmentList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Entire place');
  const [loading, setLoading] = useState(true);
  const [showWelcomeDeal, setShowWelcomeDeal] = useState(false);
  const [checkingWelcomeDeal, setCheckingWelcomeDeal] = useState(false);

  useEffect(() => {
    loadApartments();
    // Check if user is new and show welcome deal modal on first load
    if (user && user.email) {
      checkAndShowWelcomeDeal();
    }
  }, []);

  // Reload apartments when screen comes into focus (to show new listings)
  useFocusEffect(
    React.useCallback(() => {
      loadApartments();
      // Check if user is new and show welcome deal modal
      if (user && user.email) {
        checkAndShowWelcomeDeal();
      }
    }, [user])
  );

  // Check if user is new and show welcome deal modal
  // IMPORTANT: Welcome deal is ONLY for first-time users (sign-up), NOT for existing users (sign-in)
  const checkAndShowWelcomeDeal = async () => {
    if (!user || !user.email || checkingWelcomeDeal) return;
    
    try {
      setCheckingWelcomeDeal(true);
      const hasSeenDeal = await hasSeenWelcomeDeal(user.email);
      
      // Only show deal if user hasn't seen it AND they're a new user (just signed up)
      // Existing users who sign in are automatically marked as ineligible in AuthContext.signIn
      if (!hasSeenDeal) {
        // IMMEDIATELY show welcome deal modal for new user on home page
        // This only appears for users who just signed up, not users who signed in
        setShowWelcomeDeal(true);
        console.log('🎉 Welcome deal modal shown on home page for NEW user (sign-up):', user.email);
      } else {
        console.log(`✅ User ${user.email} is an existing user - Welcome deal not shown (only for first-time users)`);
      }
    } catch (error) {
      console.error('Error checking welcome deal:', error);
    } finally {
      setCheckingWelcomeDeal(false);
    }
  };

  // Handle claiming the welcome deal
  const handleClaimDeal = async () => {
    if (!user || !user.email) return;
    
    try {
      // SET wallet balance to exactly ₦50,000 (not add to existing)
      const { updateWalletBalance, addTransaction } = await import('../utils/wallet');
      
      // Set balance to exactly ₦50,000
      await updateWalletBalance(user.email, 50000);
      
      // Add transaction record for the welcome bonus
      await addTransaction(user.email, {
        type: 'deposit',
        amount: 50000,
        description: 'Welcome Bonus Voucher',
        status: 'completed',
      });
      
      // Verify the balance was set correctly
      const { getWalletBalance } = await import('../utils/wallet');
      const verifiedBalance = await getWalletBalance(user.email);
      console.log(`✅ Welcome bonus claimed: User ${user.email} wallet set to ₦${verifiedBalance.toLocaleString()}`);
      
      // Mark deal as claimed
      await markWelcomeDealSeen(user.email, true);
      
      setShowWelcomeDeal(false);
      
      Alert.alert(
        'Congratulations!',
        '₦50,000 has been added to your wallet! Start booking your dream apartment now.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error claiming welcome deal:', error);
      Alert.alert('Error', 'Failed to claim deal. Please try again.');
    }
  };

  // Handle closing the welcome deal modal
  const handleCloseDeal = async () => {
    if (!user || !user.email) return;
    
    // Mark deal as seen (but not claimed)
    await markWelcomeDealSeen(user.email, false);
    
    // Ensure wallet is initialized to 0 for users who don't claim the deal
    try {
      const { updateWalletBalance } = await import('../utils/wallet');
      await updateWalletBalance(user.email, 0);
      console.log(`✅ Wallet initialized to ₦0 for user: ${user.email}`);
    } catch (walletError) {
      console.error('Error initializing wallet to zero:', walletError);
    }
    
    setShowWelcomeDeal(false);
  };

  const loadApartments = async () => {
    try {
      setLoading(true);
      
      // Always get user listings directly first to ensure they're included
      const { getListings } = await import('../utils/listings');
      const userListings = await getListings();
      console.log('ExploreScreen - Direct user listings check:', userListings.length);
      
      // Load all apartments including user listings and default apartments
      // This ensures new listings appear with other listing cards
      const allApartments = await hybridApartmentService.getAllApartmentsForExplore();
      
      console.log('ExploreScreen - All apartments loaded:', allApartments?.length || 0);
      
      let finalApartments = [];
      
      if (allApartments && allApartments.length > 0) {
        finalApartments = allApartments;
      } else {
        // If empty, manually merge user listings with defaults
        const formattedUserListings = userListings && userListings.length > 0
          ? userListings.map(listing => ({
              id: listing.id,
              title: listing.title || 'Apartment',
              price: listing.price || 0,
              location: listing.location || 'Nigeria',
              beds: listing.bedrooms || listing.beds || 1,
              baths: listing.bathrooms || listing.baths || 1,
              bedrooms: listing.bedrooms || listing.beds || null,
              bathrooms: listing.bathrooms || listing.baths || null,
              area: listing.area || null,
              maxGuests: listing.maxGuests || null,
              description: listing.description || null,
              amenities: listing.amenities || null,
              image: listing.image || listing.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
              images: (() => {
                // If listing has images array, use it
                if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
                  return listing.images.filter(img => img && img.trim && img.trim() !== '');
                }
                // If no images array but we have a main image, create array with it
                if (listing.image) {
                  return [listing.image];
                }
                // Return empty array (will use default in details screen)
                return [];
              })(),
              isFavorite: false,
              rating: listing.rating || 4.5,
              createdAt: listing.createdAt || new Date().toISOString(),
              hostName: listing.hostName || null,
              isSuperhost: listing.isSuperhost || false,
              hostEmail: listing.hostEmail || null,
              hostProfilePicture: listing.hostProfilePicture || null,
            }))
          : [];
        
        // Sort user listings by most recent
        formattedUserListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Combine: user listings first, then defaults
        finalApartments = [...formattedUserListings, ...apartments];
      }
      
      // Load favorites and merge with apartments
      try {
        const favoriteIds = await hybridFavoriteService.getFavorites();
        finalApartments = finalApartments.map((apt) => ({
          ...apt,
          isFavorite: favoriteIds.includes(apt.id) || favoriteIds.includes(String(apt.id)),
        }));
      } catch (favoritesError) {
        console.error('Error loading favorites:', favoritesError);
        // Continue without favorites
      }
      
      // Set the final list - this ensures listings are stable
      // Always set the list, even if empty (shouldn't happen)
      setApartmentList(finalApartments);
      console.log('ExploreScreen - Final apartments set:', finalApartments.length, 'User listings included:', userListings.length);
    } catch (error) {
      console.error('Error loading apartments:', error);
      // Fallback: try to get user listings and merge with defaults
      try {
        const { getListings } = await import('../utils/listings');
        const userListings = await getListings();
        const formattedUserListings = userListings && userListings.length > 0
          ? userListings.map(listing => ({
              id: listing.id,
              title: listing.title || 'Apartment',
              price: listing.price || 0,
              location: listing.location || 'Nigeria',
              beds: listing.bedrooms || listing.beds || 1,
              baths: listing.bathrooms || listing.baths || 1,
              bedrooms: listing.bedrooms || listing.beds || null,
              bathrooms: listing.bathrooms || listing.baths || null,
              area: listing.area || null,
              maxGuests: listing.maxGuests || null,
              description: listing.description || null,
              amenities: listing.amenities || null,
              image: listing.image || listing.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
              images: (() => {
                // If listing has images array, use it
                if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
                  return listing.images.filter(img => img && img.trim && img.trim() !== '');
                }
                // If no images array but we have a main image, create array with it
                if (listing.image) {
                  return [listing.image];
                }
                // Return empty array (will use default in details screen)
                return [];
              })(),
              isFavorite: false,
              rating: listing.rating || 4.5,
              createdAt: listing.createdAt || new Date().toISOString(),
              hostName: listing.hostName || null,
              isSuperhost: listing.isSuperhost || false,
              hostEmail: listing.hostEmail || null,
              hostProfilePicture: listing.hostProfilePicture || null,
            }))
          : [];
        formattedUserListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const favoriteIds = await hybridFavoriteService.getFavorites();
        const combined = [...formattedUserListings, ...apartments].map((apt) => ({
          ...apt,
          isFavorite: favoriteIds.includes(apt.id) || favoriteIds.includes(String(apt.id)),
        }));
        setApartmentList(combined);
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        setApartmentList(apartments);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const favoriteIds = await hybridFavoriteService.getFavorites();
      setApartmentList(prevList => prevList.map((apt) => ({
        ...apt,
        isFavorite: favoriteIds.includes(apt.id) || favoriteIds.includes(String(apt.id)),
      })));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (id) => {
    // Use functional update to ensure we have the latest state
    let apartment = null;
    let wasFavorite = false;
    
    setApartmentList(prevList => {
      apartment = prevList.find((apt) => apt.id === id);
      wasFavorite = apartment?.isFavorite || false;
      
      const updatedList = prevList.map((apt) => {
        if (apt.id === id) {
          return { ...apt, isFavorite: !wasFavorite };
        }
        return apt;
      });
      
      return updatedList;
    });

    // Save to API and local storage
    if (!wasFavorite) {
      await hybridFavoriteService.addFavorite(id);
      if (apartment) {
        await notifyFavoriteAdded(apartment.title);
      }
    } else {
      await hybridFavoriteService.removeFavorite(id);
      if (apartment) {
        await notifyFavoriteRemoved(apartment.title);
      }
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '₦0';
    
    // Format price with m for millions and k for thousands
    if (price >= 1000000) {
      // Millions: divide by 1,000,000 and show with "m" (e.g., ₦5m)
      const millions = price / 1000000;
      // Show up to 1 decimal place if needed, otherwise whole number
      const formatted = millions % 1 === 0 
        ? millions.toFixed(0) 
        : millions.toFixed(1);
      return `₦${formatted}m`;
    } else if (price >= 1000) {
      // Thousands: divide by 1,000 and show with "k" (e.g., ₦50k)
      const thousands = price / 1000;
      // Show up to 1 decimal place if needed, otherwise whole number
      const formatted = thousands % 1 === 0 
        ? thousands.toFixed(0) 
        : thousands.toFixed(1);
      return `₦${formatted}k`;
    } else {
      // Less than 1000: show full number
      return `₦${price.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  };

  // Filter apartments based on search query and selected filter
  const filteredApartments = useMemo(() => {
    let filtered = apartmentList;

    // Apply filter button selection first
    if (selectedFilter) {
      filtered = filtered.filter((apt) => {
        try {
          switch (selectedFilter) {
            case 'Entire place':
              // Show all apartments
              return true;
            case 'Pool':
              // Check if apartment has pool in amenities or title/description
              const hasPool = 
                (apt.amenities && Array.isArray(apt.amenities) && apt.amenities.some(a => 
                  a && (a.toLowerCase().includes('pool') || a.toLowerCase().includes('swimming'))
                )) ||
                (apt.title && apt.title.toLowerCase().includes('pool')) ||
                (apt.description && apt.description.toLowerCase().includes('pool'));
              return hasPool;
            case 'Pet-friendly':
              // Check if apartment is pet-friendly
              const isPetFriendly = 
                (apt.amenities && Array.isArray(apt.amenities) && apt.amenities.some(a => 
                  a && (a.toLowerCase().includes('pet') || a.toLowerCase().includes('dog') || a.toLowerCase().includes('cat'))
                )) ||
                (apt.title && apt.title.toLowerCase().includes('pet')) ||
                (apt.description && apt.description.toLowerCase().includes('pet'));
              return isPetFriendly;
            case '2 Bedroom':
              // Show apartments with exactly 2 bedrooms
              const beds2 = apt.beds || apt.bedrooms;
              return beds2 === 2;
            case '3 Bedroom':
              // Show apartments with exactly 3 bedrooms
              const beds3 = apt.beds || apt.bedrooms;
              return beds3 === 3;
            case '4 Bedroom':
              // Show apartments with exactly 4 bedrooms
              const beds4 = apt.beds || apt.bedrooms;
              return beds4 === 4;
            case 'Top-rated':
              // Show apartments with rating >= 4.8
              return apt.rating && apt.rating >= 4.8;
            default:
              return true;
          }
        } catch (error) {
          console.error('Error applying filter:', error);
          return true;
        }
      });
    }

    // Then apply search query filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      
      filtered = filtered.filter((apt) => {
        try {
          // Search in title
          const titleMatch = apt.title && apt.title.toLowerCase().includes(query);
          
          // Search in location
          const locationMatch = apt.location && apt.location.toLowerCase().includes(query);
          
          // Search in number of beds
          const bedsMatch = apt.beds && apt.beds.toString().includes(query);
          
          // Search in number of baths
          const bathsMatch = apt.baths && apt.baths.toString().includes(query);
          
          // Search in price (convert to string and search)
          const priceMatch = apt.price && apt.price.toString().includes(query);
          
          // Search in price formatted (e.g., "2.5M" for 2500000)
          let formattedPriceMatch = false;
          if (apt.price) {
            try {
              const formattedPrice = `₦${(apt.price / 1000000).toFixed(1)}m`;
              formattedPriceMatch = formattedPrice.includes(query);
            } catch (e) {
              // Ignore formatting errors
            }
          }
          
          // Search for specific keywords (split query into words)
          const keywords = query.split(' ').filter(k => k.length > 0);
          let keywordMatch = false;
          if (keywords.length > 0) {
            keywordMatch = keywords.some(keyword => {
              return (apt.title && apt.title.toLowerCase().includes(keyword)) ||
                     (apt.location && apt.location.toLowerCase().includes(keyword)) ||
                     (apt.beds && apt.beds.toString().includes(keyword)) ||
                     (apt.baths && apt.baths.toString().includes(keyword));
            });
          }

          return titleMatch || locationMatch || bedsMatch || bathsMatch || 
                 priceMatch || formattedPriceMatch || keywordMatch;
        } catch (error) {
          console.error('Error filtering apartment:', error);
          return false;
        }
      });
    }

    return filtered;
  }, [apartmentList, searchQuery, selectedFilter]);

  const filters = ['Entire place', '2 Bedroom', '3 Bedroom', '4 Bedroom', 'Pool', 'Pet-friendly', 'Top-rated'];

  const renderApartmentCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ApartmentDetails', { apartment: item })}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={item.isFavorite ? 'favorite' : 'favorite-border'} 
            size={20} 
            color={item.isFavorite ? '#FF0000' : '#FFFFFF'} 
          />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.location}>{item.location}</Text>
            <View style={styles.priceRatingRow}>
              <Text style={styles.price}>{formatPrice(item.price)}/day</Text>
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={14} color="#FFD700" />
                <Text style={styles.rating}>{item.rating || 4.9}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search destination, city..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterIcon}>
            <MaterialIcons name="tune" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <Text style={styles.searchSubtext}>Anywhere • Any week • Add guests</Text>
      </View>

      {/* Filter Buttons */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Apartment List */}
      <FlatList
        data={filteredApartments}
        renderItem={renderApartmentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredApartments.length === 0 && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={64} color="#999" />
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>
                Try searching with different keywords like location, number of bedrooms, or apartment type
              </Text>
            </View>
          ) : null
        }
      />

      {/* Map Button */}
      <TouchableOpacity style={styles.mapButton}>
        <MaterialIcons name="map" size={20} color="#FFFFFF" />
        <Text style={styles.mapButtonText}>Map</Text>
      </TouchableOpacity>

      {/* Welcome Deal Modal - Shows immediately when new user reaches home page */}
      <WelcomeDealModal
        visible={showWelcomeDeal}
        onClaim={handleClaimDeal}
        onClose={handleCloseDeal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterIcon: {
    marginLeft: 8,
  },
  searchSubtext: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  filterContainer: {
    maxHeight: 60,
    marginBottom: 10,
    marginTop: 4,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FFD700',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingBottom: 80,
  },
  emptyListContent: {
    flexGrow: 1,
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
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mapButton: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -60,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});

