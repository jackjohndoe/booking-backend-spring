// Global listings utility functions
// Listings are shared across all users - everyone can see all listings
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALL_LISTINGS_KEY = 'allListings'; // Global key for all listings

// Helper to get current user email from AsyncStorage
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

/**
 * Add a new listing (global - visible to all users)
 */
export const addListing = async (listingData, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      throw new Error('User email is required to save listing');
    }

    // Get all listings (global)
    const listingsJson = await AsyncStorage.getItem(ALL_LISTINGS_KEY);
    const allListings = listingsJson ? JSON.parse(listingsJson) : [];
    
    // Preserve createdBy from listingData if it exists, otherwise use email parameter
    const createdBy = listingData.createdBy || email;
    
    const newListing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...listingData,
      createdAt: new Date().toISOString(),
      status: listingData.status || 'active',
      createdBy: createdBy, // Track who created this listing for deletion permission
    };
    
    // Add to beginning of array (most recent first)
    allListings.unshift(newListing);
    
    // Save all listings globally
    await AsyncStorage.setItem(ALL_LISTINGS_KEY, JSON.stringify(allListings));
    console.log('Listing added to global storage - visible to all users:', newListing.id);
    return newListing;
  } catch (error) {
    console.error('Error adding listing:', error);
    throw error;
  }
};

/**
 * Get all listings (global - all users' listings)
 */
export const getListings = async () => {
  try {
    const listingsJson = await AsyncStorage.getItem(ALL_LISTINGS_KEY);
    return listingsJson ? JSON.parse(listingsJson) : [];
  } catch (error) {
    console.error('Error getting listings:', error);
    return [];
  }
};

/**
 * Get listings created by a specific user
 */
export const getMyListings = async (userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      return [];
    }
    
    const allListings = await getListings();
    // Filter by creator email or hostEmail
    return allListings.filter(listing => 
      listing.createdBy === email || 
      listing.hostEmail === email ||
      (listing.createdBy && listing.createdBy.toLowerCase().trim() === email.toLowerCase().trim()) ||
      (listing.hostEmail && listing.hostEmail.toLowerCase().trim() === email.toLowerCase().trim())
    );
  } catch (error) {
    console.error('Error getting my listings:', error);
    return [];
  }
};

/**
 * Get listing by ID (from global listings)
 */
export const getListingById = async (listingId) => {
  try {
    const listings = await getListings();
    return listings.find(listing => listing.id === listingId);
  } catch (error) {
    console.error('Error getting listing by ID:', error);
    return null;
  }
};

/**
 * Update a listing (only if user is the creator)
 */
export const updateListing = async (listingId, updatedData, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      throw new Error('User email is required to update listing');
    }

    const allListings = await getListings();
    const index = allListings.findIndex(listing => listing.id === listingId);
    
    if (index === -1) {
      return null;
    }

    // Verify ownership
    const listing = allListings[index];
    const isOwner = listing.createdBy === email || 
                    listing.hostEmail === email ||
                    (listing.createdBy && listing.createdBy.toLowerCase().trim() === email.toLowerCase().trim()) ||
                    (listing.hostEmail && listing.hostEmail.toLowerCase().trim() === email.toLowerCase().trim());
    
    if (!isOwner) {
      throw new Error('You can only update your own listings');
    }
    
    allListings[index] = {
      ...allListings[index],
      ...updatedData,
      updatedAt: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(ALL_LISTINGS_KEY, JSON.stringify(allListings));
    return allListings[index];
  } catch (error) {
    console.error('Error updating listing:', error);
    throw error;
  }
};

/**
 * Delete a listing (only if user is the creator)
 */
export const deleteListing = async (listingId, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    
    const allListings = await getListings();
    const listing = allListings.find(l => {
      const id = l.id || l._id || String(l.id);
      return id === listingId || String(id) === String(listingId);
    });
    
    if (!listing) {
      console.log('Listing not found in local storage (may have been deleted or is API-only):', listingId);
      return true; // Return true if not found - it's already deleted or doesn't exist locally
    }

    // Verify ownership if email is available
    if (email) {
      const isOwner = listing.createdBy === email || 
                      listing.hostEmail === email ||
                      (listing.createdBy && listing.createdBy.toLowerCase().trim() === email.toLowerCase().trim()) ||
                      (listing.hostEmail && listing.hostEmail.toLowerCase().trim() === email.toLowerCase().trim());
      
      if (!isOwner) {
        throw new Error('You can only delete your own listings');
      }
    } else {
      console.warn('No user email provided, deleting listing without ownership verification:', listingId);
    }

    const filteredListings = allListings.filter(l => {
      const id = l.id || l._id || String(l.id);
      return id !== listingId && String(id) !== String(listingId);
    });
    
    await AsyncStorage.setItem(ALL_LISTINGS_KEY, JSON.stringify(filteredListings));
    console.log('✅ Listing deleted from global storage:', listingId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    throw error;
  }
};

