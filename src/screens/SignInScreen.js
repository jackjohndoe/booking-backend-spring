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
import { MaterialIcons } from '@expo/vector-icons';
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
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    // Clear previous errors
    setErrorMessage('');
    setEmailError(false);
    setPasswordError(false);
    
    // Step 1: Validate that fields are not empty
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    let hasError = false;
    
    if (!trimmedEmail) {
      setEmailError(true);
      setErrorMessage('Please enter your email address');
      hasError = true;
    }
    
    if (!trimmedPassword) {
      setPasswordError(true);
      if (!hasError) {
        setErrorMessage('Please enter your password');
      } else {
        setErrorMessage('Please fill in all fields');
      }
      hasError = true;
    }
    
    if (hasError) {
      return;
    }
    
    // Step 2: Validate email format
    const normalizedEmail = trimmedEmail.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setEmailError(true);
      setErrorMessage('Please enter a valid email address (e.g., user@example.com)');
      return;
    }
    
    // Step 3: Validate password length
    if (trimmedPassword.length < 6) {
      setPasswordError(true);
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    
    // Step 4: All validation passed - attempt login
    setLoading(true);
    setErrorMessage(''); // Clear any previous errors
    setEmailError(false);
    setPasswordError(false);
    
    try {
      // Step 5: Authenticate with backend
      const response = await authService.login(normalizedEmail, trimmedPassword);
      
      // Step 6: Validate authentication response
      if (!response) {
        setEmailError(true);
        setPasswordError(true);
        setErrorMessage('Authentication failed. Invalid email or password.');
        setLoading(false);
        return;
      }
      
      if (!response.user) {
        setEmailError(true);
        setPasswordError(true);
        setErrorMessage('Authentication failed. Invalid email or password.');
        setLoading(false);
        return;
      }
      
      // Step 7: Verify user data is complete
      if (!response.user.email) {
        setErrorMessage('Invalid authentication response. Please try again.');
        setLoading(false);
        return;
      }
      
      // Step 8: Authentication successful - backend has verified credentials
      // Pass isNewUser=false to indicate this is a sign-in, not a sign-up
      await signIn(response.user, false);
      
      // Navigate to main app after successful authentication
      navigation.replace('Main');
    } catch (error) {
      // Handle API errors - extract message from error object
      const errorMsg = error.message || error.toString() || '';
      const lowerErrorMsg = errorMsg.toLowerCase();
      
      // Check for Railway backend specific errors first
      if (lowerErrorMsg.includes('railway backend') || lowerErrorMsg.includes('unavailable') || 
          error.status === 502 || error.status === 503 || error.isBackendDown) {
        setErrorMessage('Railway backend is currently unavailable. The server may be starting up. Please try again in a few moments.');
      }
      // Network errors - require backend connection for authentication
      else if (lowerErrorMsg.includes('network') || lowerErrorMsg.includes('failed to fetch') ||
          lowerErrorMsg.includes('connection') || lowerErrorMsg.includes('network error') ||
          error.status === 0 || errorMsg.includes('timeout') || errorMsg.includes('No internet') ||
          errorMsg.includes('Cannot connect') || errorMsg.includes('unreachable')) {
        // Check if it's a Railway-specific error
        if (lowerErrorMsg.includes('railway') || lowerErrorMsg.includes('backend')) {
          setErrorMessage('Cannot connect to Railway backend. Please check your internet connection. If the issue persists, the backend may be temporarily unavailable.');
        } else {
          let networkMsg = 'Network error. Please check your internet connection and try again.';
          
          // Add emulator-specific help
          if (Platform.OS === 'android') {
            networkMsg += ' If using an emulator, ensure it has network access in Android Studio settings.';
          }
          
          setErrorMessage(networkMsg);
        }
      } 
      // Invalid credentials (401, 403, unauthorized)
      else if (error.status === 401 || error.status === 403 || 
          lowerErrorMsg.includes('401') || lowerErrorMsg.includes('403') || 
          lowerErrorMsg.includes('invalid') || lowerErrorMsg.includes('incorrect') ||
          lowerErrorMsg.includes('wrong') || lowerErrorMsg.includes('incorrect credentials') ||
          lowerErrorMsg.includes('unauthorized') || lowerErrorMsg.includes('authentication failed')) {
        setEmailError(true);
        setPasswordError(true);
        setErrorMessage('Invalid email or password. Please check your credentials and try again.');
      } 
      // Account not found (404)
      else if (error.status === 404 || 
          lowerErrorMsg.includes('404') || lowerErrorMsg.includes('not found') ||
          lowerErrorMsg.includes('user not found') || lowerErrorMsg.includes('account not found')) {
        setEmailError(true);
        setErrorMessage('Account not found. Please sign up first or check your email address.');
      } 
      // Server errors (500, 502, 503)
      else if (error.status === 500 || error.status === 502 || error.status === 503 ||
          lowerErrorMsg.includes('500') || lowerErrorMsg.includes('502') || lowerErrorMsg.includes('503') ||
          lowerErrorMsg.includes('server error') || lowerErrorMsg.includes('internal server') ||
          lowerErrorMsg.includes('railway backend') || lowerErrorMsg.includes('unavailable')) {
        if (error.status === 502 || lowerErrorMsg.includes('502') || lowerErrorMsg.includes('railway backend')) {
          setErrorMessage('Railway backend is currently unavailable. The server may be starting up. Please try again in a few moments.');
        } else {
          setErrorMessage('Server error. The Railway backend is temporarily unavailable. Please try again in a few moments.');
        }
      }
      // Timeout errors
      else if (error.status === 408 || lowerErrorMsg.includes('timeout') || lowerErrorMsg.includes('taking too long')) {
        setErrorMessage('Request timeout. The server is taking too long to respond. Please check your connection and try again.');
      }
      // Other errors - show backend message
      else {
        // Show backend error message if available, otherwise generic message
        let displayMsg = 'Failed to sign in. Please check your credentials and try again.';
        
        if (errorMsg && errorMsg.length > 0) {
          // Clean up error message
          const cleanMsg = errorMsg
            .replace(/^Error:\s*/i, '')
            .replace(/^Authentication failed\s*\(\d+\)/i, '')
            .trim();
          
          if (cleanMsg.length > 0 && !cleanMsg.includes('Error:') && cleanMsg.length < 200) {
            displayMsg = cleanMsg;
          }
        }
        
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
              style={[styles.input, (errorMessage && emailError) && styles.inputError]}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) {
                  setEmailError(false);
                  setErrorMessage(''); // Clear error when user types
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            {emailError && errorMessage && (
              <Text style={styles.fieldErrorText}>{errorMessage}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, (errorMessage && passwordError) && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) {
                    setPasswordError(false);
                    setErrorMessage(''); // Clear error when user types
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={24}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {passwordError && errorMessage && !emailError && (
              <Text style={styles.fieldErrorText}>{errorMessage}</Text>
            )}
          </View>

          {/* Error Message - Show general errors that aren't field-specific */}
          {errorMessage && !emailError && !passwordError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

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
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
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
    borderWidth: 2,
  },
  fieldErrorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
});

