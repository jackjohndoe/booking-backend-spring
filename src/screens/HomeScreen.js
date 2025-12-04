import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const handleNavigate = (screen) => {
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate(screen);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
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
