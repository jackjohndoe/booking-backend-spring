import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyProfileUpdated } from '../utils/notifications';

// Import ImagePicker - use require for better Metro compatibility
const ImagePicker = require('expo-image-picker');

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, signIn } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfileData();
    requestImagePermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestImagePermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        // Permission not granted, but don't show alert on initial load
        console.log('Media library permission not granted');
      }
    } catch (error) {
      console.error('Error requesting image permission:', error);
    }
  };

  const loadProfileData = async () => {
    try {
      // Only load profile if we have a current user
      if (!user || !user.email) {
        setName('');
        setEmail('');
        setWhatsappNumber('');
        setAddress('');
        setProfilePicture(null);
        return;
      }

      // Use user-specific storage
      const { getUserProfile } = await import('../utils/userStorage');
      const profileData = await getUserProfile(user.email);
      
      if (profileData) {
        setName(profileData.name || user?.name || '');
        setEmail(profileData.email || user?.email || '');
        setWhatsappNumber(profileData.whatsappNumber || '');
        setAddress(profileData.address || '');
        setProfilePicture(profileData.profilePicture || null);
      } else {
        // Initialize with user data
        setName(user?.name || '');
        setEmail(user?.email || '');
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // On error, use user data from auth
      setName(user?.name || '');
      setEmail(user?.email || '');
    }
  };

  // Handle image selection on web platform
  const handleWebImageSelect = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      // Convert file to data URL
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (dataUrl) {
          console.log('Image selected from web:', dataUrl.substring(0, 50) + '...');
          setProfilePicture(dataUrl);
          Alert.alert('Image Selected', 'Profile picture updated! Tap Save to apply changes.');
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading file:', file.name);
        Alert.alert('Error', 'Failed to read image file. Please try again.');
      };
      
      reader.readAsDataURL(file);
    };
    
    // Trigger file selection
    document.body.appendChild(input);
    input.click();
    
    // Clean up after a short delay
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 100);
  };

  const handleSelectImage = async () => {
    try {
      // On web, use file input instead of expo-image-picker
      if (Platform.OS === 'web') {
        handleWebImageSelect();
        return;
      }

      // Request media library permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photos to set a profile picture. Please enable photo library access in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Directly open photo library - gives immediate access to device media
      await pickImage('library');
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert(
        'Error', 
        `Failed to open image picker: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  const pickImage = async (source) => {
    try {
      let result;
      
      if (source === 'camera') {
        // Request camera permission
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Please enable camera access in your device settings to take a photo.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // Open photo library - device media only
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      // Check if user selected an image (not canceled)
      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Update profile picture in real time - this will show immediately
        let imageUri = result.assets[0].uri;
        console.log('Image selected from device:', imageUri);
        
        // On web, if we get a blob URL, convert it to a data URL for persistence
        if (Platform.OS === 'web' && imageUri.startsWith('blob:')) {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result;
              console.log('Converted blob to data URL:', dataUrl.substring(0, 50) + '...');
              setProfilePicture(dataUrl);
              Alert.alert('Image Selected', 'Profile picture updated! Tap Save to apply changes.');
            };
            reader.onerror = () => {
              console.error('Error converting blob to data URL');
              Alert.alert('Error', 'Failed to process image. Please try again.');
            };
            reader.readAsDataURL(blob);
            return; // Exit early, will set profile picture in reader.onloadend
          } catch (error) {
            console.error('Error converting blob URL:', error);
            // Fall through to use the blob URL anyway (will work temporarily)
          }
        }
        
        setProfilePicture(imageUri);
        
        // Show confirmation
        Alert.alert('Image Selected', 'Profile picture updated! Tap Save to apply changes.');
      } else {
        console.log('Image selection canceled');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image from device. Please try again.');
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (email && !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Save profile data - local storage only, no API calls
      const profileData = {
        name: name.trim(),
        email: email.trim(),
        whatsappNumber: whatsappNumber.trim(),
        address: address.trim(),
        profilePicture: profilePicture, // Only device media URIs (file://)
      };
      
      // Save to user-specific storage
      const { saveUserProfile } = await import('../utils/userStorage');
      await saveUserProfile(user.email, profileData);
      console.log('EditProfileScreen - Profile saved to userStorage:', { 
        ...profileData, 
        profilePicture: profilePicture ? 'Image set' : 'No image',
        pictureUri: profilePicture ? (profilePicture.length > 50 ? profilePicture.substring(0, 50) + '...' : profilePicture) : null
      });
      
      // Verify the save by reading it back (same as phone number)
      const { getUserProfile } = await import('../utils/userStorage');
      const verifyProfile = await getUserProfile(user.email);
      console.log('EditProfileScreen - Verified saved profile:', {
        hasPicture: !!verifyProfile?.profilePicture,
        hasPhone: !!verifyProfile?.whatsappNumber,
        pictureMatches: verifyProfile?.profilePicture === profilePicture
      });
      
      // Update auth context with name and email (same as phone number - no special handling for picture)
      // Profile picture is stored in userStorage and loaded by ProfileScreen, just like phone number
      try {
        const updatedUser = {
          ...user,
          name: name.trim(),
          email: email.trim(),
        };
        await signIn(updatedUser);
      } catch (signInError) {
        console.error('Error updating auth context:', signInError);
        // Continue even if signIn fails - profile is already saved to userStorage
      }

      // Add notification - local only, no API calls
      try {
        await notifyProfileUpdated();
      } catch (notificationError) {
        console.error('Error adding notification:', notificationError);
        // Continue even if notification fails - profile is already saved
      }

      // Navigate back - ProfileScreen will reload from userStorage via useFocusEffect
      // This is the same flow as phone number - simple and reliable
      navigation.goBack();
      
      // Show success message after navigation
      setTimeout(() => {
        Alert.alert('Success', 'Profile updated successfully!');
      }, 300);
    } catch (error) {
      console.error('Error saving profile:', error);
      // Check if it's a 500 error or other server error
      const errorMessage = error.status === 500 
        ? 'Server error. Your profile has been saved locally.'
        : 'Failed to save profile. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <View style={styles.avatarContainer}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(name && name.trim() ? name.charAt(0).toUpperCase() : 'U')}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleSelectImage}
            >
              <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={handleSelectImage}
          >
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* WhatsApp Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>WhatsApp Number</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+234</Text>
              </View>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="Enter WhatsApp number"
                value={whatsappNumber}
                onChangeText={setWhatsappNumber}
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter your address"
              value={address}
              onChangeText={setAddress}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profilePictureSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  formSection: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F5F5F5',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
});

