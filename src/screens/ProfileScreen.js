import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const [profileData, setProfileData] = useState(null);
  const [hasListings, setHasListings] = useState(false);

  const loadProfileData = React.useCallback(async () => {
    try {
      // Only load profile if we have a current user
      if (!user || !user.email) {
        setProfileData(null);
        return;
      }

      console.log('ProfileScreen - Loading profile data for:', user.email);

      // Use user-specific storage
      const { getUserProfile } = await import('../utils/userStorage');
      const loadedProfileData = await getUserProfile(user.email);
      
      if (loadedProfileData) {
        // Always use the latest profile data from userStorage
        const newProfileData = {
          name: loadedProfileData.name || user?.name || 'User',
          email: loadedProfileData.email || user?.email || '',
          profilePicture: loadedProfileData.profilePicture || null,
          whatsappNumber: loadedProfileData.whatsappNumber || null,
          address: loadedProfileData.address || null,
        };
        
        console.log('ProfileScreen - Loaded profile data from userStorage:', {
          name: newProfileData.name,
          hasPicture: !!newProfileData.profilePicture,
          hasPhone: !!newProfileData.whatsappNumber,
        });
        
        // Update profile data (same simple flow as phone number)
        setProfileData(newProfileData);
      } else {
        // If no saved profile, use user data from auth
        const fallbackData = {
          name: user?.name || 'User',
          email: user?.email || '',
          profilePicture: user?.profilePicture || null, // Also check auth context
          whatsappNumber: null,
          address: null,
        };
        setProfileData(fallbackData);
        console.log('ProfileScreen - No saved profile, using auth data:', {
          hasPicture: !!fallbackData.profilePicture
        });
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // On error, use user data from auth
      setProfileData({
        name: user?.name,
        email: user?.email,
        profilePicture: user?.profilePicture || null, // Also check auth context
      });
    }
  }, [user]);

  // Load profile on mount and when user changes (same as phone number)
  useEffect(() => {
    loadProfileData();
  }, [user]);


  // Check if user has listings
  const checkUserListings = React.useCallback(async () => {
    try {
      if (!user || !user.email) {
        setHasListings(false);
        return;
      }

      const { getMyListings } = await import('../utils/listings');
      const userListings = await getMyListings();
      
      // Also check API listings
      let apiListings = [];
      try {
        const { hybridApartmentService } = await import('../services/hybridService');
        const apiResult = await hybridApartmentService.getMyApartments();
        if (apiResult && Array.isArray(apiResult) && apiResult.length > 0) {
          apiListings = apiResult;
        }
      } catch (apiError) {
        // API not available, use local only
      }

      const totalListings = userListings.length + apiListings.length;
      setHasListings(totalListings > 0);
    } catch (error) {
      console.error('Error checking user listings:', error);
      setHasListings(false);
    }
  }, [user]);

  // Reload profile when screen comes into focus (same simple flow as phone number)
  useFocusEffect(
    React.useCallback(() => {
      // Reload when screen comes into focus - this ensures profile picture appears after saving
      // This is the same mechanism that makes phone number appear immediately
      loadProfileData();
      checkUserListings();
    }, [user, loadProfileData, checkUserListings])
  );

  const handleSignOut = () => {
    // On web, use window.confirm instead of Alert.alert for better compatibility
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) {
        return;
      }
      
      // Sign out immediately on web
      (async () => {
        try {
          console.log('🔄 Starting sign out process...');
          await signOut();
          console.log('✅ Sign out completed - reloading page...');
          
          // Clear AsyncStorage explicitly before reload
          try {
            await AsyncStorage.removeItem('user');
          } catch (e) {
            console.error('Error clearing storage:', e);
          }
          
          // Force reload after a brief delay to ensure state is cleared
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } catch (error) {
          console.error('❌ Error signing out:', error);
          // Force reload even on error
          window.location.reload();
        }
      })();
    } else {
      // Native platforms use Alert.alert
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🔄 Starting sign out process...');
                await signOut();
                console.log('✅ Sign out completed - navigation will be handled by App.js');
              } catch (error) {
                console.error('❌ Error signing out:', error);
                Alert.alert(
                  'Sign Out',
                  'There was an error signing out, but you have been logged out locally.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {profileData?.profilePicture ? (
            <Image 
              source={{ uri: profileData.profilePicture }} 
              style={styles.avatarImage}
              onError={(error) => {
                console.error('ProfileScreen - Error loading profile image:', error);
                // Clear invalid image URL
                setProfileData(prev => ({ ...prev, profilePicture: null }));
              }}
              onLoad={() => {
                console.log('ProfileScreen - Profile image loaded successfully');
              }}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profileData?.name || user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{profileData?.name || user?.name || 'User'}</Text>
          <Text style={styles.email}>{profileData?.email || user?.email || 'user@example.com'}</Text>
          {profileData?.whatsappNumber && (
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={16} color="#666" />
              <Text style={styles.infoText}>+234 {profileData.whatsappNumber}</Text>
            </View>
          )}
          {profileData?.address && (
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.infoText} numberOfLines={2}>{profileData.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <MaterialIcons name="person" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSubtitle}>Update your personal information</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Notifications')}
          >
            <MaterialIcons name="notifications" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuSubtitle}>View your notifications</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('BookingHistory')}
          >
            <MaterialIcons name="history" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Booking History</Text>
              <Text style={styles.menuSubtitle}>View your apartment bookings</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <MaterialIcons name="book-online" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>My Bookings</Text>
              <Text style={styles.menuSubtitle}>Manage your current bookings</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyListings')}
          >
            <MaterialIcons name="add-business" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Upload Listing</Text>
              <Text style={styles.menuSubtitle}>List your apartment for rent</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('HostBookedListings')}
          >
            <MaterialIcons name="event-available" size={24} color="#FFD700" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Booked Listings</Text>
              <Text style={styles.menuSubtitle}>View bookings for your apartments</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <MaterialIcons name="help-outline" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>Get help and contact support</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('About')}
          >
            <MaterialIcons name="info-outline" size={24} color="#333" />
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuSubtitle}>App version 1.0.0</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    paddingTop: 80,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  menuArrow: {
    fontSize: 24,
    color: '#999',
  },
  signOutButton: {
    backgroundColor: '#F44336',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

