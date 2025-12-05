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
      return user?.token || user?.accessToken || null;
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
  
  try {
    const token = await getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
      if (__DEV__ && (endpoint.includes('/payments/') || endpoint.includes('/flutterwave/'))) {
        console.log('🔑 Sending auth token for payment request:', {
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...',
          endpoint: endpoint
        });
      }
    } else {
      // Log missing token for payment endpoints
      if (endpoint.includes('/payments/') || endpoint.includes('/flutterwave/')) {
        console.warn('⚠️ No auth token found for payment request:', endpoint);
        console.warn('   User may need to log in again');
      }
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    let response;
    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...config,
        signal: controller.signal,
        credentials: 'include', // Include cookies for CORS
        mode: 'cors', // Explicitly set CORS mode
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Handle network errors
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }
      
      // Check if backend is reachable
      if (fetchError.message?.includes('Failed to fetch') || 
          fetchError.message?.includes('NetworkError') ||
          fetchError.message?.includes('Network request failed')) {
        
        // Try to check if backend is running
        try {
          const healthCheck = await fetch(`${BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          });
          if (healthCheck.ok) {
            throw new Error('Backend is running but request failed. Please try again.');
          }
        } catch (healthError) {
          // Backend is not reachable
          const networkError = new Error('Backend server is not reachable. Please ensure the backend is running on http://localhost:3000');
          networkError.status = 0;
          networkError.isNetworkError = true;
          throw networkError;
        }
      }
      
      // Re-throw other fetch errors
      const networkError = new Error(`Network error: ${fetchError.message || 'Unable to connect to server'}`);
      networkError.status = 0;
      networkError.isNetworkError = true;
      throw networkError;
    }
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;
    
    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      // If response parsing fails, use status text
      data = { error: `Server error: ${response.status} ${response.statusText}` };
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
      
      // For payment endpoints, throw errors so they can be properly handled
      const isPaymentEndpoint = endpoint.includes('/payments/') || endpoint.includes('/flutterwave/');
      
      if (isPaymentEndpoint) {
        // Extract error message from response
        let errorMessage = `Payment API error (${response.status})`;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data && typeof data === 'object') {
          errorMessage = data.error || data.message || data.errorMessage || errorMessage;
        }
        
        // Special handling for 401 errors
        if (response.status === 401) {
          if (data?.error?.includes('token') || data?.error?.includes('Token') || 
              data?.error?.includes('expired') || data?.error?.includes('Invalid')) {
            errorMessage = 'Authentication required. Please log in and try again.';
          } else if (data?.error?.includes('No token')) {
            errorMessage = 'No authentication token found. Please log in.';
          }
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
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
    // If error was already thrown (from auth endpoints with status), re-throw it
    // Auth errors will have error.status set from the throw above
    if (error.status && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404 || error.status === 409)) {
      // This is an authentication error that was thrown - re-throw it
      throw error;
    }
    
    // For auth endpoints, throw network errors so users get feedback
    if (isAuthEndpoint) {
      const networkError = new Error('Network error. Please check your connection and try again.');
      networkError.status = 0; // Indicate network error
      throw networkError;
    }
    
    // Network errors, timeouts, etc.
    // For payment endpoints, throw the error so it can be handled properly
    if (isPaymentEndpoint) {
      const networkError = new Error(`Network error: ${error.message || 'Unable to connect to backend server'}`);
      networkError.status = 0; // Indicate network error
      networkError.isNetworkError = true;
      throw networkError;
    }
    
    // For other endpoints, return null to preserve frontend
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

