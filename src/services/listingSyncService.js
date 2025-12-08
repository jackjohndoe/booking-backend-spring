// Listing Sync Service
// Handles syncing local listings to the backend API for cross-platform visibility
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apartmentService } from './apartmentService';
import { getListings, deleteListing } from '../utils/listings';

const PENDING_SYNC_KEY = 'pending_sync_listings';
const SYNC_RETRY_DELAY = 5000; // 5 seconds initial delay
const MAX_RETRY_DELAY = 60000; // 1 minute max delay
const MAX_RETRIES = 10;

// Helper to get current user email
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

// Get pending listings that need to be synced
export const getPendingSyncListings = async () => {
  try {
    const pendingJson = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    return pendingJson ? JSON.parse(pendingJson) : [];
  } catch (error) {
    console.error('Error getting pending sync listings:', error);
    return [];
  }
};

// Add a listing to the sync queue
export const queueListingForSync = async (listingData) => {
  try {
    const pending = await getPendingSyncListings();
    
    // Check if already queued (by local ID)
    const localId = listingData.id || listingData._id;
    const existingIndex = pending.findIndex(p => p.localId === localId);
    
    const queueItem = {
      localId: localId,
      listingData: listingData,
      retryCount: 0,
      lastAttempt: null,
      createdAt: new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      // Update existing queue item
      pending[existingIndex] = queueItem;
    } else {
      // Add new queue item
      pending.push(queueItem);
    }
    
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
    console.log('✅ Listing queued for sync:', localId);
    return queueItem;
  } catch (error) {
    console.error('Error queueing listing for sync:', error);
    throw error;
  }
};

// Remove a listing from the sync queue (after successful sync)
export const removeFromSyncQueue = async (localId) => {
  try {
    const pending = await getPendingSyncListings();
    const filtered = pending.filter(p => p.localId !== localId);
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
    console.log('✅ Listing removed from sync queue:', localId);
  } catch (error) {
    console.error('Error removing from sync queue:', error);
  }
};

// Update retry count for a queued listing
const updateRetryCount = async (localId, retryCount, lastAttempt) => {
  try {
    const pending = await getPendingSyncListings();
    const item = pending.find(p => p.localId === localId);
    if (item) {
      item.retryCount = retryCount;
      item.lastAttempt = lastAttempt;
      await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
    }
  } catch (error) {
    console.error('Error updating retry count:', error);
  }
};

// Calculate exponential backoff delay
const getRetryDelay = (retryCount) => {
  const delay = Math.min(SYNC_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
  return delay;
};

// Sync a single listing to the API
const syncSingleListing = async (queueItem) => {
  try {
    const { localId, listingData, retryCount } = queueItem;
    
    // Skip if max retries reached
    if (retryCount >= MAX_RETRIES) {
      console.warn(`⚠️ Max retries reached for listing ${localId}, removing from queue`);
      await removeFromSyncQueue(localId);
      return { success: false, maxRetries: true };
    }
    
    // Check if we should retry (exponential backoff)
    if (queueItem.lastAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(queueItem.lastAttempt).getTime();
      const requiredDelay = getRetryDelay(retryCount);
      if (timeSinceLastAttempt < requiredDelay) {
        // Not time to retry yet
        return { success: false, waiting: true };
      }
    }
    
    console.log(`🔄 Syncing listing ${localId} to API (attempt ${retryCount + 1})...`);
    console.log('📤 Sync data:', {
      title: listingData.title,
      location: listingData.location,
      price: listingData.price,
      hasDescription: !!listingData.description,
    });
    
    // Try to create the listing via API
    const apiResult = await apartmentService.createApartment(listingData);
    
    if (apiResult !== null && apiResult !== undefined) {
      // Success! Remove from queue and delete local listing
      console.log(`✅ Listing ${localId} synced successfully to API`);
      
      // Get the API listing ID
      const apiId = apiResult.id || apiResult._id || apiResult.data?.id;
      
      // Remove from sync queue
      await removeFromSyncQueue(localId);
      
      // Remove local listing (it's now in API)
      try {
        const userEmail = await getCurrentUserEmail();
        await deleteListing(localId, userEmail);
        console.log(`✅ Removed local listing ${localId} after successful API sync`);
      } catch (deleteError) {
        console.warn('Could not delete local listing after sync:', deleteError);
        // Continue - API sync succeeded
      }
      
      return { success: true, apiId };
    } else {
      // API call failed, increment retry count
      const newRetryCount = retryCount + 1;
      await updateRetryCount(localId, newRetryCount, new Date().toISOString());
      console.log(`⚠️ Failed to sync listing ${localId}, will retry (attempt ${newRetryCount}/${MAX_RETRIES})`);
      console.log('⚠️ API returned null - this may indicate a validation error or server issue');
      return { success: false, retryCount: newRetryCount };
    }
    } catch (error) {
      // Error occurred, increment retry count
      const { localId, retryCount } = queueItem;
      const newRetryCount = retryCount + 1;
      await updateRetryCount(localId, newRetryCount, new Date().toISOString());
      console.error(`❌ Error syncing listing ${localId}:`, error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error('API Error Details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      }
      
      return { success: false, error: error.message, retryCount: newRetryCount };
    }
};

// Sync all pending listings
export const syncPendingListings = async () => {
  try {
    const pending = await getPendingSyncListings();
    
    if (pending.length === 0) {
      return { synced: 0, failed: 0, total: 0 };
    }
    
    console.log(`🔄 Syncing ${pending.length} pending listing(s) to API...`);
    
    let synced = 0;
    let failed = 0;
    
    // Sync each pending listing
    for (const queueItem of pending) {
      const result = await syncSingleListing(queueItem);
      if (result.success) {
        synced++;
      } else if (!result.waiting && !result.maxRetries) {
        failed++;
      }
      
      // Small delay between syncs to avoid overwhelming the API
      if (pending.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ Sync complete: ${synced} synced, ${failed} failed, ${pending.length - synced - failed} pending`);
    return { synced, failed, total: pending.length };
  } catch (error) {
    console.error('Error syncing pending listings:', error);
    return { synced: 0, failed: 0, total: 0, error: error.message };
  }
};

// Initialize sync service (call on app start)
export const initializeSync = () => {
  console.log('🔄 Initializing listing sync service...');
  
  // Sync immediately on initialization
  syncPendingListings().catch(error => {
    console.error('Error in initial sync:', error);
  });
  
  // Set up periodic sync (every 30 seconds when app is active)
  let syncInterval = null;
  
  const startPeriodicSync = () => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    
    syncInterval = setInterval(() => {
      syncPendingListings().catch(error => {
        console.error('Error in periodic sync:', error);
      });
    }, 30000); // 30 seconds
  };
  
  const stopPeriodicSync = () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  };
  
  startPeriodicSync();
  
  return {
    start: startPeriodicSync,
    stop: stopPeriodicSync,
    sync: syncPendingListings,
  };
};

