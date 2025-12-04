// Authentication Service
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  // Login
  login: async (email, password) => {
    try {
      // Normalize email (trim and lowercase) to match registration format
      const normalizedEmail = email.trim().toLowerCase();
      
      const response = await api.post('/api/auth/login', {
        email: normalizedEmail,
        password,
      });
      
      // If response is null (403, 401, etc.), return null
      if (response === null || response === undefined) {
        return null;
      }
      
      // Parse response - handle various backend response formats
      let userData, token;
      
      // Try different response structures
      if (response.data) {
        userData = response.data.user || response.data;
        token = response.data.token || response.token || response.data.accessToken || response.accessToken;
      } else if (response.user) {
        userData = response.user;
        token = response.token || response.accessToken || response.user.token;
      } else {
        userData = response;
        token = response.token || response.accessToken || response.access_token;
      }
      
      // Extract token from nested structures if needed
      if (!token && userData) {
        token = userData.token || userData.accessToken || userData.access_token;
      }
      
      const userToStore = {
        id: userData.id || userData._id || userData.userId || normalizedEmail,
        name: userData.name || userData.fullName || normalizedEmail.split('@')[0],
        email: userData.email || normalizedEmail,
        token: token,
        ...userData,
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      
      return { ...response, user: userToStore };
    } catch (error) {
      // Return error message for proper handling
      throw error;
    }
  },

  // Register/Sign Up
  register: async (userData) => {
    try {
      // Normalize email (trim and lowercase) before sending to backend
      const normalizedEmail = userData.email.trim().toLowerCase();
      const normalizedName = userData.name.trim();
      
      // Send registration data to backend - this creates the account on backend
      // Include default role since backend requires it but frontend doesn't have role field
      // Backend allows: Guest, Host, Admin - everyone signing up is a Guest
      const response = await api.post('/api/auth/register', {
        name: normalizedName,
        email: normalizedEmail,
        password: userData.password,
        role: userData.role || 'Guest', // Default role is Guest for all new sign-ups
      });
      
      // If response is null (403, 401, etc.), throw error
      if (response === null || response === undefined) {
        throw new Error('Registration failed. Please check your information and try again.');
      }
      
      // Parse response - handle various backend response formats
      let user, token;
      
      // Try different response structures - be more flexible
      if (response.data) {
        // Response has data property
        if (response.data.user) {
          user = response.data.user;
        } else if (response.data.id || response.data._id || response.data.email) {
          user = response.data;
        } else {
          user = response.data;
        }
        token = response.data.token || response.token || response.data.accessToken || response.accessToken;
      } else if (response.user) {
        // Response has user property directly
        user = response.user;
        token = response.token || response.accessToken || response.user.token;
      } else if (response.id || response._id || response.email) {
        // Response IS the user object
        user = response;
        token = response.token || response.accessToken || response.access_token;
      } else {
        // Fallback - use response as user
        user = response;
        token = response.token || response.accessToken || response.access_token;
      }
      
      // Extract token from nested structures if needed
      if (!token && user) {
        token = user.token || user.accessToken || user.access_token;
      }
      
      // Create user object even if backend didn't return all fields
      // This ensures we can proceed with sign in
      const userToStore = {
        id: user?.id || user?._id || user?.userId || normalizedEmail,
        name: user?.name || user?.fullName || normalizedName,
        email: user?.email || normalizedEmail,
        token: token || null, // Token might not be in registration response
        ...(user || {}),
      };
      
      // If we have at least an email, consider registration successful
      // The account is stored on backend even if response format is unexpected
      if (!userToStore.email) {
        console.warn('Registration response missing email - using provided email');
        userToStore.email = normalizedEmail;
      }
      
      // Store locally for immediate use
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      
      // Account is now stored on backend and can be used for future sign ins
      return { ...response, user: userToStore };
    } catch (error) {
      // Return error message for proper handling
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      // Optionally call backend logout endpoint if it exists
      // This doesn't delete the account, just invalidates the session
      try {
        await api.post('/api/auth/logout', {});
      } catch (error) {
        // If logout endpoint doesn't exist or fails, continue with local logout
        // This is fine - the account remains on backend for future sign ins
        console.log('Backend logout endpoint not available or failed, continuing with local logout');
      }
      
      // Clear local session data only - backend account remains
      await AsyncStorage.removeItem('user');
      
      // Note: We don't clear other data like favorites, bookings, etc.
      // as they may be associated with the backend account
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  },
};

