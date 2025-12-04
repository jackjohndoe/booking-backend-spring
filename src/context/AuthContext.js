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
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
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
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      setUser(userToStore);
      
      // Migrate old data to user-specific keys if needed
      // This ensures any old global data is moved to user-specific storage
      if (userToStore.email) {
        try {
          const { migrateUserData } = await import('../utils/userStorage');
          await migrateUserData(userToStore.email);
          
          // CRITICAL: Mark welcome deal as ineligible for existing users (sign-in)
          // Welcome deal is ONLY for first-time users (sign-up), not existing users (sign-in)
          // isNewUser flag indicates if this is a sign-up (true) or sign-in (false)
          if (!isNewUser) {
            // User is signing in (existing user) - mark as ineligible for welcome deal
            const { markWelcomeDealSeen } = await import('../utils/userStorage');
            await markWelcomeDealSeen(userToStore.email, false); // Mark as seen (not claimed)
            console.log(`✅ Existing user signed in: ${userToStore.email} - Welcome deal marked as ineligible`);
          } else {
            // User is signing up (new user) - don't mark as ineligible, let them see the deal
            console.log(`✅ New user signed up: ${userToStore.email} - Welcome deal will be shown on home page`);
          }
          
          console.log('✅ User signed in - all user data (wallet, bookings, transactions, etc.) will be loaded automatically');
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
      await AsyncStorage.removeItem('user');
      
      // Clear user state (in-memory only)
      setUser(null);
      
      console.log('✅ User signed out - authentication cleared');
      console.log('✅ All user data preserved (wallet balance, transactions, profile, bookings, favorites, notifications)');
      console.log('✅ Wallet data will be automatically loaded when user signs back in');
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if logout fails, clear local user authentication
      // User data remains intact in AsyncStorage with user-specific keys
      try {
        await AsyncStorage.removeItem('user');
        setUser(null);
        console.log('✅ Authentication cleared - user data (wallet, transactions, etc.) preserved in AsyncStorage');
      } catch (clearError) {
        console.error('Error clearing authentication:', clearError);
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};



