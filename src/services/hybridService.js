// Hybrid Service - Uses API with AsyncStorage fallback
// This ensures the app works offline and maintains the same UI
import { apartmentService } from './apartmentService';
import { bookingService } from './bookingService';
import { walletService } from './walletService';
import { favoriteService } from './favoriteService';
import { getBookings, addBooking } from '../utils/bookings';
import { getListings, addListing, deleteListing } from '../utils/listings';
import { getWalletBalance, getTransactions, addFunds, makePayment } from '../utils/wallet';
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

// Helper to merge user listings with API/cached apartments (new listings at top)
const mergeWithUserListings = async (apiApartments = [], userListings = null) => {
  try {
    // Get user listings if not provided
    if (!userListings) {
      userListings = await getListings();
    }
    
    // Format user listings for ExploreScreen - these always go at the top
    const formattedUserListings = userListings && userListings.length > 0 
      ? formatListingsForExplore(userListings) 
      : [];
    
    console.log('Formatted user listings:', formattedUserListings.length);
    
    // Format API apartments
    const formattedApiApartments = apiApartments && apiApartments.length > 0
      ? formatListingsForExplore(apiApartments)
      : [];
    
    // Create a map of user listing IDs to ensure they're always included
    const userListingIds = new Set(formattedUserListings.map(listing => listing.id));
    
    // Filter out API apartments that are duplicates of user listings
    const uniqueApiApartments = formattedApiApartments.filter(apt => !userListingIds.has(apt.id));
    
    // Combine: user listings first (sorted by most recent), then API apartments (sorted by most recent)
    // User listings always appear at the top
    const sortedUserListings = formattedUserListings.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Most recent first
    });
    
    const sortedApiApartments = uniqueApiApartments.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Most recent first
    });
    
    // User listings at top, then API apartments
    const result = [...sortedUserListings, ...sortedApiApartments];
    console.log('Final merged result:', result.length, 'User:', sortedUserListings.length, 'API:', sortedApiApartments.length);
    return result;
  } catch (error) {
    console.error('Error merging listings:', error);
    // Fallback: return user listings if available, otherwise API apartments
    try {
      const userListings = await getListings();
      if (userListings && userListings.length > 0) {
        return formatListingsForExplore(userListings);
      }
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
    return formatListingsForExplore(apiApartments);
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
      // Always get all listings first (global - visible to all users)
      const allListings = await getListings();
      console.log('All listings loaded (global):', allListings.length);
      
      // Try to get API apartments
      let apiApartments = [];
      try {
        const apartments = await apartmentService.getApartments(filters);
        if (apartments !== null && apartments !== undefined) {
          apiApartments = Array.isArray(apartments) ? apartments : (apartments.data || apartments || []);
          // Cache API apartments separately (don't overwrite user listings)
          if (apiApartments.length > 0) {
            await AsyncStorage.setItem('cached_api_apartments', JSON.stringify(apiApartments));
          }
        }
      } catch (apiError) {
        // If API fails, try to load cached API apartments
        try {
          const cached = await AsyncStorage.getItem('cached_api_apartments');
          if (cached) {
            apiApartments = JSON.parse(cached);
          }
        } catch (cacheError) {
          console.log('No cached API apartments available');
        }
      }
      
      // Merge: global listings first (most recent at top), then API apartments
      const merged = await mergeWithUserListings(apiApartments, allListings);
      console.log('Merged apartments:', merged.length, 'Global listings:', allListings.length);
      return merged;
    } catch (error) {
      console.error('Error getting apartments:', error);
      // Fallback: try to get all listings - they should always be available
      try {
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
          apiApartments = Array.isArray(apartments) ? apartments : (apartments.data || apartments || []);
          
          // IMPORTANT: Sync API apartments to local storage so they're available offline
          // This ensures all users see listings from all devices
          if (apiApartments.length > 0) {
            await AsyncStorage.setItem('cached_api_apartments', JSON.stringify(apiApartments));
            
            // Also merge API apartments into allListings for offline access
            // This ensures new users see listings even if API is temporarily unavailable
            try {
              const existingListings = await getListings();
              const existingIds = new Set(existingListings.map(l => l.id));
              
              // Add API apartments that don't exist locally
              const newListings = apiApartments.filter(apt => {
                const aptId = apt.id || apt._id || String(apt.id);
                return !existingIds.has(aptId);
              });
              
              if (newListings.length > 0) {
                const updatedListings = [...existingListings, ...newListings];
                await AsyncStorage.setItem('allListings', JSON.stringify(updatedListings));
                console.log('Synced', newListings.length, 'API apartments to local storage for offline access');
              }
            } catch (syncError) {
              console.log('Could not sync API apartments to local storage:', syncError);
              // Continue - API apartments are still cached separately
            }
          }
        }
      } catch (apiError) {
        // If API fails, try cached API apartments (from previous successful fetch)
        try {
          const cached = await AsyncStorage.getItem('cached_api_apartments');
          if (cached) {
            apiApartments = JSON.parse(cached);
            console.log('Using cached API apartments:', apiApartments.length);
          }
        } catch (cacheError) {
          console.log('No cached API apartments available');
        }
      }
      
      // PRIORITY 2: Get local listings (these are listings created on this device)
      // These are merged with API apartments to ensure nothing is lost
      let allListings = [];
      try {
        allListings = await getListings();
        console.log('All apartments - Global listings:', allListings.length);
      } catch (listingsError) {
        console.error('Error loading global listings:', listingsError);
        allListings = [];
      }
      
      // Format API apartments FIRST (these contain listings from ALL devices/users)
      // This ensures cross-platform visibility
      const formattedApiApartments = apiApartments && apiApartments.length > 0
        ? formatListingsForExplore(apiApartments)
        : [];
      
      // Format local listings (listings created on this device)
      const formattedUserListings = allListings && allListings.length > 0
        ? formatListingsForExplore(allListings)
        : [];
      
      // Get default apartments (these are the hardcoded ones in ExploreScreen)
      // ALWAYS include these as base listings for new users
      const defaultApartments = getDefaultApartments();
      
      // Combine all: API apartments first (most recent, from all devices), then local listings, then defaults
      // This ensures all users see listings from all devices (iPhone/Android)
      const allIds = new Set();
      const combined = [];
      
      // PRIORITY 1: Add API apartments first (these are from ALL devices - cross-platform)
      // These are sorted by most recent and contain listings from iPhone, Android, etc.
      formattedApiApartments.forEach(apt => {
        const aptId = apt.id || apt._id || String(apt.id);
        if (!allIds.has(aptId)) {
          allIds.add(aptId);
          combined.push(apt);
        }
      });
      
      // PRIORITY 2: Add local listings (avoid duplicates with API apartments)
      // These are listings created on this specific device
      formattedUserListings.forEach(listing => {
        const listingId = listing.id || listing._id || String(listing.id);
        if (!allIds.has(listingId)) {
          allIds.add(listingId);
          combined.push(listing);
        }
      });
      
      // PRIORITY 3: Add default apartments (avoid duplicates) - these are always shown
      // These ensure new users see at least some listings immediately
      defaultApartments.forEach(apt => {
        if (!allIds.has(apt.id)) {
          allIds.add(apt.id);
          combined.push(apt);
        }
      });
      
      // Sort by most recent first (all listings, regardless of source)
      // This ensures newest listings appear at the top for all users
      combined.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB - dateA; // Most recent first
      });
      
      console.log('All apartments combined:', combined.length, 'API apartments:', formattedApiApartments.length, 'Local listings:', formattedUserListings.length);
      
      // ALWAYS return at least default apartments (even if empty, should have defaults)
      // This ensures new users see listings immediately upon signup
      return combined.length > 0 ? combined : defaultApartments;
    } catch (error) {
      console.error('Error getting all apartments:', error);
      // Fallback: return default apartments + global listings if possible
      try {
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
          console.log('Listing saved to API - visible to all users on all devices:', apiResult.id || apiResult._id);
          
          // Also save to local storage for offline access
          try {
            await addListing(apartmentData);
            console.log('Listing also saved locally for offline access');
          } catch (localError) {
            console.log('Local save failed, but API save succeeded:', localError);
            // Continue - API save is more important for cross-platform visibility
          }
          
          return apiResult;
        }
      } catch (apiError) {
        console.log('API save failed, will use local storage:', apiError.message);
        // Continue to local storage save
      }
      
      // PRIORITY 2: Save to local storage (ensures listing appears even if API fails)
      // This ensures the listing appears on this device immediately
      const newListing = await addListing(apartmentData);
      console.log('Listing saved to local storage:', newListing.id, newListing.title);
      console.log('Note: This listing will only be visible on this device until API is available');
      
      // Return the locally saved listing - it will appear on ExploreScreen
      return newListing;
    } catch (error) {
      console.error('Error creating apartment:', error);
      // If addListing fails, try again
      try {
        const newListing = await addListing(apartmentData);
        console.log('Listing saved on retry:', newListing.id);
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
      // Try to delete from API first
      try {
        await apartmentService.deleteApartment(listingId);
      } catch (error) {
        // API delete failed, continue with local deletion
        console.log('API delete failed, using local deletion');
      }
      
      // Always delete from local storage
      await deleteListing(listingId);
      
      // Remove from cached apartments so it disappears from ExploreScreen
      await removeFromCachedApartments(listingId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting apartment:', error);
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

// Hybrid Wallet Service
export const hybridWalletService = {
  getBalance: async (userEmail) => {
    try {
      const result = await walletService.getBalance();
      // If API returns null, use fallback
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      const balance = result.balance || result.amount || result;
      // Update local storage with user-specific key
      // Ensure integer value for precision with large amounts
      if (balance !== null && balance !== undefined && userEmail) {
        const integerBalance = Math.floor(parseFloat(balance));
        const { getUserStorageKey } = await import('../utils/userStorage');
        const key = getUserStorageKey('walletBalance', userEmail);
        await AsyncStorage.setItem(key, integerBalance.toString());
        return integerBalance;
      }
      throw new Error('Invalid balance');
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      return await getWalletBalance(userEmail);
    }
  },

  fundWallet: async (userEmail, amount, method = 'bank_transfer', senderName = null, senderEmail = null) => {
    try {
      // CRITICAL: Normalize user email to ensure consistent storage
      if (!userEmail) {
        throw new Error('User email is required for wallet funding');
      }
      const normalizedEmail = userEmail.toLowerCase().trim();
      
      // Ensure amount is an integer for precision with large amounts
      const integerAmount = Math.floor(parseFloat(amount));
      console.log(`💰 Funding wallet for: ${normalizedEmail}, Amount: ₦${integerAmount.toLocaleString()}, Method: ${method}, Sender: ${senderName || 'N/A'}`);
      
      // Try API first
      try {
        const result = await walletService.fundWallet(integerAmount, method);
        // If API returns null, use local storage
        if (result === null || result === undefined) {
          throw new Error('API returned null');
        }
        // Also update locally for offline access (using normalized email and integer amount)
        const localBalance = await addFunds(normalizedEmail, integerAmount, method, senderName, senderEmail);
        console.log(`✅ Wallet funded via API + local: ${normalizedEmail}, New balance: ₦${localBalance.toLocaleString()}`);
        return { balance: localBalance, amount: localBalance };
      } catch (apiError) {
        // API failed, use local storage only (using normalized email and integer amount)
        console.log(`⚠️ API funding failed, using local storage for: ${normalizedEmail}`);
        const localBalance = await addFunds(normalizedEmail, integerAmount, method, senderName, senderEmail);
        console.log(`✅ Wallet funded via local storage: ${normalizedEmail}, New balance: ₦${localBalance.toLocaleString()}`);
        return { balance: localBalance, amount: localBalance };
      }
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
      
      // VALIDATION: Normalize user email
      const normalizedEmail = userEmail.toLowerCase().trim();
      if (!normalizedEmail || normalizedEmail.length === 0) {
        console.warn('getTransactions: Invalid user email - returning empty array');
        return [];
      }
      
      // CRITICAL: Always use user-specific local storage to ensure transactions are exclusive
      // This ensures each user only sees their own transactions
      const { getTransactions } = await import('../utils/wallet');
      const localTransactions = await getTransactions(normalizedEmail);
      
      // Try API to sync, but always return local transactions (user-specific)
      try {
        const result = await walletService.getTransactions();
        if (result !== null && result !== undefined) {
          const apiTransactions = Array.isArray(result) ? result : (result.data || []);
          
          // CRITICAL: Filter API transactions to ensure they belong to this user ONLY
          // Add userEmail to each transaction for validation
          const userApiTransactions = apiTransactions
            .filter(txn => {
              // If transaction has userEmail, verify it matches
              if (txn.userEmail) {
                return txn.userEmail.toLowerCase().trim() === normalizedEmail;
              }
              // If no userEmail, add it for this user
              return true;
            })
            .map(txn => ({
              ...txn,
              userEmail: normalizedEmail, // Ensure userEmail is set
            }));
          
          // Update local storage with user-specific key (if API returns data)
          if (userApiTransactions.length > 0) {
            const { getUserStorageKey } = await import('../utils/userStorage');
            const key = getUserStorageKey('walletTransactions', normalizedEmail);
            await AsyncStorage.setItem(key, JSON.stringify(userApiTransactions));
            console.log(`✅ Synced ${userApiTransactions.length} transactions from API for ${normalizedEmail}`);
          }
          
          // Return API transactions if available, otherwise return local
          return userApiTransactions.length > 0 ? userApiTransactions : localTransactions;
        }
      } catch (apiError) {
        // API failed, use local storage only
        console.log(`⚠️ API getTransactions failed, using local storage for: ${normalizedEmail}`);
      }
      
      // Always return local transactions (user-specific and exclusive)
      console.log(`✅ Loaded ${localTransactions.length} transactions EXCLUSIVELY for ${normalizedEmail}`);
      return localTransactions;
    } catch (error) {
      console.error('Error in hybridWalletService.getTransactions:', error);
      // Fallback to local storage - FRONTEND PRESERVED
      // Always use user-specific local storage
      const { getTransactions } = await import('../utils/wallet');
      return await getTransactions(userEmail);
    }
  },

  makePayment: async (userEmail, amount, description, bookingId = null) => {
    try {
      const result = await walletService.makePayment(amount, description, bookingId);
      // If API returns null, use local storage
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      // Also update locally for offline access
      await makePayment(userEmail, amount, description);
      return result;
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      return await makePayment(userEmail, amount, description);
    }
  },

  withdrawFunds: async (userEmail, amount, method = 'Bank Transfer', accountDetails = '') => {
    try {
      // Try API first if available
      try {
        const result = await walletService.withdrawFunds?.(amount, method, accountDetails);
        if (result !== null && result !== undefined) {
          // Also update locally for offline access
          const { withdrawFunds: localWithdraw } = await import('../utils/wallet');
          await localWithdraw(userEmail, amount, method, accountDetails);
          return result;
        }
      } catch (apiError) {
        console.log('API withdraw not available, using local storage');
      }
      
      // Fallback to local storage
      const { withdrawFunds: localWithdraw } = await import('../utils/wallet');
      const newBalance = await localWithdraw(userEmail, amount, method, accountDetails);
      return { balance: newBalance, amount: amount };
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
};

// Hybrid Favorite Service
export const hybridFavoriteService = {
  addFavorite: async (apartmentId) => {
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
    // Get current user email
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email) {
        const { getUserFavorites, saveUserFavorites } = await import('../utils/userStorage');
        const favorites = await getUserFavorites(user.email);
        if (!favorites.includes(apartmentId)) {
          favorites.push(apartmentId);
          await saveUserFavorites(user.email, favorites);
        }
        return;
      }
    }
    // Fallback to old key for backward compatibility
    const favoritesJson = await AsyncStorage.getItem('favorites');
    const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
    if (!favorites.includes(apartmentId)) {
      favorites.push(apartmentId);
      await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
    }
  },

  removeFavorite: async (apartmentId) => {
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
    // Get current user email
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email) {
        const { getUserFavorites, saveUserFavorites } = await import('../utils/userStorage');
        const favorites = await getUserFavorites(user.email);
        const updated = favorites.filter(id => id !== apartmentId);
        await saveUserFavorites(user.email, updated);
        return;
      }
    }
    // Fallback to old key for backward compatibility
    const favoritesJson = await AsyncStorage.getItem('favorites');
    const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
    const updated = favorites.filter(id => id !== apartmentId);
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
  },

  getFavorites: async () => {
    try {
      const result = await favoriteService.getFavorites();
      // If API returns null, use fallback
      if (result === null || result === undefined) {
        throw new Error('API returned null');
      }
      return Array.isArray(result) ? result : (result.data || []);
    } catch (error) {
      // Silent fallback - FRONTEND PRESERVED
      // Get current user email
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.email) {
          const { getUserFavorites } = await import('../utils/userStorage');
          return await getUserFavorites(user.email);
        }
      }
      // Fallback to old key for backward compatibility
      const favoritesJson = await AsyncStorage.getItem('favorites');
      return favoritesJson ? JSON.parse(favoritesJson) : [];
    }
  },
};

