// Network status monitoring hook
import { useState, useEffect } from 'react';
import { checkNetworkConnectivity, isNetworkOnline } from '../utils/network';

/**
 * Hook to monitor network connectivity status
 * @returns {Object} Network status object with isOnline and isChecking properties
 */
export const useNetworkStatus = (checkInterval = 30000) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let intervalId;
    let isMounted = true;

    // Initial check
    const checkNetwork = async () => {
      if (!isMounted) return;
      
      setIsChecking(true);
      try {
        const online = await checkNetworkConnectivity();
        if (isMounted) {
          setIsOnline(online);
        }
      } catch (error) {
        console.error('Error checking network status:', error);
        if (isMounted) {
          setIsOnline(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    // Initial check
    checkNetwork();

    // Set up periodic checks
    if (checkInterval > 0) {
      intervalId = setInterval(checkNetwork, checkInterval);
    }

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [checkInterval]);

  return {
    isOnline,
    isChecking,
    checkNetwork: async () => {
      setIsChecking(true);
      try {
        const online = await checkNetworkConnectivity();
        setIsOnline(online);
        return online;
      } catch (error) {
        console.error('Error checking network status:', error);
        setIsOnline(false);
        return false;
      } finally {
        setIsChecking(false);
      }
    },
  };
};




















