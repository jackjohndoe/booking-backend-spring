// API Base Configuration
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

const BASE_URL = API_CONFIG.BASE_URL;

// Helper function to get auth token
const getAuthToken = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const token = user?.token || user?.accessToken || null;
      if (!token) {
        console.warn('User data found but no token available');
      }
      return token;
    } else {
      console.warn('No user data found in AsyncStorage - user may not be logged in');
    }
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Base API request function
const apiRequest = async (endpoint, options = {}) => {
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
  const isPaymentEndpoint = endpoint.includes('/payments/');
  
  const token = await getAuthToken();
  
  // Debug logging for payment endpoints
  if (isPaymentEndpoint) {
    console.log('🔍 Payment endpoint - Token check:', {
      hasToken: !!token,
      tokenType: token ? typeof token : 'none',
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'none'
    });
    
    // Also check AsyncStorage directly for debugging
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('🔍 AsyncStorage user data:', {
          hasToken: !!user.token,
          hasAccessToken: !!user.accessToken,
          email: user.email,
          allKeys: Object.keys(user)
        });
      } else {
        console.warn('⚠️ No user data in AsyncStorage');
      }
    } catch (debugError) {
      console.error('Error checking AsyncStorage:', debugError);
    }
  }
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (token) {
    // Clean token (remove any quotes or whitespace)
    const cleanToken = token.trim().replace(/^["']|["']$/g, '');
    defaultHeaders['Authorization'] = `Bearer ${cleanToken}`;
    if (isPaymentEndpoint && __DEV__) {
      console.log('✅ Payment request with token:', cleanToken.substring(0, 30) + '...');
      console.log('✅ Authorization header set:', `Bearer ${cleanToken.substring(0, 20)}...`);
      console.log('✅ Full Authorization header length:', `Bearer ${cleanToken}`.length);
    }
  } else if (isPaymentEndpoint) {
      // For payment endpoints, log warning if no token
      console.error('❌ Payment endpoint requires authentication but no token found');
      console.error('Make sure you are logged in. Try signing out and signing in again.');
      console.error('Checking AsyncStorage for user data...');
      // Try to get user data directly for debugging
      AsyncStorage.getItem('user').then(userData => {
        if (userData) {
          try {
            const user = JSON.parse(userData);
            console.error('User data found:', {
              hasToken: !!user.token,
              hasAccessToken: !!user.accessToken,
              email: user.email,
              keys: Object.keys(user)
            });
          } catch (e) {
            console.error('Could not parse user data:', e);
          }
        } else {
          console.error('No user data in AsyncStorage');
        }
      }).catch(err => console.error('Error reading AsyncStorage:', err));
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    // Log request details for payment endpoints (in dev mode)
    if (isPaymentEndpoint && __DEV__) {
      const requestDetails = {
        url: `${BASE_URL}${endpoint}`,
        method: options.method || 'GET',
        hasAuthHeader: !!defaultHeaders['Authorization'],
        authHeaderPreview: defaultHeaders['Authorization'] ? 
          defaultHeaders['Authorization'].substring(0, 30) + '...' : 'none',
        allHeaders: { ...defaultHeaders }
      };
      console.log('📤 Making payment request:');
      console.log(JSON.stringify(requestDetails, null, 2));
      console.log('Full request object:', requestDetails);
    }
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
    
    // Log response details for payment endpoints (in dev mode)
    if (isPaymentEndpoint && __DEV__) {
      console.log('📥 Payment response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok
      });
    }
    
    // Handle response body - read it carefully, handling empty responses
    const contentType = response.headers.get('content-type');
    let data = null;
    let responseText = '';
    
    try {
      // Always read as text first to handle empty responses
      responseText = await response.text();
      
      if (responseText && responseText.trim().length > 0) {
        // If we have content, try to parse as JSON if it looks like JSON
        if (contentType && contentType.includes('application/json')) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Not valid JSON despite content-type, use as text
            data = responseText;
          }
        } else {
          // Not JSON content-type, try to parse anyway (some APIs don't set content-type correctly)
          try {
            data = JSON.parse(responseText);
          } catch {
            data = responseText;
          }
        }
      } else {
        // Empty response body
        data = '[no body]';
      }
    } catch (readError) {
      console.error('Error reading response body:', readError);
      data = '[no body]';
    }

    if (!response.ok) {
      // For email endpoints, don't treat 401/403 as fatal - log and return null
      const isEmailEndpoint = endpoint.includes('/email/');
      
      // For authentication endpoints (login/register), throw errors so users get feedback
      if (isAuthEndpoint) {
        // For auth endpoints, extract error message from various possible formats
        let errorMessage = `Authentication failed (${response.status})`;
        
        // Handle different error response formats
        if (typeof data === 'string') {
          // String response - use it directly
          errorMessage = data.trim() || errorMessage;
        } else if (data && typeof data === 'object') {
          // JSON object response - try multiple common error message fields
          // Prioritize specific error messages, especially for password validation
          
          // First, check for nested errors object (most common for validation errors)
          if (data.errors) {
            if (Array.isArray(data.errors)) {
              // If errors is an array, join them with proper formatting
              errorMessage = data.errors.map(err => {
                if (typeof err === 'string') return err;
                if (err.message) return err.message;
                if (err.msg) return err.msg;
                return JSON.stringify(err);
              }).join('. ');
            } else if (typeof data.errors === 'object') {
              // If errors is an object (like {password: "too weak", email: "invalid"})
              const errorKeys = Object.keys(data.errors);
              if (errorKeys.length > 0) {
                errorMessage = errorKeys.map(key => {
                  const errValue = data.errors[key];
                  if (Array.isArray(errValue)) {
                    // Capitalize field name and format error
                    const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
                    return `${fieldName}: ${errValue.join(', ')}`;
                  }
                  // Capitalize field name
                  const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
                  return `${fieldName}: ${errValue}`;
                }).join('. ');
              }
            } else if (typeof data.errors === 'string') {
              errorMessage = data.errors;
            }
          }
          
          // If we didn't get error from errors field, try standard error message fields
          if (errorMessage === `Authentication failed (${response.status})` || !errorMessage) {
            errorMessage = data.message || 
                          data.error || 
                          data.errorMessage ||
                          data.msg ||
                          errorMessage;
          }
          
          // If we still have the default message, try to extract from nested structures
          if (errorMessage === `Authentication failed (${response.status})` && data.data) {
            errorMessage = data.data.message || data.data.error || data.data.errorMessage || errorMessage;
          }
        }
        
        // Ensure we have a meaningful error message
        if (!errorMessage || errorMessage === `Authentication failed (${response.status})`) {
          // Provide default messages based on status code
          if (response.status === 400) {
            errorMessage = 'Invalid information provided. Please check your details.';
          } else if (response.status === 409) {
            errorMessage = 'Account already exists. Please sign in instead.';
          } else if (response.status === 422) {
            errorMessage = 'Validation error. Please check your information.';
          }
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }
      
      // For email endpoints, handle errors gracefully
      if (isEmailEndpoint) {
        if (response.status === 401 || response.status === 403) {
          const errorMessage = data?.message || 'Authentication required';
          // Only log once per endpoint call
          if (!global._emailAuthErrorLogged) {
            console.warn(`Email API authentication error (${response.status}):`, errorMessage);
            global._emailAuthErrorLogged = true;
            setTimeout(() => { global._emailAuthErrorLogged = false; }, 5000);
          }
        } else if (response.status === 500) {
          // 500 error means backend endpoint exists but has server-side issue
          // Only log once to reduce noise
          if (!global._email500ErrorLogged) {
            console.warn(`Email API server error (500): Backend email service needs configuration`);
            global._email500ErrorLogged = true;
            setTimeout(() => { global._email500ErrorLogged = false; }, 10000);
          }
        } else if (response.status !== 200) {
          // Only log non-200 errors once
          if (!global._emailErrorLogged) {
            console.warn(`Email API error (${response.status}):`, data?.message || data?.error || 'Unknown error');
            global._emailErrorLogged = true;
            setTimeout(() => { global._emailErrorLogged = false; }, 5000);
          }
        }
        // Return null for email endpoints to allow graceful handling
        return null;
      }
      
      // For payment endpoints, throw errors so they can be handled properly
      if (isPaymentEndpoint) {
        // Use actual HTTP status code, not error message
        const httpStatus = response.status;
        let errorMessage = '';
        
        // If response has no body or empty body
        if (!data || data === '[no body]' || (typeof data === 'string' && data.trim() === '')) {
          if (httpStatus === 401) {
            errorMessage = 'Authentication failed. Your session may have expired. Please sign out and sign in again.';
          } else if (httpStatus === 403) {
            errorMessage = 'Access denied. You do not have permission to perform this action.';
          } else if (httpStatus === 500) {
            errorMessage = 'Server error. The backend may not have Flutterwave credentials configured in Railway. Please check Railway environment variables: FLUTTERWAVE_CLIENT_ID, FLUTTERWAVE_CLIENT_SECRET, FLUTTERWAVE_ENCRYPTION_KEY';
          } else {
            errorMessage = `Server error (${httpStatus}). Please check backend logs.`;
          }
        } else if (typeof data === 'string') {
          // For 500 errors, provide more helpful message
          if (httpStatus === 500) {
            errorMessage = `Backend error (500): ${data}. This usually means Flutterwave credentials are missing in Railway. Check Railway environment variables.`;
          } else {
            errorMessage = data;
          }
        } else if (typeof data === 'object' && data) {
          // Extract error message, but prioritize HTTP status
          const extractedMsg = data.message || data.error || data.errorMessage;
          if (httpStatus === 500) {
            // For 500 errors, provide more helpful message about Flutterwave config
            errorMessage = extractedMsg ? 
              `Backend error (500): ${extractedMsg}. Check Railway backend logs and ensure Flutterwave environment variables are set.` :
              'Server error (500). Backend may not have Flutterwave credentials configured. Check Railway environment variables: FLUTTERWAVE_CLIENT_ID, FLUTTERWAVE_CLIENT_SECRET, FLUTTERWAVE_ENCRYPTION_KEY';
          } else if (httpStatus === 401 || httpStatus === 403) {
            // For auth errors, use extracted message or default
            errorMessage = extractedMsg || 'Authentication failed. Please sign out and sign in again.';
          } else {
            errorMessage = extractedMsg || JSON.stringify(data);
          }
        }
        
        // Fallback error message if still empty
        if (!errorMessage || errorMessage.trim() === '') {
          if (httpStatus === 401 || httpStatus === 403) {
            if (!token) {
              errorMessage = 'You must be logged in to create a virtual account. Please sign in first.';
            } else {
              errorMessage = 'Your session has expired. Please sign out and sign in again to refresh your authentication token.';
            }
          } else if (httpStatus === 500) {
            errorMessage = 'Server error (500). The backend may not have Flutterwave credentials configured in Railway. Please check Railway environment variables and backend logs.';
          } else {
            errorMessage = `Payment API error (${httpStatus}). Check your authentication and try again.`;
          }
        }
        
        // Log full error details for debugging
        const errorDetails = {
          status: response.status,
          endpoint,
          errorMessage,
          responseData: data,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 30) + '...' : 'none',
          tokenLength: token ? token.length : 0,
          responseHeaders: Object.fromEntries(response.headers.entries())
        };
        console.error('❌ Payment endpoint error:');
        console.error(JSON.stringify(errorDetails, null, 2));
        console.error('Full error object:', errorDetails);
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = { data };
        throw error;
      }
      
      // For other endpoints, return null for graceful fallback (preserves frontend)
      if (response.status === 403 || response.status === 401) {
        // Only log authentication errors in development or for specific endpoints
        // Suppress for common endpoints that frequently fail (like listings, apartments)
        const suppressLog = endpoint.includes('/apartments') || 
                           endpoint.includes('/listings') || 
                           endpoint.includes('/favorites');
        if (!suppressLog) {
          console.log('API authentication error, using local storage fallback');
        }
        return null;
      }
      // For other errors, also return null to preserve frontend
      // Suppress logs for common endpoints
      const suppressLog = endpoint.includes('/apartments') || 
                         endpoint.includes('/listings') || 
                         endpoint.includes('/favorites');
      if (!suppressLog) {
        console.log(`API error ${response.status}, using local storage fallback`);
      }
      return null;
    }

    return data;
  } catch (error) {
    // If error was already thrown (from auth/payment endpoints with status), re-throw it
    if (error.status && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404 || error.status === 409 || error.status === 500)) {
      // This is an error that was thrown - re-throw it
      throw error;
    }
    
    // For auth and payment endpoints, throw network errors so users get feedback
    if (isAuthEndpoint || isPaymentEndpoint) {
      const networkError = new Error('Network error. Please check your connection and try again.');
      networkError.status = 0; // Indicate network error
      throw networkError;
    }
    
    // Network errors, timeouts, etc. - return null to preserve frontend for non-auth endpoints
    console.log('API network error, using local storage fallback:', error.message);
    return null;
  }
};

// API Methods
export const api = {
  // GET request
  get: (endpoint, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  // POST request
  post: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // PUT request
  put: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // PATCH request
  patch: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // DELETE request
  delete: (endpoint, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },
};

export default api;

