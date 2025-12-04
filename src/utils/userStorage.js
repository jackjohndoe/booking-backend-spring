// User-specific storage utilities
// Stores data keyed by user email to ensure data persistence and isolation
// 
// PERSISTENCE MODEL: All user data persists across sign-out and sign-in
// - Profile: userProfile_{userEmail} - PERSISTS
// - Wallet Balance: walletBalance_{userEmail} - PERSISTS
// - Transaction History: walletTransactions_{userEmail} - PERSISTS
// - Bookings: userBookings_{userEmail} - PERSISTS
// - Favorites: favorites_{userEmail} - PERSISTS
// - Notifications: notifications_{userEmail} - PERSISTS
//
// When user signs out, only the 'user' key (authentication) is removed
// All user-specific data remains in AsyncStorage and is automatically loaded on sign-in
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get the storage key for a specific user and data type
 * @param {string} dataType - Type of data (profile, listings, favorites, notifications)
 * @param {string} userEmail - User's email address
 * @returns {string} Storage key
 */
export const getUserStorageKey = (dataType, userEmail) => {
  if (!userEmail) {
    // Fallback to generic key if no user email (shouldn't happen in normal flow)
    return dataType;
  }
  // Normalize email (lowercase, trimmed) for consistent key generation
  const normalizedEmail = userEmail.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '_');
  return `${dataType}_${normalizedEmail}`;
};

/**
 * Get user profile data
 */
export const getUserProfile = async (userEmail) => {
  try {
    const key = getUserStorageKey('userProfile', userEmail);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

/**
 * Save user profile data
 */
export const saveUserProfile = async (userEmail, profileData) => {
  try {
    const key = getUserStorageKey('userProfile', userEmail);
    await AsyncStorage.setItem(key, JSON.stringify(profileData));
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};

/**
 * Get user listings
 */
export const getUserListings = async (userEmail) => {
  try {
    const key = getUserStorageKey('userListings', userEmail);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting user listings:', error);
    return [];
  }
};

/**
 * Save user listings
 */
export const saveUserListings = async (userEmail, listings) => {
  try {
    const key = getUserStorageKey('userListings', userEmail);
    await AsyncStorage.setItem(key, JSON.stringify(listings));
  } catch (error) {
    console.error('Error saving user listings:', error);
    throw error;
  }
};

/**
 * Get user favorites
 */
export const getUserFavorites = async (userEmail) => {
  try {
    const key = getUserStorageKey('favorites', userEmail);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting user favorites:', error);
    return [];
  }
};

/**
 * Save user favorites
 */
export const saveUserFavorites = async (userEmail, favorites) => {
  try {
    const key = getUserStorageKey('favorites', userEmail);
    await AsyncStorage.setItem(key, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving user favorites:', error);
    throw error;
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userEmail) => {
  try {
    const key = getUserStorageKey('notifications', userEmail);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

/**
 * Save user notifications
 */
export const saveUserNotifications = async (userEmail, notifications) => {
  try {
    const key = getUserStorageKey('notifications', userEmail);
    await AsyncStorage.setItem(key, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving user notifications:', error);
    throw error;
  }
};

/**
 * Get host ratings and reviews (global - all users can see all ratings)
 */
export const getHostRatings = async (hostEmail) => {
  try {
    if (!hostEmail) return [];
    const key = `hostRatings_${hostEmail.toLowerCase().trim()}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting host ratings:', error);
    return [];
  }
};

/**
 * Add a rating/review for a host (global - all users can see)
 */
export const addHostRating = async (hostEmail, ratingData) => {
  try {
    if (!hostEmail) throw new Error('Host email is required');
    const key = `hostRatings_${hostEmail.toLowerCase().trim()}`;
    const existingRatings = await getHostRatings(hostEmail);
    
    // Check if user already rated this host
    const userEmail = ratingData.userEmail;
    const existingIndex = existingRatings.findIndex(r => r.userEmail === userEmail);
    
    const newRating = {
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...ratingData,
      createdAt: new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      // Update existing rating
      existingRatings[existingIndex] = newRating;
    } else {
      // Add new rating
      existingRatings.push(newRating);
    }
    
    // Sort by most recent first
    existingRatings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    await AsyncStorage.setItem(key, JSON.stringify(existingRatings));
    return newRating;
  } catch (error) {
    console.error('Error adding host rating:', error);
    throw error;
  }
};

/**
 * Calculate average rating for a host
 */
export const getHostAverageRating = async (hostEmail) => {
  try {
    const ratings = await getHostRatings(hostEmail);
    if (ratings.length === 0) return { average: 0, count: 0 };
    
    const sum = ratings.reduce((acc, rating) => acc + (rating.rating || 0), 0);
    const average = sum / ratings.length;
    
    return {
      average: Math.round(average * 10) / 10, // Round to 1 decimal
      count: ratings.length,
    };
  } catch (error) {
    console.error('Error calculating host average rating:', error);
    return { average: 0, count: 0 };
  }
};

/**
 * Check for bookings that have been checked out and need rating
 * Returns bookings where checkout date has passed and user hasn't rated yet
 */
export const getBookingsNeedingRating = async (userEmail) => {
  try {
    if (!userEmail) return [];
    
    const { getBookings } = await import('./bookings');
    const bookings = await getBookings();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filter bookings where checkout date has passed
    const completedBookings = bookings.filter(booking => {
      if (!booking.checkOutDate) return false;
      if (booking.status === 'cancelled') return false;
      
      try {
        const checkoutDate = new Date(booking.checkOutDate);
        checkoutDate.setHours(0, 0, 0, 0);
        return checkoutDate < today;
      } catch (error) {
        console.error('Error parsing checkout date:', error);
        return false;
      }
    });
    
    // Check which ones haven't been rated yet
    const bookingsNeedingRating = [];
    for (const booking of completedBookings) {
      const hostEmail = booking.hostEmail || null;
      if (!hostEmail) continue;
      
      // Check if user has already rated this host
      const ratings = await getHostRatings(hostEmail);
      const hasRated = ratings.some(rating => 
        rating.userEmail && 
        rating.userEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()
      );
      
      if (!hasRated) {
        bookingsNeedingRating.push(booking);
      }
    }
    
    // Sort by checkout date (most recent first)
    bookingsNeedingRating.sort((a, b) => {
      const dateA = new Date(a.checkOutDate || 0);
      const dateB = new Date(b.checkOutDate || 0);
      return dateB - dateA;
    });
    
    return bookingsNeedingRating;
  } catch (error) {
    console.error('Error checking bookings needing rating:', error);
    return [];
  }
};

/**
 * Mark a booking as rating prompt shown (to avoid showing multiple times)
 */
export const markRatingPromptShown = async (bookingId) => {
  try {
    const key = `ratingPromptShown_${bookingId}`;
    await AsyncStorage.setItem(key, 'true');
  } catch (error) {
    console.error('Error marking rating prompt as shown:', error);
  }
};

/**
 * Check if rating prompt has been shown for a booking
 */
export const hasRatingPromptBeenShown = async (bookingId) => {
  try {
    const key = `ratingPromptShown_${bookingId}`;
    const shown = await AsyncStorage.getItem(key);
    return shown === 'true';
  } catch (error) {
    console.error('Error checking rating prompt status:', error);
    return false;
  }
};

/**
 * Check if user has seen/claimed the welcome deal
 * @param {string} userEmail - User's email address
 * @returns {Promise<boolean>} True if user has seen/claimed the deal
 */
export const hasSeenWelcomeDeal = async (userEmail) => {
  try {
    if (!userEmail) return false;
    const key = getUserStorageKey('welcomeDealSeen', userEmail);
    const seen = await AsyncStorage.getItem(key);
    return seen === 'true';
  } catch (error) {
    console.error('Error checking welcome deal status:', error);
    return false;
  }
};

/**
 * Mark welcome deal as seen/claimed
 * @param {string} userEmail - User's email address
 * @param {boolean} claimed - Whether the deal was claimed (true) or just dismissed (false)
 */
export const markWelcomeDealSeen = async (userEmail, claimed = false) => {
  try {
    if (!userEmail) return;
    const key = getUserStorageKey('welcomeDealSeen', userEmail);
    await AsyncStorage.setItem(key, 'true');
    
    // Also store if it was claimed
    const claimedKey = getUserStorageKey('welcomeDealClaimed', userEmail);
    await AsyncStorage.setItem(claimedKey, claimed ? 'true' : 'false');
  } catch (error) {
    console.error('Error marking welcome deal as seen:', error);
  }
};

/**
 * Migrate old data to user-specific keys (one-time migration)
 * This helps users who already have data in the old format
 */
export const migrateUserData = async (userEmail) => {
  if (!userEmail) return;

  try {
    // CRITICAL: Clean up old global wallet data first to prevent cross-user leakage
    // The old 'walletBalance' and 'walletTransactions' keys were shared between all users - these must be removed
    
    // Remove old global wallet balance
    try {
      const oldGlobalBalance = await AsyncStorage.getItem('walletBalance');
      if (oldGlobalBalance) {
        await AsyncStorage.removeItem('walletBalance');
        console.log('✅ Removed old global wallet balance to prevent cross-user leakage');
      }
    } catch (balanceCleanupError) {
      console.error('Error cleaning up old global wallet balance:', balanceCleanupError);
    }
    
    // Remove old global transactions
    try {
      const oldGlobalTransactions = await AsyncStorage.getItem('walletTransactions');
      if (oldGlobalTransactions) {
        await AsyncStorage.removeItem('walletTransactions');
        console.log('✅ Removed old global transaction data to prevent cross-user leakage');
      }
    } catch (transactionCleanupError) {
      console.error('Error cleaning up old global transactions:', transactionCleanupError);
    }
    
    // Migrate profile
    const oldProfile = await AsyncStorage.getItem('userProfile');
    if (oldProfile) {
      const profileData = JSON.parse(oldProfile);
      // Only migrate if it belongs to this user
      if (profileData.email && profileData.email.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
        await saveUserProfile(userEmail, profileData);
        console.log('Migrated user profile');
      }
    }

    // Migrate listings to global storage (all listings are shared)
    const oldListings = await AsyncStorage.getItem('userListings');
    if (oldListings) {
      const listings = JSON.parse(oldListings);
      // Check if global listings already exist
      const existingGlobalListings = await AsyncStorage.getItem('allListings');
      const globalListings = existingGlobalListings ? JSON.parse(existingGlobalListings) : [];
      
      // Add old listings to global storage (avoid duplicates)
      const existingIds = new Set(globalListings.map(l => l.id || String(l.id)));
      const newListings = listings.filter(listing => {
        const id = listing.id || String(listing.id);
        return !existingIds.has(id);
      });
      
      if (newListings.length > 0) {
        // Add createdBy field to track ownership
        const listingsWithOwner = newListings.map(listing => ({
          ...listing,
          createdBy: listing.hostEmail || userEmail,
        }));
        
        // Add to global storage (most recent first)
        const updatedGlobalListings = [...listingsWithOwner, ...globalListings];
        await AsyncStorage.setItem('allListings', JSON.stringify(updatedGlobalListings));
        console.log(`Migrated ${newListings.length} listings to global storage`);
      }
    }

    // Migrate favorites
    const oldFavorites = await AsyncStorage.getItem('favorites');
    if (oldFavorites) {
      const favorites = JSON.parse(oldFavorites);
      await saveUserFavorites(userEmail, favorites);
      console.log('Migrated user favorites');
    }

    // Migrate notifications
    const oldNotifications = await AsyncStorage.getItem('notifications');
    if (oldNotifications) {
      const notifications = JSON.parse(oldNotifications);
      await saveUserNotifications(userEmail, notifications);
      console.log('Migrated user notifications');
    }

    // CRITICAL: Do NOT migrate old global wallet balance to new users
    // Old wallet balance was shared globally and should NOT be copied to individual users
    // Each user must start with zero balance (unless they claim welcome bonus)
    
    // Clean up old global wallet balance key to prevent cross-user leakage
    try {
      const oldGlobalBalance = await AsyncStorage.getItem('walletBalance');
      if (oldGlobalBalance) {
        // Remove old global key - it should not be shared between users
        await AsyncStorage.removeItem('walletBalance');
        console.log('✅ Removed old global wallet balance to prevent cross-user leakage');
      }
    } catch (cleanupError) {
      console.error('Error cleaning up old global wallet balance:', cleanupError);
    }
    
    // Ensure new users ALWAYS start with zero balance
    const walletBalanceKey = getUserStorageKey('walletBalance', userEmail);
    const existingBalance = await AsyncStorage.getItem(walletBalanceKey);
    
    // Only initialize if user has no balance (new user)
    // Do NOT copy old global balance - it belongs to other users
    if (!existingBalance) {
      await AsyncStorage.setItem(walletBalanceKey, '0');
      console.log('✅ Initialized wallet balance to 0 for new user:', userEmail);
    } else {
      // User already has a balance - validate it's not corrupted or suspiciously high
      const parsedBalance = parseFloat(existingBalance);
      
      // CRITICAL: If balance is suspiciously high (> 1 million), it's likely from old global data
      // Reset to 0 for new users - legitimate users shouldn't have millions without transactions
      if (isNaN(parsedBalance) || parsedBalance < 0 || parsedBalance > 1000000) {
        // Suspiciously high balance (likely from old global data) - reset to 0
        await AsyncStorage.setItem(walletBalanceKey, '0');
        console.log(`✅ Reset suspicious wallet balance (${parsedBalance}) to 0 for user: ${userEmail}`);
      } else {
        // Balance is reasonable - keep it (user might have legitimately funded their wallet)
        console.log(`✅ User ${userEmail} has existing balance: ${parsedBalance}`);
      }
    }

    // CRITICAL: Do NOT migrate old global transactions to new users
    // Old transactions were shared globally and should NOT be copied to individual users
    // Each user must start with their own empty transaction history
    const walletTransactionsKey = getUserStorageKey('walletTransactions', userEmail);
    const existingTransactions = await AsyncStorage.getItem(walletTransactionsKey);
    
    // Only initialize if user has no transaction history (new user)
    // Do NOT copy old global transactions - they belong to other users
    if (!existingTransactions) {
      await AsyncStorage.setItem(walletTransactionsKey, JSON.stringify([]));
      console.log('✅ Initialized empty transaction history for new user:', userEmail);
    } else {
      // User already has transactions - verify they're valid JSON
      try {
        const parsed = JSON.parse(existingTransactions);
        if (!Array.isArray(parsed)) {
          // Invalid format - reset to empty array
          await AsyncStorage.setItem(walletTransactionsKey, JSON.stringify([]));
          console.log('✅ Reset invalid transaction history for user:', userEmail);
        }
      } catch (error) {
        // Invalid JSON - reset to empty array
        await AsyncStorage.setItem(walletTransactionsKey, JSON.stringify([]));
        console.log('✅ Reset corrupted transaction history for user:', userEmail);
      }
    }

    // Migrate bookings
    const oldBookings = await AsyncStorage.getItem('userBookings');
    if (oldBookings) {
      const key = getUserStorageKey('userBookings', userEmail);
      await AsyncStorage.setItem(key, oldBookings);
      console.log('Migrated user bookings');
    }
  } catch (error) {
    // Catch and log migration errors without throwing
    // This prevents migration errors from blocking app startup
    console.error('Error migrating user data:', error);
    // Don't rethrow - migration failures shouldn't break the app
  }
};

