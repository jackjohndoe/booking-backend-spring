// Token Expiration Handler
import AsyncStorage from '@react-native-async-storage/async-storage';

let isHandlingExpiration = false;

/**
 * Handle token expiration gracefully WITHOUT logging out the user
 * This should be called when a 401 error is received
 * The user stays logged in and can continue using the app with local data
 */
export const handleTokenExpiration = async (errorMessage = 'Your authentication token has expired. Some features may not work until you sign out and sign in again.') => {
  // Prevent multiple simultaneous expiration handlers
  if (isHandlingExpiration) {
    return;
  }
  
  isHandlingExpiration = true;
  
  try {
    // DO NOT clear user data - user stays logged in
    // Just log the warning for debugging
    console.warn('⚠️ Token expired, but user remains logged in:', errorMessage);
    console.warn('⚠️ User can continue using the app. They can sign out manually if needed.');
    
    // Show a non-blocking notification instead of forcing logout
    // User can continue using the app with local data
    const isWeb = typeof window !== 'undefined';
    
    if (isWeb) {
      // On web, show a console warning (non-blocking)
      console.warn('Token expired. You can continue using the app. Sign out and sign in again to refresh your token.');
    } else {
      // On native, show a non-blocking alert that doesn't force logout
      try {
        const { Alert } = await import('react-native');
        Alert.alert(
          'Session Expired',
          'Your authentication token has expired. You can continue using the app, but some features may not work until you sign out and sign in again.\n\nWould you like to sign out now?',
          [
            {
              text: 'Continue Using App',
              style: 'cancel',
              onPress: () => {
                // User chooses to stay logged in - do nothing
                console.log('User chose to continue using app despite expired token');
              }
            },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: async () => {
                // User explicitly chooses to sign out
                try {
                  // Import authService to handle logout
                  const { authService } = await import('../services/authService');
                  await authService.logout();
                  console.log('User chose to sign out after token expiration');
                  
                  // Clear user from AsyncStorage and reload
                  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                  await AsyncStorage.removeItem('user');
                  
                  // Reload app to reset state
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }
            }
          ],
          { cancelable: true }
        );
      } catch (importError) {
        console.error('Error importing Alert:', importError);
        // Fallback: just log the warning
        console.warn('Token expired:', errorMessage);
      }
    }
  } catch (error) {
    console.error('Error handling token expiration:', error);
  } finally {
    // Reset flag after a delay
    setTimeout(() => {
      isHandlingExpiration = false;
    }, 2000);
  }
};

/**
 * Check if we're currently handling token expiration
 */
export const isHandlingTokenExpiration = () => isHandlingExpiration;

