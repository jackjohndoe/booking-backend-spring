import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
// Notifications are optional - may not work in Expo Go
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  // Notifications not available - app will work without them
}
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/hooks/useAuth';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import { initializeSync } from './src/services/listingSyncService';

const Stack = createStackNavigator();


function AppContent() {
  const { user, isLoading } = useAuth();
  const notificationListener = useRef();
  const responseListener = useRef();
  const navigationRef = React.useRef();
  const syncServiceRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Initialize listing sync service
  useEffect(() => {
    console.log('🔄 Initializing listing sync service...');
    try {
      syncServiceRef.current = initializeSync();
      console.log('✅ Listing sync service initialized');
    } catch (error) {
      console.error('❌ Error initializing sync service:', error);
    }

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - sync pending listings
        console.log('🔄 App came to foreground, syncing pending listings...');
        if (syncServiceRef.current && syncServiceRef.current.sync) {
          syncServiceRef.current.sync().catch(error => {
            console.error('Error syncing on foreground:', error);
          });
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      // Cleanup: stop periodic sync
      if (syncServiceRef.current && syncServiceRef.current.stop) {
        syncServiceRef.current.stop();
      }
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Set up notification handlers - optional (may not work in Expo Go)
    if (!Notifications) {
      // Notifications not available - app continues without them
      return;
    }

    try {
      // Check if notification methods exist
      if (Notifications.addNotificationReceivedListener) {
        try {
          notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received:', notification);
          });
        } catch (e) {
          // Not available in Expo Go - continue silently
        }
      }

      if (Notifications.addNotificationResponseReceivedListener) {
        try {
          responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            try {
              console.log('Notification response:', response);
              const data = response?.notification?.request?.content?.data;
              
              // Handle rating prompt notification
              if (data && data.type === 'rating_prompt' && navigationRef.current && navigationRef.current.isReady()) {
                const { apartmentId, hostEmail, apartmentTitle } = data;
                
                // Navigate to host profile if we have the data
                if (hostEmail) {
                  import('./src/utils/listings').then(({ getListings }) => {
                    getListings().then(listings => {
                      const apartment = listings.find(apt => 
                        String(apt.id) === String(apartmentId) ||
                        apt.hostEmail === hostEmail ||
                        apt.createdBy === hostEmail
                      );
                      
                      if (apartment && navigationRef.current && navigationRef.current.isReady()) {
                        navigationRef.current.navigate('Main', {
                          screen: 'Explore',
                          params: {
                            screen: 'HostProfile',
                            params: { apartment }
                          }
                        });
                      } else if (navigationRef.current && navigationRef.current.isReady()) {
                        navigationRef.current.navigate('Main', {
                          screen: 'Explore'
                        });
                      }
                    }).catch(error => {
                      console.error('Error loading listings for notification:', error);
                    });
                  }).catch(error => {
                    console.error('Error importing listings module:', error);
                  });
                }
              }
            } catch (error) {
              console.error('Error handling notification response:', error);
            }
          });
        } catch (e) {
          // Not available in Expo Go - continue silently
        }
      }
    } catch (error) {
      // Notifications not available - app continues without them
    }

    return () => {
      try {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }
  
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="SignIn"
      >
        {!user ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

