import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [imageError, setImageError] = useState(false);
  
  const handleNavigate = (screen) => {
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate(screen);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Background image URL - using a beautiful Nigerian apartment/home image
  const backgroundImage = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';
  const defaultBackground = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ImageBackground
        source={{ uri: imageError ? defaultBackground : backgroundImage }}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
        onError={() => {
          console.log('Background image failed to load, using default');
          setImageError(true);
        }}
      >
        <View style={styles.overlay} />
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <MaterialIcons name="home" size={60} color="#333" />
          </View>
        <Text style={styles.title}>Nigerian Apartments</Text>
        <Text style={styles.subtitle}>Find Your Perfect Home</Text>
        <Text style={styles.description}>
          Discover amazing apartments across Nigeria. Your dream home awaits.{'\n\n'}
          <Text style={styles.paymentInfo}>Payments are received daily (per month)</Text>
        </Text>
        
        <TouchableOpacity
          style={styles.comeInButton}
          onPress={() => handleNavigate('SignIn')}
          activeOpacity={0.8}
        >
          <Text style={styles.comeInButtonText}>Come In</Text>
        </TouchableOpacity>

        <View style={styles.authLinks}>
          <TouchableOpacity onPress={() => handleNavigate('SignIn')}>
            <Text style={styles.linkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImageStyle: {
    opacity: 0.3,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    padding: 20,
    zIndex: 1,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  paymentInfo: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 10,
  },
  comeInButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  comeInButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  authLinks: {
    marginTop: 30,
  },
  linkText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
