import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import ExploreScreen from '../screens/ExploreScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import BookingHistoryScreen from '../screens/BookingHistoryScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import UploadListingScreen from '../screens/UploadListingScreen';
import AboutScreen from '../screens/AboutScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import ApartmentDetailsScreen from '../screens/ApartmentDetailsScreen';
import PaymentConfirmationScreen from '../screens/PaymentConfirmationScreen';
import PaymentOptionsScreen from '../screens/PaymentOptionsScreen';
import CardPaymentScreen from '../screens/CardPaymentScreen';
import TransferPaymentScreen from '../screens/TransferPaymentScreen';
import HostProfileScreen from '../screens/HostProfileScreen';
import HostBookedListingsScreen from '../screens/HostBookedListingsScreen';
import HostBookingDetailsScreen from '../screens/HostBookingDetailsScreen';
import UserBookingDetailsScreen from '../screens/UserBookingDetailsScreen';
import { Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabIcon = ({ iconName, focused }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <MaterialIcons 
      name={iconName} 
      size={24} 
      color={focused ? '#FFD700' : '#666'} 
    />
  </View>
);

function ExploreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ExploreMain" 
        component={ExploreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ApartmentDetails" 
        component={ApartmentDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PaymentConfirmation" 
        component={PaymentConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PaymentOptions" 
        component={PaymentOptionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="CardPayment" 
        component={CardPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="TransferPayment" 
        component={TransferPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostProfile" 
        component={HostProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function FavoritesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="FavoritesMain" 
        component={FavoritesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ApartmentDetails" 
        component={ApartmentDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PaymentConfirmation" 
        component={PaymentConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PaymentOptions" 
        component={PaymentOptionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="CardPayment" 
        component={CardPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="TransferPayment" 
        component={TransferPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostProfile" 
        component={HostProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="BookingHistory" 
        component={BookingHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MyBookings" 
        component={MyBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="UserBookingDetails" 
        component={UserBookingDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="MyListings" 
        component={MyListingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="UploadListing" 
        component={UploadListingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HelpSupport" 
        component={HelpSupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostBookedListings" 
        component={HostBookedListingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="HostBookingDetails" 
        component={HostBookingDetailsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconName="home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconName="favorite" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconName="account-balance-wallet" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconName="person" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFocused: {
    borderRadius: 12,
    backgroundColor: '#FFF9E6',
  },
});

