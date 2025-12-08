import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Handle web platform - AsyncStorage works on web but may need error handling
      let userData = null;
      try {
        userData = await AsyncStorage.getItem('user');
      } catch (storageError) {
        // On web, if AsyncStorage fails, continue without user data
        console.warn('AsyncStorage not available on web, continuing without stored user:', storageError);
        setIsLoading(false);
        return;
      }
      if (userData) {
        const user = JSON.parse(userData);
        
        // CRITICAL: Restore ALL user profile data from persistent storage
        // This ensures all user updates (name, profile picture, phone, address, etc.) are restored
        if (user.email) {
          try {
            const { getUserProfile } = await import('../utils/userStorage');
            const profileData = await getUserProfile(user.email);
            
            if (profileData) {
              // Restore all profile fields from persistent storage
              // This ensures user updates persist across app restarts
              if (profileData.name) user.name = profileData.name;
              if (profileData.profilePicture) user.profilePicture = profileData.profilePicture;
              if (profileData.whatsappNumber) user.whatsappNumber = profileData.whatsappNumber;
              if (profileData.address) user.address = profileData.address;
              
              // Update AsyncStorage with restored profile data
              await AsyncStorage.setItem('user', JSON.stringify(user));
              
              console.log('✅ Restored user profile data on app startup:', {
                name: profileData.name,
                hasPicture: !!profileData.profilePicture,
                hasPhone: !!profileData.whatsappNumber,
                hasAddress: !!profileData.address,
              });
            }
          } catch (profileError) {
            console.error('Error loading profile data:', profileError);
            // Continue without profile data
          }
        }
        
        setUser(user);
        
        // Migrate old data to user-specific keys if needed
        if (user.email) {
          try {
            const { migrateUserData } = await import('../utils/userStorage');
            await migrateUserData(user.email);
            
            // CRITICAL: Check if this is an existing user (has data) or new user
            // Welcome deal is ONLY for first-time users (sign-up), not existing users
            const { hasSeenWelcomeDeal, markWelcomeDealSeen } = await import('../utils/userStorage');
            const { getWalletBalance, getTransactions } = await import('../utils/wallet');
            
            // Check if user has existing wallet data (balance > 0 or has transactions)
            const existingBalance = await getWalletBalance(user.email);
            const existingTransactions = await getTransactions(user.email);
            const hasExistingData = existingBalance > 0 || (existingTransactions && existingTransactions.length > 0);
            
            // If user has existing data OR has already seen the deal, mark as ineligible
            if (hasExistingData || await hasSeenWelcomeDeal(user.email)) {
              await markWelcomeDealSeen(user.email, false); // Mark as seen (not claimed)
              console.log(`✅ Existing user session restored: ${user.email} - Welcome deal marked as ineligible`);
            } else {
              // New user - don't mark as ineligible yet
              console.log(`✅ New user session: ${user.email} - Welcome deal will be shown if eligible`);
            }
          } catch (migrationError) {
            // Silently handle migration errors - don't block app startup
            console.error('Error during data migration:', migrationError);
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (userData, isNewUser = false) => {
    try {
      // Store user data with token for API authentication
      const userToStore = {
        ...userData,
        token: userData.token || userData.accessToken,
      };
      
      // CRITICAL: Restore ALL user profile data from persistent storage
      // This ensures all user updates (name, profile picture, phone, address, etc.) are restored
      if (userToStore.email) {
        try {
          const { getUserProfile } = await import('../utils/userStorage');
          const profileData = await getUserProfile(userToStore.email);
          
          if (profileData) {
            // Restore all profile fields from persistent storage
            // This ensures user updates persist across logout/login
            if (profileData.name) userToStore.name = profileData.name;
            if (profileData.profilePicture) userToStore.profilePicture = profileData.profilePicture;
            if (profileData.whatsappNumber) userToStore.whatsappNumber = profileData.whatsappNumber;
            if (profileData.address) userToStore.address = profileData.address;
            
            console.log('✅ Restored user profile data on sign-in:', {
              name: profileData.name,
              hasPicture: !!profileData.profilePicture,
              hasPhone: !!profileData.whatsappNumber,
              hasAddress: !!profileData.address,
            });
          } else {
            // No saved profile yet - will be created when user updates profile
            console.log('ℹ️ No saved profile data found - will use default from auth');
          }
        } catch (profileError) {
          console.error('Error loading profile data on sign in:', profileError);
          // Continue without profile data - user can update profile later
        }
      }
      
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      // Store last user email so favorites/profile can be accessed even after logout
      await AsyncStorage.setItem('lastUserEmail', userToStore.email);
      setUser(userToStore);
      
      // Migrate old data to user-specific keys if needed
      // This ensures any old global data is moved to user-specific storage
      if (userToStore.email) {
        try {
          const { migrateUserData } = await import('../utils/userStorage');
          await migrateUserData(userToStore.email);
          
          // CRITICAL: Verify and log all user data that persists across logout/login
          const { getWalletBalance, getTransactions } = await import('../utils/wallet');
          const { getUserFavorites } = await import('../utils/userStorage');
          const { getBookings } = await import('../utils/bookings');
          
          // Verify wallet data
          const walletBalance = await getWalletBalance(userToStore.email);
          const transactions = await getTransactions(userToStore.email);
          
          // Verify favorites
          const favorites = await getUserFavorites(userToStore.email);
          
          // Verify bookings
          const bookings = await getBookings(userToStore.email);
          
          console.log('✅ User data persistence verified on sign-in:', {
            email: userToStore.email,
            walletBalance: walletBalance,
            transactionCount: transactions?.length || 0,
            favoritesCount: favorites?.length || 0,
            bookingsCount: bookings?.length || 0,
          });
          
          // CRITICAL: Mark welcome deal as ineligible for existing users (sign-in)
          // Welcome deal is ONLY for first-time users (sign-up), not existing users (sign-in)
          // isNewUser flag indicates if this is a sign-up (true) or sign-in (false)
          const { markWelcomeDealSeen, hasSeenWelcomeDeal, getUserStorageKey } = await import('../utils/userStorage');
          
          if (!isNewUser) {
            // User is signing in (existing user) - ALWAYS mark as ineligible for welcome deal
            // This ensures NO voucher is shown for sign-in, regardless of previous state
            await markWelcomeDealSeen(userToStore.email, false); // Mark as seen (not claimed)
            const dealStatus = await hasSeenWelcomeDeal(userToStore.email);
            console.log(`✅ Existing user signed in: ${userToStore.email} - Welcome deal marked as ineligible (hasSeenDeal: ${dealStatus}) - NO VOUCHER`);
          } else {
            // User is signing up (new user) - ensure they can see the deal
            // Clear any existing deal status to ensure new sign-ups always see the voucher
            const hasSeen = await hasSeenWelcomeDeal(userToStore.email);
            if (hasSeen) {
              // If somehow they've seen it before, clear it so they can see it now
              const key = getUserStorageKey('welcomeDealSeen', userToStore.email);
              await AsyncStorage.removeItem(key);
              console.log(`🔄 Cleared previous deal status for new sign-up: ${userToStore.email}`);
            }
            console.log(`✅ New user signed up: ${userToStore.email} - Welcome deal voucher WILL BE SHOWN on home page`);
          }
          
          console.log('✅ User signed in - ALL user data restored and verified:');
          console.log('   - Profile data (name, picture, phone, address)');
          console.log('   - Wallet balance and transaction history');
          console.log('   - Booking history');
          console.log('   - Favorites list');
          console.log('   - All data will be automatically loaded when navigating to respective screens');
        } catch (migrationError) {
          // Silently handle migration errors - don't block sign in
          console.error('Error during data migration:', migrationError);
        }
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Call authService logout which handles backend notification
      // This clears local session but keeps backend account intact
      await authService.logout();
      
      // CRITICAL: Only clear authentication data ('user' key) - ALL user data is preserved
      // User data is stored with user-specific keys (using email), so it persists across logouts:
      // - Profile information (name, email, profile picture, address, etc.) - stored with userProfile_{email}
      // - Wallet balance - stored with walletBalance_{email} - PERSISTS
      // - Transaction history - stored with walletTransactions_{email} - PERSISTS
      // - Booking history - stored with userBookings_{email} - PERSISTS
      // - Favorites - stored with favorites_{email} - PERSISTS
      // - Notifications - stored with notifications_{email} - PERSISTS
      // 
      // All this data will be automatically loaded when the user signs back in using their email
      // Wallet balance and transactions are EXCLUSIVE to each account and persist permanently
      
      // Ensure user data is cleared (authService.logout already does this, but double-check)
      try {
        await AsyncStorage.removeItem('user');
      } catch (storageError) {
        console.error('Error removing user from AsyncStorage:', storageError);
        // Continue anyway - we'll clear user state
      }
      
      // Clear user state (in-memory only)
      // This will trigger App.js to automatically show SignIn screen
      setUser(null);
      
      console.log('✅ User signed out - authentication cleared');
      console.log('✅ User will be automatically navigated to Sign In screen');
      console.log('✅ All user data preserved (wallet balance, transactions, profile, bookings, favorites, notifications)');
      console.log('✅ Wallet data will be automatically loaded when user signs back in');
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if logout fails, clear local user authentication
      // User data remains intact in AsyncStorage with user-specific keys
      try {
        await AsyncStorage.removeItem('user');
        console.log('✅ User data removed from AsyncStorage (fallback)');
      } catch (clearError) {
        console.error('Error clearing AsyncStorage (fallback):', clearError);
      }
      
      // Always clear user state to ensure navigation happens
      // This is critical - even if storage fails, we need to clear the in-memory state
      setUser(null);
      
      console.log('✅ Authentication cleared - user will be navigated to Sign In screen');
      console.log('✅ User data (wallet, transactions, etc.) preserved in AsyncStorage');
      // Don't throw error - user should still be logged out even if backend call fails
    }
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};



