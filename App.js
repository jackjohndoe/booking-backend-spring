import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Suppress expo-notifications warnings/errors in Expo Go (these are expected and harmless)
if (__DEV__) {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Suppress warnings about expo-notifications in Expo Go
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    // These warnings are expected - push notifications require a development build
    // The app works fine without them, using in-app notifications instead
    if (
      message.includes('expo-notifications') ||
      message.includes('Android Push notifications') ||
      message.includes('functionality provided by expo-notifications was removed') ||
      message.includes('development build') ||
      message.includes('Use a development build instead of Expo Go') ||
      message.includes('expo-notifications functionality is not fully supported') ||
      message.includes('We recommend you instead use a development build') ||
      message.includes('expo.fyi/dev')
    ) {
      // Silently ignore these expected warnings
      return;
    }
    originalWarn.apply(console, args);
  };
  
  // Suppress errors about expo-notifications in Expo Go
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('expo-notifications') &&
      (message.includes('Android Push notifications') ||
       message.includes('was removed from Expo Go') ||
       message.includes('development build') ||
       message.includes('We recommend you instead use a development build') ||
       message.includes('expo.fyi/dev'))
    ) {
      // Silently ignore these expected errors
      return;
    }
    originalError.apply(console, args);
  };
}

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
import MainTabNavigator from './src/navigation/MainTabNavigator';

const Stack = createStackNavigator();


function AppContent() {
  const { user, isLoading } = useAuth();
  const notificationListener = useRef();
  const responseListener = useRef();
  const navigationRef = React.useRef();

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

