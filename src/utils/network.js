// Network connectivity utilities
// Simple network detection using fetch API

let isOnline = true;
let networkCheckPromise = null;

/**
 * Check if device has network connectivity
 * Uses a simple fetch to a reliable endpoint
 * @returns {Promise<boolean>} True if online, false if offline
 */
export const checkNetworkConnectivity = async () => {
  // Return cached result if check is already in progress
  if (networkCheckPromise) {
    return networkCheckPromise;
  }

  networkCheckPromise = (async () => {
    try {
      // Try to fetch from a reliable endpoint with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      isOnline = true;
      return true;
    } catch (error) {
      // Network error - device is likely offline
      isOnline = false;
      return false;
    } finally {
      // Clear the promise after a short delay to allow caching
      setTimeout(() => {
        networkCheckPromise = null;
      }, 1000);
    }
  })();

  return networkCheckPromise;
};

/**
 * Get current network status (cached)
 * @returns {boolean} True if online, false if offline
 */
export const isNetworkOnline = () => {
  return isOnline;
};

/**
 * Check if we can reach the backend API
 * @returns {Promise<boolean>} True if backend is reachable
 */
export const checkBackendConnectivity = async () => {
  try {
    const { API_CONFIG } = await import('../config/api');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/me`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);
    // Even if we get an error response, the backend is reachable
    return true;
  } catch (error) {
    // Network error - backend is not reachable
    return false;
  }
};

/**
 * Wait for network to come online
 * @param {number} maxWait - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} True if network came online, false if timeout
 */
export const waitForNetwork = async (maxWait = 10000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const online = await checkNetworkConnectivity();
    if (online) {
      return true;
    }
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
};




















