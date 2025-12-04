import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import * as Google from 'expo-auth-session/providers/google';
import { useNavigation } from '@react-navigation/native';
import { authService } from '../services/authService';

let AppleAuthentication;
if (Platform.OS === 'ios') {
  AppleAuthentication = require('expo-apple-authentication');
}

export default function SignInScreen() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      const handleGoogleAuth = async () => {
        try {
          // Sign in existing user (not new user) - pass isNewUser=false
          // This ensures existing users don't see the welcome deal
          await signIn({
            id: authentication?.accessToken || 'google_user',
            name: 'Google User',
            email: '',
            provider: 'google',
          }, false);
          navigation.replace('Main');
        } catch (error) {
          Alert.alert('Error', 'Failed to sign in. Please try again.');
        }
      };
      handleGoogleAuth();
    }
  }, [response]);

  const handleEmailSignIn = async () => {
    // Clear previous error
    setErrorMessage('');
    
    // Validation
    if (!email || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }
    
    // Normalize email (trim and lowercase) to match how it was stored during sign up
    const normalizedEmail = email.trim().toLowerCase();
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      // Call backend API for authentication with normalized email
      // This will match the email format used during registration
      const response = await authService.login(normalizedEmail, password);
      
      if (response && response.user) {
        // Success - credentials are correct and match what was stored during sign up
        // Backend has authenticated the user
        // Sign in the user locally
        // Pass isNewUser=false to indicate this is a sign-in, not a sign-up
        // This ensures existing users don't see the welcome deal
        await signIn(response.user, false);
        
        // Navigation will happen automatically via App.js conditional rendering
        // when user state is set, but we can also navigate explicitly
        navigation.replace('Main');
      } else {
        // API returned null or invalid response
        setErrorMessage('Invalid email or password. Please check your credentials.');
      }
    } catch (error) {
      // Handle API errors - extract message from error object
      const errorMsg = error.message || error.toString() || '';
      const lowerErrorMsg = errorMsg.toLowerCase();
      
      if (lowerErrorMsg.includes('401') || lowerErrorMsg.includes('403') || 
          lowerErrorMsg.includes('invalid') || lowerErrorMsg.includes('incorrect') ||
          lowerErrorMsg.includes('wrong') || lowerErrorMsg.includes('incorrect credentials')) {
        setErrorMessage('Invalid email or password. Please check your credentials.');
      } else if (lowerErrorMsg.includes('404') || lowerErrorMsg.includes('not found') ||
                 lowerErrorMsg.includes('user not found') || lowerErrorMsg.includes('account not found')) {
        setErrorMessage('Account not found. Please sign up first.');
      } else if (lowerErrorMsg.includes('network') || lowerErrorMsg.includes('failed to fetch') ||
                 lowerErrorMsg.includes('connection')) {
        setErrorMessage('Network error. Please check your connection and try again.');
      } else {
        // Show backend error message if available, otherwise generic message
        const displayMsg = errorMsg && errorMsg.length > 0 && !errorMsg.includes('Error:') 
          ? errorMsg 
          : 'Failed to sign in. Please try again.';
        setErrorMessage(displayMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
    } catch (error) {
      Alert.alert('Error', 'Google sign in failed. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    if (!AppleAuthentication) {
      Alert.alert('Error', 'Apple authentication is only available on iOS');
      return;
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      await signIn({
        id: credential.user,
        name: credential.fullName?.givenName || 'Apple User',
        email: credential.email || '',
        provider: 'apple',
      });
      navigation.replace('Main');
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        // User canceled, do nothing
      } else {
        Alert.alert('Error', 'Apple sign in failed. Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Welcome back!</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errorMessage && styles.inputError]}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrorMessage(''); // Clear error when user types
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errorMessage && styles.inputError]}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(''); // Clear error when user types
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
            />
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            onPress={handleEmailSignIn}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.signInButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={!request}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.8}
            disabled={Platform.OS !== 'ios'}
          >
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signInButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#999',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  footerLink: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
});

