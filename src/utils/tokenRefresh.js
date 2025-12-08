// Token Refresh Utility
// Handles automatic token refresh when tokens expire
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

let isRefreshing = false;
let refreshPromise = null;

/**
 * Attempt to refresh the token by calling refresh endpoint or re-authenticating
 * This tries multiple methods to get a new token
 */
const attemptTokenRefresh = async () => {
  try {
    // Get user data to extract email
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      console.warn('⚠️ No user data found for token refresh');
      return null;
    }

    const user = JSON.parse(userData);
    if (!user.email) {
      console.warn('⚠️ No email found in user data for token refresh');
      return null;
    }

    const currentToken = user.token || user.accessToken;
    
    // Method 1: Try to call a refresh endpoint if it exists
    try {
      const refreshEndpoint = '/api/auth/refresh';
      const response = await fetch(`${API_CONFIG.BASE_URL}${refreshEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        },
        body: JSON.stringify({
          email: user.email,
          token: currentToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data.token || data.accessToken || data.data?.token || data.data?.accessToken;
        if (newToken) {
          console.log('✅ Token refreshed via refresh endpoint');
          return newToken;
        }
      } else if (response.status !== 404) {
        // 404 means endpoint doesn't exist, which is fine
        console.log(`ℹ️ Refresh endpoint returned ${response.status}, trying alternative...`);
      }
    } catch (refreshError) {
      // Refresh endpoint doesn't exist or failed - that's okay, try alternative
      console.log('ℹ️ Token refresh endpoint not available or failed, trying alternative method');
    }

    // Method 2: Try to validate/extend current token by calling a lightweight endpoint
    // Some backends allow token validation that extends expiration
    try {
      const validateEndpoint = '/api/auth/me'; // Lightweight endpoint to validate token
      const response = await fetch(`${API_CONFIG.BASE_URL}${validateEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        },
      });

      // If this succeeds, the token might still be valid (backend might have extended it)
      // Or we might get a new token in response headers
      if (response.ok) {
        // Check if response includes a new token
        const authHeader = response.headers.get('Authorization') || response.headers.get('X-New-Token');
        if (authHeader) {
          const newToken = authHeader.replace('Bearer ', '').trim();
          if (newToken && newToken !== currentToken) {
            console.log('✅ New token received from validation endpoint');
            return newToken;
          }
        }
        // If validation succeeds, token might still be valid (backend extended it)
        // Return current token as it's still valid
        console.log('ℹ️ Token validation succeeded, token may have been extended by backend');
        return currentToken;
      }
    } catch (validateError) {
      // Validation failed - token is definitely expired
      console.log('ℹ️ Token validation failed, token is expired');
    }

    // If all methods fail, we can't automatically refresh without password
    // Return null to indicate refresh is not possible
    console.warn('⚠️ Token refresh not possible - backend refresh endpoint not available');
    return null;
  } catch (error) {
    console.error('❌ Error attempting token refresh:', error);
    return null;
  }
};

/**
 * Refresh the authentication token
 * Prevents multiple simultaneous refresh attempts
 */
export const refreshToken = async () => {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    console.log('🔄 Token refresh already in progress, waiting...');
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const newToken = await attemptTokenRefresh();
      
      if (newToken) {
        // Update token in AsyncStorage
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          user.token = newToken;
          user.accessToken = newToken;
          await AsyncStorage.setItem('user', JSON.stringify(user));
          console.log('✅ Token updated in storage');
        }
        return newToken;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Check if token is expired or about to expire
 * For JWT tokens, we can decode and check expiration
 */
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // Try to decode JWT token (if it's a JWT)
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT, can't check expiration
      return false;
    }

    // Decode payload (base64)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration (exp is in seconds, convert to milliseconds)
    if (payload.exp) {
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      // Consider token expired if it expires within 5 minutes
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      return currentTime >= (expirationTime - bufferTime);
    }

    return false;
  } catch (error) {
    // If we can't decode, assume it's not expired (let backend decide)
    return false;
  }
};

/**
 * Get current token and check if it needs refresh
 */
export const getValidToken = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) return null;

    const user = JSON.parse(userData);
    const token = user?.token || user?.accessToken;
    
    if (!token) return null;

    // Check if token is expired or about to expire
    if (isTokenExpired(token)) {
      console.log('🔄 Token expired or about to expire, attempting refresh...');
      const newToken = await refreshToken();
      return newToken || token; // Return new token if available, otherwise return old one
    }

    return token;
  } catch (error) {
    console.error('Error getting valid token:', error);
    return null;
  }
};

