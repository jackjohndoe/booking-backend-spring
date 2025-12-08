// Hybrid Service - Uses API with AsyncStorage fallback
// This ensures the app works offline and maintains the same UI
import { apartmentService } from './apartmentService';
import { bookingService } from './bookingService';
import { walletService } from './walletService';
import { favoriteService } from './favoriteService';
import { getBookings, addBooking } from '../utils/bookings';
import { getListings, addListing, deleteListing } from '../utils/listings';
import { getWalletBalance, getTransactions, addFunds, makePayment } from '../utils/wallet';
import { queueListingForSync, getPendingSyncListings, removeFromSyncQueue } from './listingSyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to check if API is available
const isApiAvailable = async () => {
  try {
    // Try a simple health check or just assume API is available
    // In production, you might want to ping a health endpoint
    return true;
  } catch {
    return false;
  }
};

// Helper to get default apartments (matches ExploreScreen default apartments)
const getDefaultApartments = () => {
  // These are the default apartments from ExploreScreen
  // They should always be available as fallback
  return [
    {
      id: '1',
      title: 'Modern 3-Bedroom Apartment in Victoria Island',
      price: 83333, // Daily rate (under 100K)
      location: 'Lagos',
      beds: 3,
      baths: 2,
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      isFavorite: false,
      rating: 4.92,
      createdAt: new Date('2024-01-01').toISOString(),
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
      createdAt: new Date('2024-01-02').toISOString(),
    },
    {
      id: '3',
      title: 'Cozy 1-Bedroom Studio in Garki',
      price: 26667, // Daily rate (under 100K)
      location: 'Abuja',
      beds: 1,
      baths: 1,
      image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      isFavorite: false,
      rating: 4.98,
      createdAt: new Date('2024-01-03').toISOString(),
    },
    {
      id: '4',
      title: 'Spacious 4-Bedroom Family Home in Port Harcourt',
      price: 60000, // Daily rate (under 100K)
      location: 'Port Harcourt',
      beds: 4,
      baths: 3,
      image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      isFavorite: false,
      rating: 4.91,
      createdAt: new Date('2024-01-04').toISOString(),
    },
    {
      id: '5',
      title: 'Elegant 2-Bedroom Apartment in Ibadan',
      price: 20000, // Daily rate (under 100K)
      location: 'Ibadan',
      beds: 2,
      baths: 2,
      image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
      isFavorite: false,
      rating: 4.99,
      createdAt: new Date('2024-01-05').toISOString(),
    },
    {
      id: '6',
      title: 'Contemporary 3-Bedroom Duplex in Kano',
      price: 40000, // Daily rate (under 100K)
      location: 'Kano',
      beds: 3,
      baths: 3,
      image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      isFavorite: false,
      rating: 4.88,
      createdAt: new Date('2024-01-06').toISOString(),
    },
    {
      id: '7',
      title: 'Stylish 2-Bedroom Apartment in Ikeja',
      price: 50000, // Daily rate (under 100K)
      location: 'Lagos',
      beds: 2,
      baths: 2,
      image: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
      isFavorite: false,
      rating: 4.93,
      createdAt: new Date('2024-01-07').toISOString(),
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
      createdAt: new Date('2024-01-08').toISOString(),
    },
  ];
};

// Helper to format listings for ExploreScreen
const formatListingsForExplore = (listings) => {
  return listings.map(listing => ({
    id: listing.id || listing._id || String(listing.id),
    title: listing.title || listing.name || 'Apartment',
    price: listing.price || listing.rent || 0,
    location: listing.location || listing.address || 'Nigeria',
    beds: listing.bedrooms || listing.beds || 1,
    baths: listing.bathrooms || listing.baths || 1,
    bedrooms: listing.bedrooms || listing.beds || null,
    bathrooms: listing.bathrooms || listing.baths || null,
    area: listing.area || null,
    maxGuests: listing.maxGuests || null,
    description: listing.description || null,
    amenities: listing.amenities || null,
    image: listing.image || listing.images?.[0] || listing.photo || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    images: (() => {
      // If listing has images array, use it
      if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
        return listing.images.filter(img => img && img.trim && img.trim() !== '');
      }
      // If no images array but we have a main image, create array with it
      if (listing.image) {
        return [listing.image];
      }
      // If we have photo field, use it
      if (listing.photo) {
        return [listing.photo];
      }
      // Return empty array (will use default in details screen)
      return [];
    })(),
    isFavorite: false,
    rating: listing.rating || 4.5,
    createdAt: listing.createdAt || new Date().toISOString(),
    createdBy: listing.createdBy || null, // Preserve createdBy field for host matching
    hostName: listing.hostName || null,
    isSuperhost: listing.isSuperhost || false,
    hostEmail: listing.hostEmail || null,
    hostProfilePicture: listing.hostProfilePicture || null,
  }));
};

// Helper to merge API listings with local listings (API first, then local-only)
const mergeWithUserListings = async (apiApartments = [], userListings = null) => {
  try {
    // Get user listings if not provided
    if (!userListings) {
      userListings = await getListings();
    }
    
    // Format API apartments FIRST (these are from ALL devices - cross-platform)
    const formattedApiApartments = apiApartments && apiApartments.length > 0
      ? formatListingsForExplore(apiApartments)
      : [];
    
    // Get pending sync listings (local-only listings that haven't been synced yet)
    const pendingSync = await getPendingSyncListings();
    const pendingLocalIds = new Set(pendingSync.map(p => p.localId));
    
    // Format local listings (only include those that are pending sync)
    const localOnlyListings = userListings && userListings.length > 0
      ? userListings.filter(listing => {
          const listingId = listing.id || listing._id || String(listing.id);
          return pendingLocalIds.has(listingId);
        })
      : [];
    
    const formattedLocalListings = localOnlyListings.length > 0
      ? formatListingsForExplore(localOnlyListings)
      : [];
    
    // Create a set of API listing IDs for deduplication
    const apiListingIds = new Set(formattedApiApartments.map(apt => {
      const id = apt.id || apt._id || String(apt.id);
      return id;
    }));
    
    // Filter out local listings that already exist in API (prefer API version)
    const uniqueLocalListings = formattedLocalListings.filter(listing => {
      const listingId = listing.id || listing._id || String(listing.id);
      return !apiListingIds.has(listingId);
    });
    
    // Sort both arrays by most recent first
    const sortedApiApartments = formattedApiApartments.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.createdAt || b.updatedAt || 0);
      return dateB - dateA; // Most recent first
    });
    
    const sortedLocalListings = uniqueLocalListings.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.createdAt || b.updatedAt || 0);
      return dateB - dateA; // Most recent first
    });
    
    // Combine: API listings first (cross-platform), then local-only listings (pending sync)
    const result = [...sortedApiApartments, ...sortedLocalListings];
    console.log('Final merged result:', result.length, 'API:', sortedApiApartments.length, 'Local-only:', sortedLocalListings.length);
    return result;
  } catch (error) {
    console.error('Error merging listings:', error);
    // Fallback: return API apartments if available, otherwise local listings
    try {
      if (apiApartments && apiApartments.length > 0) {
        return formatListingsForExplore(apiApartments);
      }
      const userListings = await getListings();
      if (userListings && userListings.length > 0) {
        return formatListingsForExplore(userListings);
      }
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
    return [];
  }
};

// Helper to format listing for ExploreScreen
const formatListingForExplore = (listing) => {
  return {
    id: listing.id || listing._id || String(listing.id),
    title: listing.title || listing.name || 'Apartment',
    price: listing.price || listing.rent || 0,
    location: listing.location || listing.address || 'Nigeria',
    beds: listing.bedrooms || listing.beds || 1,
    baths: listing.bathrooms || listing.baths || 1,
    image: listing.image || listing.images?.[0] || listing.photo || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    isFavorite: false,
    rating: listing.rating || 4.5,
    createdAt: listing.createdAt || new Date().toISOString(),
  };
};

// Helper to add new listing to cached apartments at the top
// Note: User listings are stored in 'userListings' and will always be loaded
// This function is kept for backward compatibility but user listings take priority
const addToCachedApartments = async (newListing) => {
  try {
    // User listings are stored separately in 'userListings' key
    // They will be automatically included when getApartments() is called
    // No need to add to cached_apartments as user listings are always loaded first
    console.log('Listing added to userListings, will appear at top of ExploreScreen');
  } catch (error) {
    console.error('Error in addToCachedApartments:', error);
    // Continue even if this fails - user listings are stored separately
  }
};

// Helper to remove listing from cached apartments
const removeFromCachedApartments = async (listingId) => {
  try {
    // User listings are stored in 'userListings' and will be removed by deleteListing()
    // Also remove from cached_api_apartments if it exists there
    try {
      const cached = await AsyncStorage.getItem('cached_api_apartments');
      if (cached) {
        const cachedApartments = JSON.parse(cached);
        const filteredApartments = cachedApartments.filter(apt => apt.id !== listingId);
        await AsyncStorage.setItem('cached_api_apartments', JSON.stringify(filteredApartments));
      }
    } catch (error) {
      // Continue even if this fails
    }
  } catch (error) {
    console.error('Error removing from cached apartments:', error);
    // Continue even if cache update fails
  }
};

// Hybrid Apartment Service
export const hybridApartmentService = {
  getApartments: async (filters = {}) => {
    try {
      // PRIORITY 1: Fetch from API first (these contain listings from ALL devices/users)
      // This ensures cross-platform visibility (iOS users see Android listings and vice versa)
      let apiApartments = [];
      try {
        const apartments = await apartmentService.getApartments(filters);
        if (apartments !== null && apartments !== undefined) {
          apiApartments = Array.isArray(apartments) ? apartments : [];
          // Cache API apartments for offline access
          if (apiApartments.length > 0) {
            await AsyncStorage.setItem('cached_api_apartments', JSON.stringify(apiApartments));
            console.log('✅ Loaded', apiApartments.length, 'listings from API (cross-platform)');
          }
        }
      } catch (apiError) {
        console.log('⚠️ API fetch failed, using cached listings:', apiError.message);
        // If API fails, try to load cached API apartments
        try {
          const cached = await AsyncStorage.getItem('cached_api_apartments');
          if (cached) {
            apiApartments = JSON.parse(cached);
            console.log('✅ Using cached API listings:', apiApartments.length);
          }
        } catch (cacheError) {
          console.log('No cached API apartments available');
        }
      }
      
      // PRIORITY 2: Get local-only listings (those pending sync)
      const allListings = await getListings();
      
      // Merge: API listings first (cross-platform), then local-only listings (pending sync)
      const merged = await mergeWithUserListings(apiApartments, allListings);
      console.log('✅ Merged apartments:', merged.length, 'API:', apiApartments.length, 'Local-only:', allListings.length);
      return merged;
    } catch (error) {
      console.error('Error getting apartments:', error);
      // Fallback: try cached API listings first, then local listings
      try {
        const cached = await AsyncStorage.getItem('cached_api_apartments');
        if (cached) {
          const apiApartments = JSON.parse(cached);
          return formatListingsForExplore(apiApartments);
        }
        const allListings = await getListings();
        if (allListings && allListings.length > 0) {
          return formatListingsForExplore(allListings);
        }
      } catch (fallbackError) {
        console.error('Error in fallback:', fallbackError);
      }
      return [];
    }
  },
  
  // Get all apartments including default ones for ExploreScreen
  getAllApartmentsForExplore: async () => {
    try {
      // PRIORITY 1: Get API apartments first (these contain listings from ALL devices/users)
      // This ensures cross-platform visibility (iPhone users see Android listings and vice versa)
      let apiApartments = [];
      try {
        const apartments = await apartmentService.getApartments();
        if (apartments !== null && apartments !== undefined) {
          apiApartments = Array.isArray(apartments) ? apartments : [];
          
          // Cache API apartments for offline access
          if (apiApartments.length > 0) {
            await AsyncStorage.setItem('cached_api_apartments', JSON.stringify(apiApartments));
            console.log('✅ Loaded', apiApartments.length, 'API listings (cross-platform)');
          }
        }
      } catch (apiError) {
        console.log('⚠️ API fetch failed, using cached listings:', apiError.message);
        // If API fails, try cached API apartments (from previous successful fetch)
        try {
          const cached = await AsyncStorage.getItem('cached_api_apartments');
          if (cached) {
            apiApartments = JSON.parse(cached);
            console.log('✅ Using cached API listings:', apiApartments.length);
          }
        } catch (cacheError) {
          console.log('No cached API apartments available');
        }
      }
      
      // PRIORITY 2: Get local listings (include ALL local listings for immediate visibility)
      // This ensures newly created listings appear immediately even if they're saved to API
      // Deduplication will happen later - API listings take priority
      const allListings = await getListings();
      
      // Include ALL local listings - deduplication happens later where API takes priority
      // This ensures newly created listings appear immediately on homepage
      const localOnlyListings = allListings;
      
      // Format API apartments FIRST (these are from ALL devices - cross-platform)
      const formattedApiApartments = apiApartments && apiApartments.length > 0
        ? formatListingsForExplore(apiApartments)
        : [];
      
      // Format local-only listings (listings created on this device, pending sync)
      const formattedLocalListings = localOnlyListings && localOnlyListings.length > 0
        ? formatListingsForExplore(localOnlyListings)
        : [];
      
      // Get default apartments (these are the hardcoded ones in ExploreScreen)
      // ALWAYS include these as base listings for new users
      const defaultApartments = getDefaultApartments();
      
      // Combine all: API apartments first (cross-platform), then local-only listings, then defaults
      // Deduplication: prefer API version if both exist
      const allIds = new Set();
      const combined = [];
      
      // PRIORITY 1: Add API apartments first (these are from ALL devices - cross-platform)
      formattedApiApartments.forEach(apt => {
        const aptId = apt.id || apt._id || String(apt.id);
        if (!allIds.has(aptId)) {
          allIds.add(aptId);
          combined.push(apt);
        }
      });
      
      // PRIORITY 2: Add local-only listings (avoid duplicates with API apartments)
      // These are listings created on this device that haven't synced yet
      formattedLocalListings.forEach(listing => {
        const listingId = listing.id || listing._id || String(listing.id);
        if (!allIds.has(listingId)) {
          allIds.add(listingId);
          combined.push(listing);
        }
      });
      
      // PRIORITY 3: Add default apartments (avoid duplicates) - these are always shown
      defaultApartments.forEach(apt => {
        if (!allIds.has(apt.id)) {
          allIds.add(apt.id);
          combined.push(apt);
        }
      });
      
      // Sort by most recent first (all listings, regardless of source)
      combined.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB - dateA; // Most recent first
      });
      
      console.log('✅ All apartments combined:', combined.length, 'API:', formattedApiApartments.length, 'Local-only:', formattedLocalListings.length);
      
      // ALWAYS return at least default apartments
      return combined.length > 0 ? combined : defaultApartments;
    } catch (error) {
      console.error('Error getting all apartments:', error);
      // Fallback: try cached API listings first, then local listings, then defaults
      try {
        const cached = await AsyncStorage.getItem('cached_api_apartments');
        if (cached) {
          const apiApartments = JSON.parse(cached);
          const formatted = formatListingsForExplore(apiApartments);
          const defaults = getDefaultApartments();
          return [...formatted, ...defaults];
        }
        const allListings = await getListings();
        const formattedUserListings = allListings && allListings.length > 0
          ? formatListingsForExplore(allListings)
          : [];
        const defaultApartments = getDefaultApartments();
        return [...formattedUserListings, ...defaultApartments];
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        // Last resort: return default apartments
        return getDefaultApartments();
      }
    }
  },

  getApartmentById: async (id) => {
    try {
      const apartment = await apartmentService.getApartmentById(id);
      if (apartment === null || apartment === undefined) {
        throw new Error('API returned null');
      }
      return apartment;
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      const cached = await AsyncStorage.getItem('cached_apartments');
      if (cached) {
        const apartments = JSON.parse(cached);
        return apartments.find(apt => apt.id === id || apt._id === id) || null;
      }
      return null;
    }
  },

  createApartment: async (apartmentData) => {
    try {
      // PRIORITY 1: Try API save first (this makes listing visible to ALL users on ALL devices)
      // This ensures cross-platform visibility (iPhone users see Android listings and vice versa)
      let apiResult = null;
      try {
        apiResult = await apartmentService.createApartment(apartmentData);
        if (apiResult !== null && apiResult !== undefined) {
          console.log('✅ Listing saved to API - visible to all users on all devices:', apiResult.id || apiResult._id);
          
          // CRITICAL: Also save locally so it appears immediately on homepage
          // Even though API save succeeded, we save locally to ensure immediate visibility
          // The local version will be replaced by API version on next fetch
          try {
            // Format API result for local storage (use API ID if available)
            const localListingData = {
              ...apartmentData,
              id: apiResult.id || apiResult._id || apartmentData.id,
              _id: apiResult._id || apiResult.id || apartmentData._id,
            };
            const localListing = await addListing(localListingData);
            console.log('✅ Listing also saved locally for immediate visibility:', localListing.id);
          } catch (localError) {
            console.warn('⚠️ Could not save listing locally (non-fatal):', localError.message);
            // Continue - API save succeeded, listing will appear on next API fetch
          }
          
          // CRITICAL: Clear API cache so new listing appears immediately
          // This forces getAllApartmentsForExplore to refetch from API
          try {
            await AsyncStorage.removeItem('cached_api_apartments');
            console.log('✅ Cleared API cache - new listing will appear on next load');
          } catch (cacheError) {
            console.warn('⚠️ Could not clear API cache (non-fatal):', cacheError.message);
          }
          
          return apiResult;
        }
      } catch (apiError) {
        console.log('⚠️ API save failed, will save locally and queue for sync:', apiError.message);
        // Continue to local storage save and queue for sync
      }
      
      // PRIORITY 2: Save to local storage (ensures listing appears even if API fails)
      // This ensures the listing appears on this device immediately
      const newListing = await addListing(apartmentData);
      console.log('✅ Listing saved to local storage:', newListing.id, newListing.title);
      
      // Queue for automatic sync to API (will sync when connection is available)
      try {
        await queueListingForSync(newListing);
        console.log('✅ Listing queued for automatic sync to API');
      } catch (queueError) {
        console.warn('⚠️ Could not queue listing for sync:', queueError);
        // Continue - listing is saved locally
      }
      
      // Return the locally saved listing - it will appear on ExploreScreen
      // It will automatically sync to API in the background
      return newListing;
    } catch (error) {
      console.error('Error creating apartment:', error);
      // If addListing fails, try again
      try {
        const newListing = await addListing(apartmentData);
        console.log('✅ Listing saved on retry:', newListing.id);
        
        // Queue for sync
        try {
          await queueListingForSync(newListing);
        } catch (queueError) {
          console.warn('Could not queue listing for sync:', queueError);
        }
        
        return newListing;
      } catch (retryError) {
        console.error('Failed to save listing after retry:', retryError);
        throw retryError;
      }
    }
  },

  getMyApartments: async () => {
    try {
      const result = await apartmentService.getMyApartments();
      // If API returns null, use fallback
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
      // Silent fallback - get current user's listings from global storage
      const { getMyListings } = await import('../utils/listings');
      return await getMyListings();
    }
  },

  deleteApartment: async (listingId) => {
    try {
      // Get current user email for local deletion
      const getCurrentUserEmail = async () => {
        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            return user.email || null;
          }
        } catch (error) {
          console.error('Error getting current user email:', error);
        }
        return null;
      };
      
      const userEmail = await getCurrentUserEmail();
      
      // Check if listing is in sync queue (local-only listing)
      const pendingSync = await getPendingSyncListings();
      const isPendingSync = pendingSync.some(p => p.localId === listingId);
      
      // If it's a pending sync listing, remove from queue first
      if (isPendingSync) {
        try {
          await removeFromSyncQueue(listingId);
          console.log('✅ Removed listing from sync queue:', listingId);
        } catch (queueError) {
          console.warn('Could not remove from sync queue:', queueError);
        }
      }
      
      // Try to delete from API
      // Check if this listing exists in API by checking if ID is numeric or if it's in cached API listings
      // Local listings have IDs like "listing_1234567890_abc123"
      const listingIdStr = String(listingId);
      const isLocalId = listingIdStr.startsWith('listing_');
      const isNumericId = !isNaN(Number(listingId)) && Number(listingId) > 0;
      
      // Try API delete if it's a numeric ID (likely from API) or if it's not a local ID
      if (isNumericId || (!isLocalId && listingIdStr.length < 50)) {
        try {
          // Convert to number if it's numeric (API expects numeric ID)
          const apiId = isNumericId ? Number(listingId) : listingId;
          await apartmentService.deleteApartment(apiId);
          console.log('✅ Deleted listing from API:', apiId);
        } catch (apiError) {
          // Check if it's a 404 (listing doesn't exist in API) or other error
          if (apiError.response?.status === 404) {
            console.log('ℹ️ Listing not found in API (may be local-only), continuing with local deletion');
          } else {
            console.log('⚠️ API delete failed:', apiError.message);
            // Continue with local deletion - don't fail completely
          }
        }
      } else {
        console.log('ℹ️ Listing appears to be local-only (ID format:', listingIdStr.substring(0, 20) + '...), skipping API delete');
      }
      
      // Always delete from local storage
      try {
        await deleteListing(listingId, userEmail);
        console.log('✅ Deleted listing from local storage:', listingId);
      } catch (localError) {
        // If local deletion fails and it's not an API listing, throw error
        if (!isNumericId && (isLocalId || listingIdStr.length >= 50)) {
          throw localError;
        }
        console.warn('⚠️ Local deletion failed, but API deletion may have succeeded:', localError);
      }
      
      // Remove from cached apartments so it disappears from ExploreScreen
      await removeFromCachedApartments(listingId);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting apartment:', error);
      throw error;
    }
  },
};

// Hybrid Booking Service
export const hybridBookingService = {
  createBooking: async (userEmail, bookingData) => {
    try {
      const result = await bookingService.createBooking(bookingData);
      // If API returns null, use local storage
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      // Also save locally for offline access
      await addBooking(userEmail, bookingData);
      return result;
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      return await addBooking(userEmail, bookingData);
    }
  },

  getBookings: async (userEmail) => {
    try {
      const result = await bookingService.getMyBookings();
      // If API returns null, use fallback
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      return await getBookings(userEmail);
    }
  },
};

// Hybrid Wallet Service - API Only (Flutterwave Integration)
export const hybridWalletService = {
  getBalance: async (userEmail) => {
    try {
      if (!userEmail) {
        console.warn('getBalance: No user email provided');
        return 0;
      }
      
      const normalizedEmail = userEmail.toLowerCase().trim();
      
      // Try API balance first
      let apiBalance = 0;
      try {
        const result = await walletService.getBalance();
        if (result !== null && result !== undefined) {
          // Handle different response formats
          let balance = null;
          
          if (typeof result === 'number') {
            balance = result;
          } else if (result && typeof result === 'object') {
            balance = result.balance !== undefined ? result.balance : 
                      result.amount !== undefined ? result.amount : 
                      result.value !== undefined ? result.value : null;
            
            if (balance !== null && typeof balance === 'object') {
              balance = balance.value !== undefined ? balance.value : 
                       balance.amount !== undefined ? balance.amount : 
                       balance.balance !== undefined ? balance.balance : null;
            }
          } else if (typeof result === 'string') {
            balance = parseFloat(result);
          }
          
          if (balance !== null && balance !== undefined) {
            const parsed = parseFloat(balance);
            if (!isNaN(parsed) && parsed >= 0) {
              apiBalance = Math.floor(parsed);
            }
          }
        }
      } catch (apiError) {
        console.warn('⚠️ Error fetching API balance (non-fatal):', apiError.message);
      }
      
      // If API balance is 0 or null, try calculating from transactions
      // But prefer API balance if it's non-zero (even if transactions aren't returned)
      if (apiBalance === 0 || apiBalance === null) {
        try {
          const { getTransactions } = await import('../utils/wallet');
          const { calculateBalanceFromTransactions } = await import('../services/transactionSyncService');
          const transactions = await getTransactions(normalizedEmail);
          const calculatedBalance = calculateBalanceFromTransactions(transactions);
          
          if (calculatedBalance > 0) {
            console.log(`✅ Calculated balance from transactions: ₦${calculatedBalance.toLocaleString()} (API returned 0)`);
            return calculatedBalance;
          }
        } catch (calcError) {
          console.warn('⚠️ Error calculating balance from transactions:', calcError.message);
        }
      } else {
        // API balance is non-zero - use it even if we don't have transactions
        // This handles cases where transactions exist but aren't being returned
        console.log(`✅ Using API balance: ₦${apiBalance.toLocaleString()} (transactions may not be returned yet)`);
      }
      
      // Fallback to local balance if API balance is still 0
      if (apiBalance === 0) {
        try {
          const { getWalletBalance } = await import('../utils/wallet');
          const localBalance = await getWalletBalance(normalizedEmail);
          if (localBalance > 0) {
            console.log(`✅ Using local balance: ₦${localBalance.toLocaleString()} (API returned 0)`);
            return localBalance;
          }
        } catch (localError) {
          console.warn('⚠️ Error fetching local balance:', localError.message);
        }
      }
      
      console.log(`✅ Wallet balance: ₦${apiBalance.toLocaleString()} for ${userEmail}`);
      return apiBalance;
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      // Final fallback to local balance
      try {
        const { getWalletBalance } = await import('../utils/wallet');
        return await getWalletBalance(userEmail) || 0;
      } catch (fallbackError) {
        return 0;
      }
    }
  },

  fundWallet: async (userEmail, amount, method = 'bank_transfer', senderName = null, senderEmail = null, paymentReference = null) => {
    try {
      if (!userEmail) {
        throw new Error('User email is required for wallet funding');
      }
      const normalizedEmail = userEmail.toLowerCase().trim();
      
      const integerAmount = Math.floor(parseFloat(amount));
      console.log(`💰 Funding wallet via Flutterwave: ${normalizedEmail}, Amount: ₦${integerAmount.toLocaleString()}, Method: ${method}, Reference: ${paymentReference || 'N/A'}`);
      
      // Call API with Flutterwave reference - wallet will be updated via webhook
      const result = await walletService.fundWallet(integerAmount, method, paymentReference || null);
      if (result === null || result === undefined) {
        throw new Error('API returned null - wallet funding failed');
      }
      
      const balance = result.balance || result.amount || 0;
      console.log(`✅ Wallet funding initiated: ${normalizedEmail}, New balance: ₦${balance.toLocaleString()}`);
      return { balance: balance, amount: balance };
    } catch (error) {
      console.error(`❌ Error funding wallet for ${userEmail}:`, error);
      throw error;
    }
  },

  getTransactions: async (userEmail) => {
    try {
      if (!userEmail) {
        console.warn('getTransactions: No user email provided - returning empty array');
        return [];
      }
      
      const normalizedEmail = userEmail.toLowerCase().trim();
      if (!normalizedEmail || normalizedEmail.length === 0) {
        console.warn('getTransactions: Invalid user email - returning empty array');
        return [];
      }
      
      // Get transactions from API
      let apiTransactions = [];
      try {
        const result = await walletService.getTransactions();
        if (result !== null && result !== undefined) {
          apiTransactions = Array.isArray(result) ? result : (result.data || []);
        }
      } catch (apiError) {
        console.warn('⚠️ Error fetching transactions from API (non-fatal):', apiError.message);
      }
      
      // Filter API transactions to ensure they belong to this user
      const userApiTransactions = apiTransactions
        .filter(txn => {
          if (txn.userEmail) {
            return txn.userEmail.toLowerCase().trim() === normalizedEmail;
          }
          // If no userEmail, assume it belongs to current user (from API)
          return true;
        })
        .map(txn => ({
          ...txn,
          userEmail: normalizedEmail,
        }));
      
      // Get local transactions as fallback
      let localTransactions = [];
      try {
        const { getTransactions: getLocalTransactions } = await import('../utils/wallet');
        localTransactions = await getLocalTransactions(normalizedEmail);
      } catch (localError) {
        console.warn('⚠️ Error fetching local transactions (non-fatal):', localError.message);
      }
      
      // Merge API and local transactions
      const { mergeTransactions } = await import('../services/transactionSyncService');
      const mergedTransactions = mergeTransactions(userApiTransactions, localTransactions);
      
      // Verify all transactions have proper references
      const transactionsWithoutRef = mergedTransactions.filter(t => !t.reference && !t.paymentReference && !t.id);
      if (transactionsWithoutRef.length > 0) {
        console.warn(`⚠️ Found ${transactionsWithoutRef.length} transactions without proper references for ${normalizedEmail}`);
      }
      
      // Log transaction references for debugging
      if (mergedTransactions.length > 0) {
        const refs = mergedTransactions.slice(0, 5).map(t => t.reference || t.paymentReference || t.id || 'N/A').join(', ');
        console.log(`📋 Sample transaction references: ${refs}${mergedTransactions.length > 5 ? '...' : ''}`);
      }
      
      console.log(`✅ Loaded ${mergedTransactions.length} transactions for ${normalizedEmail} (${userApiTransactions.length} API + ${localTransactions.length} local, ${mergedTransactions.length - userApiTransactions.length - localTransactions.length} duplicates removed)`);
      return mergedTransactions;
    } catch (error) {
      console.error('Error getting transactions:', error);
      // Fallback to local transactions only
      try {
        const { getTransactions: getLocalTransactions } = await import('../utils/wallet');
        return await getLocalTransactions(userEmail);
      } catch (fallbackError) {
        console.error('Fallback to local transactions also failed:', fallbackError);
        return [];
      }
    }
  },

  makePayment: async (userEmail, amount, description, bookingId = null) => {
    try {
      if (!userEmail) {
        throw new Error('User email is required for payment');
      }
      
      const result = await walletService.makePayment(amount, description, bookingId);
      if (result === null || result === undefined) {
        throw new Error('API returned null - payment failed');
      }
      
      console.log(`✅ Payment processed via Flutterwave: ${userEmail}, Amount: ₦${amount.toLocaleString()}`);
      return result;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  withdrawFunds: async (userEmail, amount, method = 'Bank Transfer', accountDetails = '') => {
    try {
      if (!userEmail) {
        throw new Error('User email is required for withdrawal');
      }
      
      // Extract bank code and account number from accountDetails
      // Format: "BANK_CODE:ACCOUNT_NUMBER" or just account number
      let accountBank = null;
      let accountNumber = accountDetails;
      let beneficiaryName = null;
      
      if (accountDetails && accountDetails.includes(':')) {
        const parts = accountDetails.split(':');
        accountBank = parts[0];
        accountNumber = parts[1];
        if (parts.length > 2) {
          beneficiaryName = parts[2];
        }
      }
      
      // Call API with Flutterwave transfer details
      const result = await walletService.withdrawFunds?.(amount, method, accountDetails, accountBank, accountNumber, beneficiaryName);
      if (result === null || result === undefined) {
        throw new Error('API returned null - withdrawal failed');
      }
      
      const balance = result.balance || result.amount || 0;
      console.log(`✅ Withdrawal initiated via Flutterwave: ${userEmail}, Amount: ₦${amount.toLocaleString()}, New balance: ₦${balance.toLocaleString()}`);
      return { balance: balance, amount: amount };
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      throw error;
    }
  },

  sendMoneyToUser: async (fromUserEmail, toUserEmail, amount, description = '') => {
    try {
      // This function ensures money is sent from one user to another
      // Each user's wallet is completely isolated - this is the ONLY way money moves between users
      const { sendMoneyToUser: localSendMoney } = await import('../utils/wallet');
      const result = await localSendMoney(fromUserEmail, toUserEmail, amount, description);
      
      // Try API if available (for server-side tracking)
      try {
        await walletService.sendMoneyToUser?.(fromUserEmail, toUserEmail, amount, description);
      } catch (apiError) {
        console.log('API send money not available, using local storage only');
      }
      
      return result;
    } catch (error) {
      console.error('Error sending money to user:', error);
      throw error;
    }
  },

  // Comprehensive sync of all transactions from backend
  syncAllTransactions: async (userEmail) => {
    try {
      if (!userEmail) {
        throw new Error('User email is required for transaction sync');
      }
      
      const { syncAllTransactionsFromBackend } = await import('../services/transactionSyncService');
      const result = await syncAllTransactionsFromBackend(userEmail);
      
      console.log(`✅ Comprehensive sync completed: ${result.transactions.length} transactions, Balance: ₦${result.balance.toLocaleString()}`);
      return result;
    } catch (error) {
      console.error('Error in comprehensive transaction sync:', error);
      throw error;
    }
  },
};

// Hybrid Favorite Service
export const hybridFavoriteService = {
  addFavorite: async (apartmentId) => {
    // Normalize apartment ID to string for consistent comparison
    const normalizedId = String(apartmentId);
    
    try {
      const result = await favoriteService.addFavorite(apartmentId);
      // If API returns null, just continue with local storage
      if (result === null || result === undefined) {
        // Continue to local storage update
      }
    } catch (error) {
      // Silent - continue to local storage
    }
    // Always update local storage for immediate UI update - FRONTEND PRESERVED
    // Get current user email (or last user email if logged out)
    let userEmail = null;
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      userEmail = user.email;
    } else {
      // If logged out, use last user email to persist favorites
      const lastUserEmail = await AsyncStorage.getItem('lastUserEmail');
      userEmail = lastUserEmail;
    }
    
    if (userEmail) {
      const { getUserFavorites, saveUserFavorites } = await import('../utils/userStorage');
      const favorites = await getUserFavorites(userEmail);
      // Normalize all existing favorites to strings for comparison
      const normalizedFavorites = favorites.map(id => String(id));
      if (!normalizedFavorites.includes(normalizedId)) {
        normalizedFavorites.push(normalizedId);
        await saveUserFavorites(userEmail, normalizedFavorites);
        console.log('✅ Favorite added to local storage:', normalizedId, 'Total favorites:', normalizedFavorites.length, 'User:', userEmail);
      }
      return;
    }
    // Fallback to old key for backward compatibility
    const favoritesJson = await AsyncStorage.getItem('favorites');
    const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
    const normalizedFavorites = favorites.map(id => String(id));
    if (!normalizedFavorites.includes(normalizedId)) {
      normalizedFavorites.push(normalizedId);
      await AsyncStorage.setItem('favorites', JSON.stringify(normalizedFavorites));
      console.log('✅ Favorite added to local storage (fallback):', normalizedId, 'Total favorites:', normalizedFavorites.length);
    }
  },

  removeFavorite: async (apartmentId) => {
    // Normalize apartment ID to string for consistent comparison
    const normalizedId = String(apartmentId);
    
    try {
      const result = await favoriteService.removeFavorite(apartmentId);
      // If API returns null, just continue with local storage
      if (result === null || result === undefined) {
        // Continue to local storage update
      }
    } catch (error) {
      // Silent - continue to local storage
    }
    // Always update local storage - FRONTEND PRESERVED
    // Get current user email (or last user email if logged out)
    let userEmail = null;
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      userEmail = user.email;
    } else {
      // If logged out, use last user email to persist favorites
      const lastUserEmail = await AsyncStorage.getItem('lastUserEmail');
      userEmail = lastUserEmail;
    }
    
    if (userEmail) {
      const { getUserFavorites, saveUserFavorites } = await import('../utils/userStorage');
      const favorites = await getUserFavorites(userEmail);
      // Normalize all favorites to strings and filter
      const normalizedFavorites = favorites.map(id => String(id));
      const updated = normalizedFavorites.filter(id => id !== normalizedId);
      await saveUserFavorites(userEmail, updated);
      console.log('✅ Favorite removed from local storage:', normalizedId, 'Remaining favorites:', updated.length, 'User:', userEmail);
      return;
    }
    // Fallback to old key for backward compatibility
    const favoritesJson = await AsyncStorage.getItem('favorites');
    const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
    const normalizedFavorites = favorites.map(id => String(id));
    const updated = normalizedFavorites.filter(id => id !== normalizedId);
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
    console.log('✅ Favorite removed from local storage (fallback):', normalizedId, 'Remaining favorites:', updated.length);
  },

  getFavorites: async () => {
    // Always try to get favorites from local storage first (fast, works offline)
    // Then try API to sync, but don't fail if API fails
    let userEmail = null;
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        userEmail = user.email;
      } else {
        // If logged out, use last user email to access favorites
        const lastUserEmail = await AsyncStorage.getItem('lastUserEmail');
        userEmail = lastUserEmail;
      }
    } catch (error) {
      console.log('Could not get user email, will use fallback storage');
    }
    
    // Get favorites from local storage (primary source)
    let localFavorites = [];
    try {
      if (userEmail) {
        const { getUserFavorites } = await import('../utils/userStorage');
        localFavorites = await getUserFavorites(userEmail);
      } else {
        // Fallback to old key for backward compatibility
        const favoritesJson = await AsyncStorage.getItem('favorites');
        localFavorites = favoritesJson ? JSON.parse(favoritesJson) : [];
      }
    } catch (error) {
      console.error('Error loading favorites from local storage:', error);
      localFavorites = [];
    }
    
    // Normalize local favorites to strings
    const normalizedLocalFavorites = localFavorites.map(id => String(id));
    console.log('✅ Loaded favorites from local storage:', normalizedLocalFavorites.length, 'IDs:', normalizedLocalFavorites, 'User:', userEmail || 'anonymous');
    
    // Try to sync with API (non-blocking - don't fail if API fails)
    try {
      const result = await favoriteService.getFavorites();
      if (result !== null && result !== undefined) {
        const apiFavorites = Array.isArray(result) ? result : (result.data || []);
        const normalizedApiFavorites = apiFavorites.map(id => String(id));
        console.log('✅ Synced favorites from API:', normalizedApiFavorites.length);
        // Return API favorites if available, otherwise return local
        return normalizedApiFavorites.length > 0 ? normalizedApiFavorites : normalizedLocalFavorites;
      }
    } catch (error) {
      // API failed - that's okay, use local storage
      console.log('⚠️ API sync failed, using local storage:', error.message);
    }
    
    // Return local favorites (always available, works offline)
    return normalizedLocalFavorites;
  },
};

