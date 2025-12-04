import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { getListings } from '../utils/listings';
import { hybridApartmentService } from '../services/hybridService';
import { useAuth } from '../hooks/useAuth';

export default function HostProfileScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { apartment } = route.params || {};
  const [hostProfile, setHostProfile] = useState(null);
  const [hostListings, setHostListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    if (apartment) {
      loadHostProfile();
      loadHostListings();
    }
  }, [apartment, user]);

  // Reload profile and listings when screen comes into focus (live updates)
  useFocusEffect(
    React.useCallback(() => {
      if (apartment) {
        // Small delay to ensure profile changes are saved before reloading
        const timer = setTimeout(() => {
          loadHostProfile();
          loadHostListings();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [apartment, user])
  );

  const loadHostProfile = async () => {
    try {
      setLoading(true);
      
      // Get the host's email from the apartment (the person who created/uploaded this listing)
      // Use createdBy as primary (most reliable), then hostEmail as fallback
      const hostEmail = apartment?.createdBy || apartment?.hostEmail || null;
      
      console.log('HostProfileScreen - Loading profile for host:', {
        hostEmail: hostEmail,
        hostName: apartment?.hostName,
        apartmentId: apartment?.id,
        hasHostProfilePicture: !!apartment?.hostProfilePicture
      });
      
      // Initialize with apartment data as base
      let hostProfileData = {
        name: apartment?.hostName || 'Property Owner',
        email: hostEmail,
        profilePicture: null,
        whatsappNumber: null,
        address: null,
      };
      
      // Priority 1: Try to get the latest profile from user-specific storage
      // This ensures we get the correct host's profile (not the current logged-in user)
      if (hostEmail) {
        try {
          const { getUserProfile } = await import('../utils/userStorage');
          const hostProfile = await getUserProfile(hostEmail);
          
          if (hostProfile) {
            // Always use the latest profile data from userStorage (highest priority)
            // If profile exists in userStorage, always use its profilePicture value (even if null)
            // This ensures that if user removes their picture, it shows as removed, not the old listing picture
            let profilePictureValue = null;
            if (hostProfile.hasOwnProperty('profilePicture')) {
              profilePictureValue = hostProfile.profilePicture || null;
            } else {
              // Only fallback to listing if profilePicture property doesn't exist in profile
              profilePictureValue = apartment?.hostProfilePicture || null;
            }
            
            hostProfileData = {
              name: hostProfile.name || apartment?.hostName || 'Property Owner',
              email: hostProfile.email || hostEmail,
              profilePicture: profilePictureValue,
              whatsappNumber: hostProfile.whatsappNumber || null,
              address: hostProfile.address || null,
            };
            console.log('HostProfileScreen - Using latest profile from host\'s user-specific storage:', {
              hasPicture: !!hostProfileData.profilePicture,
              pictureSource: hostProfile.hasOwnProperty('profilePicture') ? 'userStorage' : (apartment?.hostProfilePicture ? 'listing' : 'none')
            });
          } else {
            console.log('HostProfileScreen - No profile found in userStorage, using apartment data');
          }
        } catch (error) {
          console.error('Error loading host profile from userStorage:', error);
        }
      }
      
      // Priority 2: If we don't have a profile picture from user storage, use the one from listing
      if (!hostProfileData.profilePicture && apartment?.hostProfilePicture) {
        hostProfileData.profilePicture = apartment.hostProfilePicture;
        console.log('HostProfileScreen - Using profile picture from listing (fallback)');
      }
      
      // Ensure we have the name and email from apartment if not set
      if (!hostProfileData.name) {
        hostProfileData.name = apartment?.hostName || 'Property Owner';
      }
      if (!hostProfileData.email) {
        hostProfileData.email = hostEmail;
      }
      
      console.log('HostProfileScreen - Final profile data:', {
        name: hostProfileData.name,
        email: hostProfileData.email,
        hasPicture: !!hostProfileData.profilePicture,
        pictureUri: hostProfileData.profilePicture ? (hostProfileData.profilePicture.length > 50 ? hostProfileData.profilePicture.substring(0, 50) + '...' : hostProfileData.profilePicture) : null
      });
      
      setHostProfile(hostProfileData);
    } catch (error) {
      console.error('Error loading host profile:', error);
      // Fallback to apartment data
      setHostProfile({
        name: apartment?.hostName || 'Property Owner',
        email: apartment?.hostEmail || apartment?.createdBy || null,
        profilePicture: apartment?.hostProfilePicture || null,
        whatsappNumber: null,
        address: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHostListings = async () => {
    try {
      setListingsLoading(true);
      
      if (!apartment) {
        setHostListings([]);
        setListingsLoading(false);
        return;
      }

      console.log('HostProfileScreen - Loading listings for host:', {
        hostEmail: apartment.hostEmail,
        hostName: apartment.hostName
      });

      // Get all listings (global) - all users can see all listings
      const allListings = await getListings();
      console.log('HostProfileScreen - All listings loaded:', allListings.length);

      // Also get all listings from hybrid service (includes defaults and API)
      let hybridListings = [];
      try {
        hybridListings = await hybridApartmentService.getAllApartmentsForExplore();
        console.log('HostProfileScreen - All listings from hybrid service:', hybridListings.length);
      } catch (error) {
        console.error('Error getting listings from hybrid service:', error);
        // If hybrid service fails, use global listings only
        hybridListings = allListings;
      }
      
      // Combine global listings with hybrid service listings (avoid duplicates)
      const globalListingIds = new Set(allListings.map(l => l.id || String(l.id)));
      const uniqueHybridListings = hybridListings.filter(l => {
        const id = l.id || String(l.id);
        return !globalListingIds.has(id);
      });
      
      // Merge: global listings first, then hybrid service listings
      const combinedListings = [...allListings, ...uniqueHybridListings];
      console.log('HostProfileScreen - Combined listings:', combinedListings.length);
      
      // Determine the host email to match against (from the apartment)
      // This is the email of the user who created/uploaded this listing
      // Use createdBy as primary, then hostEmail as fallback
      const hostEmailToMatch = apartment.createdBy || apartment.hostEmail || null;

      console.log('HostProfileScreen - Matching criteria:', {
        hostEmailToMatch,
        apartmentHostEmail: apartment.hostEmail,
        apartmentCreatedBy: apartment.createdBy,
        apartmentHostName: apartment.hostName,
        totalListingsToSearch: combinedListings.length
      });

      // Filter listings by createdBy (primary) or hostEmail (fallback)
      // This ensures we show all listings created by the same host
      // The hostEmailToMatch should match the profile we loaded above
      if (!hostEmailToMatch) {
        console.warn('HostProfileScreen - No host email to match against, cannot filter listings');
        setHostListings([]);
        setListingsLoading(false);
        return;
      }

      const emailToMatch = String(hostEmailToMatch).toLowerCase().trim();
      
      console.log('HostProfileScreen - Starting filter with emailToMatch:', emailToMatch);
      console.log('HostProfileScreen - Sample listing data (first 3):', combinedListings.slice(0, 3).map(l => ({
        id: l.id,
        title: l.title,
        createdBy: l.createdBy,
        hostEmail: l.hostEmail,
        hostName: l.hostName
      })));
      
      const filteredListings = combinedListings.filter(listing => {
        // Get listing creator and host info (normalize for comparison)
        const listingCreatedBy = listing.createdBy ? String(listing.createdBy).toLowerCase().trim() : null;
        const listingHostEmail = listing.hostEmail ? String(listing.hostEmail).toLowerCase().trim() : null;

        let isMatch = false;

        // Match by createdBy (primary - most reliable)
        // This is the field we set when creating listings in UploadListingScreen
        if (listingCreatedBy && listingCreatedBy === emailToMatch) {
          isMatch = true;
          console.log('HostProfileScreen - ✓ Matched listing by createdBy:', listing.title || 'Untitled', {
            listingCreatedBy,
            emailToMatch,
            match: true
          });
        }
        
        // Match by hostEmail (fallback for older listings or API listings)
        if (!isMatch && listingHostEmail && listingHostEmail === emailToMatch) {
          isMatch = true;
          console.log('HostProfileScreen - ✓ Matched listing by hostEmail:', listing.title || 'Untitled', {
            listingHostEmail,
            emailToMatch,
            match: true
          });
        }
        
        if (!isMatch) {
          return false;
        }

        // If matched, include it (we'll show ALL listings by this host, including the current one)
        // The user wants to see all listings made by the host
        return true;
      });
      
      console.log('HostProfileScreen - Filtered host listings:', filteredListings.length);
      
      // Format listings for display
      const formattedListings = filteredListings.map(listing => ({
        id: listing.id || String(listing.id),
        title: listing.title || 'Apartment',
        location: listing.location || 'Nigeria',
        price: listing.price || 0,
        image: listing.image || listing.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        images: listing.images || (listing.image ? [listing.image] : []),
        bedrooms: listing.bedrooms || listing.beds || null,
        bathrooms: listing.bathrooms || listing.baths || null,
        beds: listing.bedrooms || listing.beds || null,
        baths: listing.bathrooms || listing.baths || null,
        area: listing.area || null,
        maxGuests: listing.maxGuests || null,
        description: listing.description || null,
        amenities: listing.amenities || null,
        status: listing.status || 'active',
        createdAt: listing.createdAt || new Date().toISOString(),
        createdBy: listing.createdBy || apartment?.createdBy || apartment?.hostEmail || null, // Preserve createdBy
        hostName: listing.hostName || apartment?.hostName || null,
        hostEmail: listing.hostEmail || apartment?.hostEmail || null,
        hostProfilePicture: listing.hostProfilePicture || null,
        isSuperhost: listing.isSuperhost || false,
        isFavorite: listing.isFavorite || false,
      }));
      
      // Sort by most recent first
      formattedListings.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      console.log('HostProfileScreen - Setting formatted listings:', formattedListings.length);
      setHostListings(formattedListings);
    } catch (error) {
      console.error('Error loading host listings:', error);
      setHostListings([]);
    } finally {
      setListingsLoading(false);
    }
  };



  const formatPrice = (price) => {
    if (!price) return 'Price not set';
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'inactive':
        return '#999';
      default:
        return '#666';
    }
  };

  const renderListingCard = ({ item }) => (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => {
        navigation.navigate('ApartmentDetails', { apartment: item });
      }}
      activeOpacity={0.8}
    >
      {/* Listing Image */}
      {item.image || (item.images && item.images[0]) ? (
        <Image 
          source={{ uri: item.image || item.images[0] }} 
          style={styles.listingImage} 
        />
      ) : (
        <View style={styles.listingImagePlaceholder}>
          <MaterialIcons name="home" size={48} color="#CCC" />
        </View>
      )}

      {/* Listing Info */}
      <View style={styles.listingInfo}>
        <View style={styles.listingHeader}>
          <View style={styles.listingTitleContainer}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {item.title || 'Untitled Listing'}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status?.toUpperCase() || 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location */}
        {item.location && (
          <View style={styles.listingDetail}>
            <MaterialIcons name="location-on" size={16} color="#666" />
            <Text style={styles.listingDetailText}>{item.location}</Text>
          </View>
        )}

        {/* Property Details */}
        <View style={styles.propertyDetails}>
          {item.bedrooms && (
            <View style={styles.propertyDetail}>
              <MaterialIcons name="bed" size={16} color="#666" />
              <Text style={styles.propertyDetailText}>{item.bedrooms} bed</Text>
            </View>
          )}
          {item.bathrooms && (
            <View style={styles.propertyDetail}>
              <MaterialIcons name="bathtub" size={16} color="#666" />
              <Text style={styles.propertyDetailText}>{item.bathrooms} bath</Text>
            </View>
          )}
          {item.area && (
            <View style={styles.propertyDetail}>
              <MaterialIcons name="square-foot" size={16} color="#666" />
              <Text style={styles.propertyDetailText}>{item.area} sqft</Text>
            </View>
          )}
          {item.maxGuests && (
            <View style={styles.propertyDetail}>
              <MaterialIcons name="people" size={16} color="#666" />
              <Text style={styles.propertyDetailText}>{item.maxGuests} guests</Text>
            </View>
          )}
        </View>

        {/* Host Info */}
        {item.hostName && (
          <View style={styles.hostInfo}>
            <Text style={styles.hostName}>
              Hosted by {item.hostName}
              {item.isSuperhost && (
                <Text style={styles.superhostBadge}> • Superhost</Text>
              )}
            </Text>
          </View>
        )}

        {/* Price and Date */}
        <View style={styles.listingFooter}>
          <View>
            <Text style={styles.listingPrice}>
              {item.price ? formatPrice(item.price) : 'Price not set'}
            </Text>
            <Text style={styles.listingDate}>
              Listed on {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Host Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Host Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {hostProfile?.profilePicture ? (
            <Image 
              source={{ uri: hostProfile.profilePicture }} 
              style={styles.avatarImage}
              onError={(error) => {
                console.error('Error loading host profile image:', error);
                console.log('Failed image URI:', hostProfile.profilePicture);
                console.log('Apartment hostProfilePicture:', apartment?.hostProfilePicture);
                // Try to reload from apartment if available
                if (apartment?.hostProfilePicture && apartment.hostProfilePicture !== hostProfile.profilePicture) {
                  console.log('Trying to use apartment hostProfilePicture directly');
                  setHostProfile(prev => ({ ...prev, profilePicture: apartment.hostProfilePicture }));
                } else {
                  // If image fails to load, fall back to avatar placeholder
                  setHostProfile(prev => ({ ...prev, profilePicture: null }));
                }
              }}
              onLoad={() => {
                console.log('Host profile image loaded successfully from:', hostProfile.profilePicture);
              }}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(hostProfile?.name || 'H').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{hostProfile?.name || 'Property Owner'}</Text>
          {hostProfile?.email && (
            <Text style={styles.email}>{hostProfile.email}</Text>
          )}
          {apartment?.isSuperhost && (
            <View style={styles.superhostBadgeContainer}>
              <MaterialIcons name="verified" size={16} color="#FFD700" />
              <Text style={styles.superhostText}>Superhost</Text>
            </View>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          {hostProfile?.email && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialIcons name="email" size={20} color="#666" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{hostProfile.email}</Text>
              </View>
            </View>
          )}

          {hostProfile?.whatsappNumber && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialIcons name="phone" size={20} color="#666" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>WhatsApp</Text>
                <Text style={styles.infoValue}>+234 {hostProfile.whatsappNumber}</Text>
              </View>
            </View>
          )}

          {hostProfile?.address && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialIcons name="location-on" size={20} color="#666" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue} numberOfLines={3}>{hostProfile.address}</Text>
              </View>
            </View>
          )}

          {!hostProfile?.email && !hostProfile?.whatsappNumber && !hostProfile?.address && (
            <Text style={styles.noInfoText}>
              Contact information not available
            </Text>
          )}
        </View>

        {/* Host's Listings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {hostListings.length > 0 ? `Properties (${hostListings.length})` : 'Properties'}
          </Text>
          {listingsLoading ? (
            <View style={styles.loadingListingsContainer}>
              <Text style={styles.loadingText}>Loading listings...</Text>
            </View>
          ) : hostListings.length > 0 ? (
            <FlatList
              data={hostListings}
              renderItem={renderListingCard}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.listingsContainer}
            />
          ) : (
            <View style={styles.noListingsContainer}>
              <MaterialIcons name="home" size={48} color="#999" />
              <Text style={styles.noListingsText}>No properties listed</Text>
            </View>
          )}
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
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingListingsContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  listingsWrapper: {
    minHeight: 300,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  superhostBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  superhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  noInfoText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  propertyCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  listingsContainer: {
    paddingVertical: 8,
  },
  listingCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  listingImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  listingImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    padding: 16,
  },
  listingHeader: {
    marginBottom: 12,
  },
  listingTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listingTitle: {
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
    fontSize: 10,
    fontWeight: '600',
  },
  listingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  listingDetailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  propertyDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  propertyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  propertyDetailText: {
    fontSize: 14,
    color: '#666',
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  listingPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  listingDate: {
    fontSize: 12,
    color: '#999',
  },
  hostInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  hostName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  superhostBadge: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  noListingsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noListingsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});

