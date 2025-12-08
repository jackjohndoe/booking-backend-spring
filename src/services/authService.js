// Authentication Service
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/api';

export const authService = {
  // Login - Requires backend connection
  login: async (email, password) => {
    try {
      // Normalize email (trim and lowercase) to match registration format
      const normalizedEmail = email.trim().toLowerCase();
      
      // Validate inputs before making API call
      if (!normalizedEmail || !password) {
        throw new Error('Email and password are required');
      }

      // Authenticate with backend
      let response;
      try {
        response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
          email: normalizedEmail,
          password,
        });
        
        // Log successful response in development
        if (__DEV__) {
          console.log('✅ Login API response received:', {
            hasResponse: !!response,
            hasData: !!response?.data,
            hasUser: !!response?.user,
            hasToken: !!(response?.token || response?.data?.token || response?.data?.accessToken),
          });
        }
      } catch (apiError) {
        // Log detailed error information
        console.error('❌ Login API error details:');
        console.error('  Message:', apiError.message);
        console.error('  Status:', apiError.status);
        console.error('  Is Auth Error:', apiError.isAuthError);
        console.error('  Is Server Error:', apiError.isServerError);
        console.error('  Is Backend Down:', apiError.isBackendDown);
        console.error('  Error Data:', apiError.data);
        console.error('  Error Name:', apiError.name);
        console.error('  Full Error:', apiError);
        
        // Try to stringify the error for better visibility
        try {
          const errorDetails = {
            message: apiError.message,
            status: apiError.status,
            isAuthError: apiError.isAuthError,
            isServerError: apiError.isServerError,
            isBackendDown: apiError.isBackendDown,
            data: apiError.data,
            name: apiError.name,
          };
          console.error('  Error Details (JSON):', JSON.stringify(errorDetails, null, 2));
        } catch (stringifyError) {
          console.error('  Could not stringify error:', stringifyError);
        }
        
        // Re-throw the error with its original message
        // The API service already formats error messages appropriately
        throw apiError;
      }
      
      // If response is null or undefined, authentication failed
      if (response === null || response === undefined) {
        throw new Error('Authentication failed. Invalid email or password.');
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
      
      // Validate that we have essential user data
      if (!userData || !userData.email) {
        throw new Error('Invalid response from server. Please try again.');
      }

      // Ensure we have a token for authenticated requests
      if (!token) {
        throw new Error('Authentication token not received. Please try again.');
      }
      
      // Create user object with all necessary fields
      let userToStore = {
        id: userData.id || userData._id || userData.userId || normalizedEmail,
        name: userData.name || userData.fullName || normalizedEmail.split('@')[0],
        email: userData.email || normalizedEmail,
        token: token,
        role: userData.role || 'Guest',
        profilePicture: userData.profilePicture || null,
        phoneNumber: userData.phoneNumber || null,
        ...userData,
      };
      
      // Load profile picture from userStorage if not in backend response
      if (!userToStore.profilePicture) {
        try {
          const { getUserProfile } = await import('../utils/userStorage');
          const profileData = await getUserProfile(normalizedEmail);
          if (profileData && profileData.profilePicture) {
            userToStore.profilePicture = profileData.profilePicture;
            console.log('✅ Loaded profile picture from userStorage on login');
          }
        } catch (profileError) {
          console.error('Error loading profile picture from userStorage:', profileError);
          // Continue without profile picture
        }
      }
      
      // Save authenticated user to local storage
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      
      console.log('✅ Backend authentication successful:', normalizedEmail);
      return { ...response, user: userToStore };
    } catch (error) {
      // Return error message for proper handling
      throw error;
    }
  },

  // Register/Sign Up - Saves user information to backend
  register: async (userData) => {
    try {
      // Validate required fields
      if (!userData.email || !userData.password || !userData.name) {
        throw new Error('Name, email, and password are required');
      }

      // Normalize email (trim and lowercase) before sending to backend
      const normalizedEmail = userData.email.trim().toLowerCase();
      const normalizedName = userData.name.trim();
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password length
      if (userData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Send registration data to backend - this creates and saves the account on backend
      // Include default role since backend requires it but frontend doesn't have role field
      // Backend allows: Guest, Host, Admin - everyone signing up is a Guest
      const response = await api.post(API_ENDPOINTS.AUTH.REGISTER, {
        name: normalizedName,
        email: normalizedEmail,
        password: userData.password,
        role: userData.role || 'Guest', // Default role is Guest for all new sign-ups
      });
      
      // If response is null or undefined, registration failed
      if (response === null || response === undefined) {
        throw new Error('Registration failed. Unable to create account. Please check your information and try again.');
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
      
      // Create user object with all necessary fields
      // The account is now saved on the backend database
      const userToStore = {
        id: user?.id || user?._id || user?.userId || normalizedEmail,
        name: user?.name || user?.fullName || normalizedName,
        email: user?.email || normalizedEmail,
        token: token || null, // Token from registration response
        role: user?.role || 'Guest',
        profilePicture: user?.profilePicture || null,
        phoneNumber: user?.phoneNumber || null,
        ...(user || {}),
      };
      
      // Ensure email is set (should always be present)
      if (!userToStore.email) {
        userToStore.email = normalizedEmail;
      }

      // Ensure we have an ID
      if (!userToStore.id) {
        userToStore.id = normalizedEmail; // Fallback to email as ID
      }
      
      // Save user information locally for immediate use
      // The account is permanently stored on backend and can be used for future sign ins
      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      
      console.log('✅ User registered and saved to backend:', {
        id: userToStore.id,
        email: userToStore.email,
        name: userToStore.name
      });
      
      // Return response with user data
      return { ...response, user: userToStore };
    } catch (error) {
      // Return error message for proper handling
      throw error;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put(API_ENDPOINTS.AUTH.PROFILE, profileData);
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
        const response = await api.post(API_ENDPOINTS.AUTH.LOGOUT, {});
        if (__DEV__) {
          console.log('✅ Backend logout successful', response);
        }
      } catch (error) {
        // If logout endpoint doesn't exist or fails, continue with local logout
        // This is fine - the account remains on backend for future sign ins
        // Common cases: 404 (endpoint doesn't exist), 401 (already logged out), network errors
        if (__DEV__) {
          const status = error?.status || error?.response?.status;
          if (status === 404) {
            console.log('⚠️ Backend logout endpoint not available (404), continuing with local logout');
          } else if (status === 401) {
            console.log('⚠️ Already logged out on backend (401), continuing with local logout');
          } else {
            console.log('⚠️ Backend logout failed, continuing with local logout:', error?.message || error);
          }
        }
      }
      
      // Clear local session data only - backend account remains
      // Use try-catch to ensure we always clear local storage even if backend call fails
      try {
        await AsyncStorage.removeItem('user');
        if (__DEV__) {
          console.log('✅ Local user data cleared');
        }
      } catch (storageError) {
        console.error('Error clearing AsyncStorage:', storageError);
        // Continue anyway - we'll try to clear user state
      }
      
      // Note: We don't clear other data like favorites, bookings, etc.
      // as they may be associated with the backend account
      
      return { success: true };
    } catch (error) {
      // Even if there's an error, try to clear local storage
      console.error('Error during logout:', error);
      try {
        await AsyncStorage.removeItem('user');
        if (__DEV__) {
          console.log('✅ Local user data cleared (fallback)');
        }
      } catch (storageError) {
        console.error('Error clearing AsyncStorage (fallback):', storageError);
      }
      // Return success anyway - local logout should always succeed
      return { success: true };
    }
  },
};

