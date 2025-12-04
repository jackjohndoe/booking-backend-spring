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
// Welcome deal modal is now shown on the home page (ExploreScreen) instead

let AppleAuthentication;
if (Platform.OS === 'ios') {
  AppleAuthentication = require('expo-apple-authentication');
}

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showWelcomeDeal, setShowWelcomeDeal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  const handleClaimDeal = async () => {
    if (!newUserEmail) return;
    
    try {
      setLoading(true);
      
      // IMPORTANT: SET wallet balance to exactly ₦50,000 (not add to existing)
      // New users start with ₦0, so claiming the deal sets it to exactly ₦50,000
      // Each user's wallet is completely isolated - this only affects the new user
      const { updateWalletBalance, addTransaction } = await import('../utils/wallet');
      
      // Set balance to exactly ₦50,000
      await updateWalletBalance(newUserEmail, 50000);
      
      // Add transaction record for the welcome bonus
      await addTransaction(newUserEmail, {
        type: 'deposit',
        amount: 50000,
        description: 'Welcome Bonus Voucher',
        status: 'completed',
      });
      
      // Verify the balance was set correctly
      const { getWalletBalance } = await import('../utils/wallet');
      const verifiedBalance = await getWalletBalance(newUserEmail);
      console.log(`✅ Welcome bonus claimed: User ${newUserEmail} wallet set to ₦${verifiedBalance.toLocaleString()}`);
      
      // Mark deal as claimed
      await markWelcomeDealSeen(newUserEmail, true);
      
      setShowWelcomeDeal(false);
      setNewUserEmail(null);
      
      Alert.alert(
        'Congratulations!',
        '₦50,000 has been added to your wallet! Start booking your dream apartment now.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.replace('Main');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error claiming welcome deal:', error);
      Alert.alert('Error', 'Failed to claim deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDeal = async () => {
    if (!newUserEmail) return;
    
    // Mark deal as seen (but not claimed)
    await markWelcomeDealSeen(newUserEmail, false);
    
    // Ensure wallet is initialized to 0 for users who don't claim the deal
    // This guarantees each user starts with zero balance if they don't claim
    try {
      const { updateWalletBalance } = await import('../utils/wallet');
      await updateWalletBalance(newUserEmail, 0);
      console.log(`✅ Wallet initialized to ₦0 for user: ${newUserEmail}`);
    } catch (walletError) {
      console.error('Error initializing wallet to zero:', walletError);
      // Continue even if wallet initialization fails - getWalletBalance will return 0 anyway
    }
    
    setShowWelcomeDeal(false);
    setNewUserEmail(null);
    
    // Show success message and navigate
    Alert.alert('Success', 'Account created successfully!', [
      {
        text: 'OK',
        onPress: () => {
          navigation.replace('Main');
        },
      },
    ]);
  };

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      const handleGoogleAuth = async () => {
        try {
          const userData = {
            id: authentication?.accessToken || 'google_user',
            name: 'Google User',
            email: '',
            provider: 'google',
          };
          await signIn(userData);
          
          // IMMEDIATELY initialize wallet to ₦0 for new Google user
          // This ensures every new user starts with zero balance
          if (userData.email) {
            try {
              const { updateWalletBalance } = await import('../utils/wallet');
              await updateWalletBalance(userData.email, 0);
              console.log(`✅ Wallet initialized to ₦0 for new Google user: ${userData.email}`);
            } catch (walletInitError) {
              console.error('Error initializing wallet to zero:', walletInitError);
              // Continue even if wallet initialization fails
            }
            
            // Navigate to home page - welcome deal modal will appear there
            // The modal will show on the home page (ExploreScreen) for new users
          }
          
          navigation.replace('Main');
        } catch (error) {
          Alert.alert('Error', 'Failed to sign up. Please try again.');
        }
      };
      handleGoogleAuth();
    }
  }, [response]);

  const handleEmailSignUp = async () => {
    // Clear previous error
    setErrorMessage('');
    
    // Basic validation - only check what's essential for new account registration
    // Since this is a new account, we just need to ensure data is provided and valid
    
    // Check if required fields are filled
    if (!name || !email || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }
    
    // Check if name has content (after trimming whitespace)
    if (!name.trim()) {
      setErrorMessage('Please enter your name');
      return;
    }
    
    // Check if email is in valid format (needed for account creation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    
    // Check if password is provided (minimum length for security)
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      // Call backend API for registration
      const response = await authService.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      });
      
      // Check if registration was successful
      // Response should have user data or at least indicate success
      if (response) {
        // If response has user object, use it
        // Otherwise, create user object from registration data
        const userToSignIn = response.user || {
          id: response.id || response._id || response.data?.id || response.data?._id || email.trim().toLowerCase(),
          name: response.name || response.data?.name || response.user?.name || name.trim(),
          email: response.email || response.data?.email || response.user?.email || email.trim().toLowerCase(),
          token: response.token || response.accessToken || response.data?.token || response.user?.token || null,
        };
        
        // Ensure user object has required fields
        if (!userToSignIn.email) {
          userToSignIn.email = email.trim().toLowerCase();
        }
        if (!userToSignIn.name) {
          userToSignIn.name = name.trim();
        }
        if (!userToSignIn.id) {
          userToSignIn.id = userToSignIn.email;
        }
        
        // Sign in the user locally
        // Pass isNewUser=true to indicate this is a sign-up, not a sign-in
        // This ensures new users can see the welcome deal
        await signIn(userToSignIn, true);
        
        // IMMEDIATELY initialize wallet to ₦0 for new user
        // This ensures every new user starts with zero balance
        try {
          const { updateWalletBalance } = await import('../utils/wallet');
          await updateWalletBalance(userToSignIn.email, 0);
          console.log(`✅ Wallet initialized to ₦0 for new user: ${userToSignIn.email}`);
        } catch (walletInitError) {
          console.error('Error initializing wallet to zero:', walletInitError);
          // Continue even if wallet initialization fails - getWalletBalance will return 0 anyway
        }
        
        // Clear form
        setName('');
        setEmail('');
        setPassword('');
        
        // Navigate to home page - welcome deal modal will appear there
        // The modal will show on the home page (ExploreScreen) for new users
        navigation.replace('Main');
      } else {
        // API returned null or invalid response
        setErrorMessage('Failed to create account. Please try again.');
      }
    } catch (error) {
      // Handle API errors - extract message from error object
      const errorMsg = error.message || error.toString() || '';
      const lowerErrorMsg = errorMsg.toLowerCase();
      
      // Check for account already exists scenarios - check this FIRST
      if (lowerErrorMsg.includes('409') || 
          lowerErrorMsg.includes('already exists') || 
          lowerErrorMsg.includes('already exist') ||
          lowerErrorMsg.includes('duplicate') || 
          lowerErrorMsg.includes('email already') ||
          lowerErrorMsg.includes('user already') ||
          lowerErrorMsg.includes('account already') ||
          lowerErrorMsg.includes('email is already') ||
          lowerErrorMsg.includes('email has been') ||
          (error.status === 409)) {
        setErrorMessage('Account already exists. Please sign in instead.');
      } 
      // Check for role errors - handle separately
      else if (lowerErrorMsg.includes('role') && (lowerErrorMsg.includes('invalid') || lowerErrorMsg.includes('blank') || lowerErrorMsg.includes('required') || lowerErrorMsg.includes('must') || lowerErrorMsg.includes('allowed'))) {
        // This shouldn't happen since we send default role 'Guest', but handle it just in case
        setErrorMessage('Registration error. Please try again or contact support.');
      }
      // Check for password strength/validation errors - check this SECOND
      else if (lowerErrorMsg.includes('password') || 
               lowerErrorMsg.includes('weak') ||
               lowerErrorMsg.includes('strength') ||
               lowerErrorMsg.includes('too short') ||
               lowerErrorMsg.includes('too long') ||
               lowerErrorMsg.includes('must contain') ||
               lowerErrorMsg.includes('at least') ||
               lowerErrorMsg.includes('minimum') ||
               (lowerErrorMsg.includes('required') && lowerErrorMsg.includes('password'))) {
        // Extract and show the password error message from backend
        let passwordErrorMsg = errorMsg;
        
        // Clean up the error message
        passwordErrorMsg = passwordErrorMsg
          .replace(/^Error:\s*/i, '')
          .replace(/^Authentication failed\s*\(\d+\)/i, '')
          .trim();
        
        // If the error message is meaningful, use it; otherwise provide a helpful default
        if (passwordErrorMsg.length > 0 && !passwordErrorMsg.includes('Error:')) {
          setErrorMessage(passwordErrorMsg);
        } else {
          setErrorMessage('Password does not meet requirements. Please use a stronger password.');
        }
      } 
      // Check for email validation errors
      else if (lowerErrorMsg.includes('email') && (lowerErrorMsg.includes('invalid') || lowerErrorMsg.includes('format'))) {
        setErrorMessage('Please enter a valid email address.');
      }
      // Check for general validation errors
      else if (lowerErrorMsg.includes('400') || lowerErrorMsg.includes('validation') ||
               lowerErrorMsg.includes('invalid')) {
        // Only show generic validation error if it's not an account exists or password error
        if (!lowerErrorMsg.includes('already') && !lowerErrorMsg.includes('exist') && !lowerErrorMsg.includes('duplicate') &&
            !lowerErrorMsg.includes('password')) {
          // Try to extract the actual error message from backend
          let validationErrorMsg = errorMsg
            .replace(/^Error:\s*/i, '')
            .replace(/^Authentication failed\s*\(\d+\)/i, '')
            .trim();
          
          if (validationErrorMsg.length > 0 && !validationErrorMsg.includes('Error:')) {
            setErrorMessage(validationErrorMsg);
          } else {
            setErrorMessage('Please check your information and try again.');
          }
        } else if (lowerErrorMsg.includes('already') || lowerErrorMsg.includes('exist') || lowerErrorMsg.includes('duplicate')) {
          setErrorMessage('Account already exists. Please sign in instead.');
        }
      } 
      // Check for network errors
      else if (lowerErrorMsg.includes('network') || lowerErrorMsg.includes('failed to fetch') ||
               lowerErrorMsg.includes('connection') || lowerErrorMsg.includes('timeout')) {
        setErrorMessage('Network error. Please check your connection and try again.');
      } 
      // For all other errors, show the backend error message if available
      else {
        // Check if backend error message indicates account exists
        if (lowerErrorMsg.includes('already') || lowerErrorMsg.includes('exist') || lowerErrorMsg.includes('duplicate')) {
          setErrorMessage('Account already exists. Please sign in instead.');
        } else {
          // Show backend error message if available and meaningful
          let displayMsg = 'Failed to create account. Please try again.';
          
          if (errorMsg && errorMsg.length > 0) {
            // Clean up error message
            const cleanMsg = errorMsg
              .replace(/^Error:\s*/i, '')
              .replace(/^Authentication failed\s*\(\d+\)/i, '')
              .trim();
            
            if (cleanMsg.length > 0 && cleanMsg !== errorMsg && !cleanMsg.includes('Error:')) {
              displayMsg = cleanMsg;
            } else if (cleanMsg.length > 0 && !errorMsg.includes('Error:')) {
              displayMsg = cleanMsg;
            }
          }
          
          setErrorMessage(displayMsg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await promptAsync();
    } catch (error) {
      Alert.alert('Error', 'Google sign up failed. Please try again.');
    }
  };

  const handleAppleSignUp = async () => {
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
        Alert.alert('Error', 'Apple sign up failed. Please try again.');
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
          <Text style={styles.title}>Sign Up</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errorMessage && styles.inputError]}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrorMessage(''); // Clear error when user types
              }}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

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
            style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
            onPress={handleEmailSignUp}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
            activeOpacity={0.8}
            disabled={!request}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignUp}
            activeOpacity={0.8}
            disabled={Platform.OS !== 'ios'}
          >
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>

        {/* Welcome Deal Modal is now shown on the home page (ExploreScreen) */}
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
  signUpButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  signUpButtonText: {
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
    opacity: Platform.OS === 'ios' ? 1 : 0.5,
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
  signUpButtonDisabled: {
    opacity: 0.6,
  },
});

