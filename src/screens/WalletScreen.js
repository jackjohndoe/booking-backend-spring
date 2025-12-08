import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getWalletBalance, 
  getTransactions, 
  addFunds, 
  makePayment,
  validateUserTransactions
} from '../utils/wallet';
import { hybridWalletService } from '../services/hybridService';
import { addBooking, addHostBooking } from '../utils/bookings';
import { notifyPaymentMade } from '../utils/notifications';
import { getUserProfile } from '../utils/userStorage';
import { sendBookingEmails } from '../utils/emailService';
import { notifyHostNewBooking, notifyHostWalletFunded } from '../utils/notifications';
import { createEscrowPayment } from '../utils/escrow';
import { initializePayment, verifyPayment, createVirtualAccount } from '../services/flutterwaveService';
import { walletService } from '../services/walletService';
import PlatformWebView from '../components/PlatformWebView';

export default function WalletScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const { apartment, totalAmount, checkInDate, checkOutDate, numberOfDays, numberOfGuests, isPayment } = route.params || {};

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Bank Transfer');
  const [withdrawAccountDetails, setWithdrawAccountDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Flutterwave wallet funding states
  const [paymentMethod, setPaymentMethod] = useState(null); // 'bank_transfer' or 'card'
  const [paymentReference, setPaymentReference] = useState(null);
  const [bankAccountDetails, setBankAccountDetails] = useState(null);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [showFlutterwaveWebView, setShowFlutterwaveWebView] = useState(false);
  const [flutterwaveUrl, setFlutterwaveUrl] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'pending', 'verifying', 'success', 'failed'
  
  // Track last comprehensive sync time
  const lastComprehensiveSyncRef = useRef(0);

  const loadWalletData = useCallback(async () => {
    try {
      if (!user || !user.email) {
        setBalance(0);
        setTransactions([]);
        setRefreshing(false);
        return;
      }
      
      // PERSISTENCE: Wallet data is loaded using user email from AsyncStorage
      // This ensures wallet balance and transactions persist across sign-out/sign-in
      // Same persistence model as profile data - data is tied to user email, not session
      const normalizedEmail = user.email.toLowerCase().trim();
      
      // Always sync with Flutterwave first to catch any pending payments
      // This ensures real-time updates when payments are processed via webhooks
      // Sync is non-blocking - if it fails, we still load wallet data
      try {
        console.log('🔄 Syncing with Flutterwave before loading wallet data...');
        const syncResult = await walletService.syncBalance();
        if (syncResult) {
          console.log('✅ Flutterwave sync completed');
        } else {
          console.log('⚠️ Sync returned null (may be processing) - continuing with wallet load');
        }
      } catch (syncError) {
        // Sync errors are non-fatal - continue loading wallet data
        console.warn('⚠️ Sync error (non-fatal, continuing):', syncError.message || 'Unknown error');
      }
      
      // Always load both balance and transactions to ensure real-time updates
      // Data is automatically loaded from API which reflects Flutterwave webhook updates
      const [walletBalance, walletTransactions] = await Promise.all([
        hybridWalletService.getBalance(normalizedEmail),
        hybridWalletService.getTransactions(normalizedEmail),
      ]);
      
      // Ensure balance is a valid number (handle NaN)
      const validBalance = (walletBalance !== null && walletBalance !== undefined && !isNaN(parseFloat(walletBalance))) 
        ? parseFloat(walletBalance) 
        : 0;
      setBalance(validBalance);
      
      // Sort transactions by date (most recent first) - ensures all transactions are visible
      // Also validate that all transactions have proper references and remove duplicates
      // Filter out Welcome Bonus Voucher transactions
      const sortedTransactions = Array.isArray(walletTransactions) 
        ? (() => {
            // First, filter out Welcome Bonus Voucher transactions and invalid transactions
            // Only show Flutterwave transactions (funding, withdrawals, payments)
            const filteredTransactions = walletTransactions.filter(txn => {
              const description = (txn.description || '').toLowerCase();
              
              // Remove Welcome Bonus Voucher transactions
              if (description.includes('welcome bonus') || description.includes('welcome bonus voucher')) {
                return false;
              }
              
              // Only allow valid transaction types: Flutterwave funding, withdrawals, payments
              const validTypes = ['deposit', 'top_up', 'withdrawal', 'payment', 'transfer_in', 'transfer_out'];
              const txnType = (txn.type || '').toLowerCase();
              
              // If transaction has a Flutterwave reference, it's valid
              const hasFlutterwaveRef = !!(txn.flutterwaveTxRef || 
                (txn.reference && (txn.reference.includes('@') || txn.reference.includes('wallet_topup') || txn.reference.includes('listing'))) ||
                (txn.paymentReference && (txn.paymentReference.includes('@') || txn.paymentReference.includes('wallet_topup') || txn.paymentReference.includes('listing'))));
              
              // If transaction is a valid type OR has Flutterwave reference, keep it
              if (!validTypes.includes(txnType) && !hasFlutterwaveRef) {
                // Check if it's a booking payment (should have bookingPayment flag or propertyTitle)
                const isBookingPayment = txn.bookingPayment || txn.propertyTitle;
                if (!isBookingPayment) {
                  return false; // Remove invalid transactions
                }
              }
              
              return true;
            });
            
            // Then, ensure all transactions have proper references
            const withReferences = filteredTransactions.map(txn => {
              // Ensure transaction has proper reference for tracking
              if (!txn.reference && !txn.paymentReference && !txn.id) {
                console.warn(`⚠️ Transaction missing reference:`, txn);
                // Generate a reference if missing
                txn.reference = txn.reference || txn.paymentReference || `txn_${txn.type}_${txn.amount}_${txn.timestamp || Date.now()}`;
                txn.paymentReference = txn.paymentReference || txn.reference;
              }
              return txn;
            });
            
            // Remove duplicates by checking all reference fields
            const uniqueMap = new Map();
            withReferences.forEach(txn => {
              // Try multiple keys for deduplication
              const keys = [
                txn.id,
                txn.reference,
                txn.paymentReference,
                txn.flutterwaveTxRef,
                `${txn.type}_${txn.amount}_${txn.timestamp || txn.date || txn.createdAt}`
              ].filter(Boolean);
              
              // Use first available unique key
              let added = false;
              for (const key of keys) {
                if (!uniqueMap.has(key)) {
                  uniqueMap.set(key, txn);
                  added = true;
                  break;
                }
              }
              
              // If all keys are duplicates, skip this transaction
              if (!added) {
                console.warn(`⚠️ Skipping duplicate transaction:`, txn);
              }
            });
            
            // Convert back to array and sort
            return Array.from(uniqueMap.values()).sort((a, b) => {
              const dateA = new Date(a.timestamp || a.date || a.createdAt || 0);
              const dateB = new Date(b.timestamp || b.date || b.createdAt || 0);
              return dateB - dateA; // Most recent first
            });
          })()
        : [];
      
      console.log(`✅ Loaded ${sortedTransactions.length} transactions for wallet display`);
      if (sortedTransactions.length > 0) {
        console.log(`📋 Transaction references: ${sortedTransactions.slice(0, 5).map(t => t.reference || t.paymentReference || t.id || 'N/A').join(', ')}${sortedTransactions.length > 5 ? '...' : ''}`);
      }
      
      setTransactions(sortedTransactions);
      
      // Log transaction count for debugging
      if (sortedTransactions.length > 0) {
        console.log(`✅ Wallet synced: Balance: ₦${validBalance.toLocaleString()}, Transactions: ${sortedTransactions.length}`);
      }
      console.log(`✅ Wallet data loaded EXCLUSIVELY for ${normalizedEmail} - Balance: ₦${walletBalance || 0}, Transactions: ${sortedTransactions.length}`);
      console.log('✅ Wallet data persists across sign-out/sign-in (stored with user email key)');
      console.log('✅ All transactions are EXCLUSIVE to this user account');
      
      // Log transaction details for debugging
      if (sortedTransactions.length > 0) {
        console.log('📋 Transaction types:', sortedTransactions.map(t => `${t.type}: ${t.description || 'N/A'}`).join(', '));
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      // Fallback to local storage - FRONTEND PRESERVED
      try {
        const fallbackBalance = await getWalletBalance(user.email);
        const fallbackTransactions = await getTransactions(user.email);
        setBalance(fallbackBalance || 0);
        const sortedFallback = Array.isArray(fallbackTransactions)
          ? fallbackTransactions.sort((a, b) => {
              const dateA = new Date(a.timestamp || a.date || 0);
              const dateB = new Date(b.timestamp || b.date || 0);
              return dateB - dateA;
            })
          : [];
        setTransactions(sortedFallback);
        console.log('Using fallback wallet data - Balance:', fallbackBalance, 'Transactions:', sortedFallback.length);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setBalance(0);
        setTransactions([]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Load wallet data when screen comes into focus (real-time updates)
  // This ensures transactions are always visible regardless of how wallet is accessed
  useFocusEffect(
    useCallback(() => {
      // Always reload wallet data when screen comes into focus
      // This ensures real-time updates whether accessed via navigation or payment options
      loadWalletData();
      
      // Validate transactions to ensure they're exclusive to this user (non-blocking)
      if (user && user.email) {
        // Defer validation to not block UI
        setTimeout(() => {
          validateUserTransactions(user.email).catch(err => {
            console.error('Error validating transactions:', err);
          });
        }, 0);
      }
    }, [loadWalletData, user])
  );

  // Also load wallet data on initial mount
  useEffect(() => {
    loadWalletData();
    
    // Comprehensive sync on mount to catch all missing transactions
    const syncAllOnMount = async () => {
      if (user && user.email) {
        try {
          console.log('🔄 Comprehensive sync on mount to fetch all transactions...');
          
          // Do comprehensive sync which forces backend to fetch from Flutterwave
          // and syncs to local storage
          await loadWalletData(true); // forceSync = true
        } catch (error) {
          console.warn('⚠️ Error syncing all transactions on mount (non-fatal):', error.message);
          // Still load wallet data even if sync fails
          await loadWalletData(false);
        }
      }
    };
    
    // Delay sync to allow initial load to complete
    setTimeout(syncAllOnMount, 2000);
  }, []);

  // Automatic real-time balance and transaction syncing
  useEffect(() => {
    if (!user || !user.email) {
      return;
    }

    let previousBalance = 0;
    let syncAttempts = 0;

    // Sync immediately on mount and sync with Flutterwave to catch pending payments
    const initialSync = async () => {
      try {
        console.log('🔄 Initial wallet sync with Flutterwave...');
        await walletService.syncBalance();
        await loadWalletData();
        // Update previous balance after initial load
        const currentBal = await hybridWalletService.getBalance(user.email);
        previousBalance = currentBal || 0;
      } catch (error) {
        console.error('Error in initial sync:', error);
        // Still load data even if sync fails
        await loadWalletData();
      }
    };
    initialSync();

    // Determine sync interval based on whether payment is pending
    // If payment reference exists, sync more aggressively (every 1 second)
    // Otherwise, sync every 2 seconds for normal operation
    const getSyncInterval = () => {
      return (paymentReference && paymentStatus !== 'success') ? 1000 : 2000;
    };
    
    // Set up interval to sync for real-time updates
    // More frequent syncing ensures payments appear immediately when processed via webhook
    const syncInterval = setInterval(async () => {
      try {
        syncAttempts++;
        if (syncAttempts % 10 === 0) {
          console.log(`🔄 Auto-syncing wallet (${syncAttempts} syncs completed)...`);
        }
        
        // First verify pending transactions (this processes them)
        try {
          if (syncAttempts % 5 === 0) { // Every 5 syncs, verify pending transactions
            await walletService.verifyPendingTransactions();
          }
        } catch (verifyError) {
          console.warn('⚠️ Pending transactions verification failed (non-fatal):', verifyError.message);
        }
        
        // Sync with Flutterwave first to catch any pending payments processed via webhook
        // Sync is non-blocking - if it fails, we still load wallet data
        try {
          await walletService.syncBalance();
        } catch (syncError) {
          // Sync errors are non-fatal - continue with wallet load
          if (syncError.status !== 500) {
            console.warn('⚠️ Sync error (non-fatal):', syncError.message || 'Unknown error');
          }
        }
        
        // Do comprehensive sync more frequently to ensure ALL transactions are fetched and verified in real-time
        // Every 30 seconds when payment pending, every 2 minutes otherwise
        const timeSinceLastComprehensiveSync = Date.now() - (lastComprehensiveSyncRef.current || 0);
        const comprehensiveSyncInterval = (paymentReference && paymentStatus !== 'success') ? 30000 : 120000; // 30s or 2min
        const shouldDoComprehensiveSync = timeSinceLastComprehensiveSync >= comprehensiveSyncInterval;
        
        if (shouldDoComprehensiveSync) {
          try {
            console.log('🔄 Performing comprehensive transaction sync (REAL-TIME - fetches ALL transactions from Flutterwave)...');
            if (user && user.email) {
              // Comprehensive sync fetches ALL transactions from Flutterwave and verifies pending ones
              await hybridWalletService.syncAllTransactions(user.email);
              lastComprehensiveSyncRef.current = Date.now();
              console.log('✅ Comprehensive sync completed - ALL transactions fetched and verified');
            }
          } catch (syncAllError) {
            console.warn('⚠️ Comprehensive sync error (non-fatal):', syncAllError.message);
          }
        }
        
        // Load fresh data from API (this will work even if sync failed)
        await loadWalletData();
        
        // Check if balance changed (payment was processed via webhook or verification)
        const currentBal = await hybridWalletService.getBalance(user.email);
        if (currentBal !== previousBalance && currentBal > previousBalance) {
          const balanceIncrease = currentBal - previousBalance;
          console.log(`✅ Balance updated! Previous: ₦${previousBalance.toLocaleString()}, New: ₦${currentBal.toLocaleString()} (+₦${balanceIncrease.toLocaleString()})`);
          previousBalance = currentBal;
          
          // Update balance state immediately
          setBalance(currentBal);
          
          // If payment was pending and balance increased, update payment status
          if (paymentReference && paymentStatus !== 'success') {
            setPaymentStatus('success');
            setVerifyingPayment(false);
            Alert.alert('Payment Received', `Your payment has been processed! New balance: ₦${currentBal.toLocaleString()}`);
          }
        } else if (currentBal !== previousBalance) {
          // Balance changed but not increased (shouldn't happen, but update anyway)
          previousBalance = currentBal;
          setBalance(currentBal);
        }
      } catch (error) {
        console.error('Error in auto-sync:', error);
        // Continue syncing even if one attempt fails
      }
    }, getSyncInterval()); // Dynamic sync interval based on payment status

    // Cleanup interval on unmount
    return () => {
      clearInterval(syncInterval);
    };
  }, [user, loadWalletData, paymentReference, paymentStatus]);

  // Function to fund wallet after payment verification
  const fundWalletAfterVerification = useCallback(async (amount, reference) => {
    try {
      console.log(`💰 Funding wallet with ₦${amount.toLocaleString()}...`);
      
      // Top up wallet with Flutterwave reference
      let result;
      let retryCount = 0;
      const maxRetries = 5;
      
      // Retry funding wallet multiple times to ensure backend processes the payment
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 Attempting to fund wallet (attempt ${retryCount + 1}/${maxRetries})...`);
          result = await hybridWalletService.fundWallet(
            user.email, 
            amount, 
            paymentMethod === 'bank_transfer' ? 'Flutterwave Bank Transfer' : 'Flutterwave Card',
            null,
            null,
            reference
          );
          
          // If we got a result, break out of retry loop
          if (result && (result.balance !== undefined || result.amount !== undefined)) {
            console.log('✅ Wallet funding successful:', result);
            break;
          }
        } catch (fundError) {
          console.error(`❌ Error funding wallet (attempt ${retryCount + 1}):`, fundError);
        }
        
        retryCount++;
        
        // Wait before retrying (exponential backoff)
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // CRITICAL: Immediately sync balance and reload wallet data after funding
      console.log('🔄 Syncing balance immediately after funding...');
      await walletService.syncBalance();
      await loadWalletData();
      
      // Force immediate reload to show updated balance
      const immediateBalance = await hybridWalletService.getBalance(user.email);
      setBalance(immediateBalance || 0);
      
      // Get updated balance
      let updatedBalance = result?.balance || result?.amount || immediateBalance;
      if (!updatedBalance || isNaN(parseFloat(updatedBalance))) {
        updatedBalance = await hybridWalletService.getBalance(user.email);
      }
      
      // Ensure balance is a valid number
      const validBalance = isNaN(parseFloat(updatedBalance)) ? 0 : parseFloat(updatedBalance);
      
      // Update balance immediately
      setBalance(validBalance);
      console.log(`✅ Balance updated immediately! New balance: ₦${validBalance.toLocaleString()}`);
      
      // Reload wallet data multiple times to ensure transaction is visible
      // More frequent reloads for real-time updates
      const reloadIntervals = [500, 1500, 3000, 6000];
      for (const interval of reloadIntervals) {
        setTimeout(async () => {
          try {
            await walletService.syncBalance();
            await loadWalletData();
            const currentBal = await hybridWalletService.getBalance(user.email);
            if (currentBal && currentBal > 0) {
              setBalance(currentBal);
            }
          } catch (reloadError) {
            console.warn('Error in delayed reload:', reloadError);
          }
        }, interval);
      }
      
      Alert.alert('Success', `₦${amount.toLocaleString()} has been added to your wallet!`);
    } catch (error) {
      console.error('Error funding wallet after verification:', error);
      // Still try to sync balance and reload
      try {
        await walletService.syncBalance();
        await loadWalletData();
        const currentBalance = await hybridWalletService.getBalance(user.email);
        setBalance(currentBalance || 0);
        
        if (currentBalance && currentBalance > 0) {
          Alert.alert('Success', `Your wallet has been funded! New balance: ₦${currentBalance.toLocaleString()}`);
        }
      } catch (syncError) {
        console.error('Error syncing balance:', syncError);
      }
    }
  }, [user, paymentMethod, loadWalletData, walletService]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Force comprehensive sync on pull-to-refresh
    loadWalletData(true);
  }, [loadWalletData]);

  // Manual sync all transactions handler
  const handleSyncAllTransactions = useCallback(async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to sync transactions.');
      return;
    }

    try {
      setLoading(true);
      setSyncing(true);
      
      // First, try to verify specific known transaction patterns
      // This handles cases where transactions exist in Flutterwave but weren't fetched by email
      const normalizedEmail = user.email.toLowerCase().trim();
      const emailPattern = normalizedEmail.replace(/[^a-z0-9]/g, '_');
      
      // Get local transactions to extract potential txRefs
      const localTransactions = await getTransactions(normalizedEmail);
      const txRefsToVerify = new Set();
      
      // Extract potential Flutterwave txRefs from local transactions
      localTransactions.forEach(txn => {
        // Look for Flutterwave transaction references
        if (txn.flutterwaveTxRef && !txn.flutterwaveTxRef.startsWith('txn_')) {
          txRefsToVerify.add(txn.flutterwaveTxRef);
        }
        if (txn.reference && !txn.reference.startsWith('txn_') && (txn.reference.includes('@') || txn.reference.includes('wallet_topup') || txn.reference.includes('listing'))) {
          txRefsToVerify.add(txn.reference);
        }
        if (txn.paymentReference && !txn.paymentReference.startsWith('txn_') && (txn.paymentReference.includes('@') || txn.paymentReference.includes('wallet_topup') || txn.paymentReference.includes('listing'))) {
          txRefsToVerify.add(txn.paymentReference);
        }
      });
      
      // Try to verify these transactions directly
      if (txRefsToVerify.size > 0) {
        console.log(`🔄 Attempting to verify ${txRefsToVerify.size} transactions directly by txRef...`);
        try {
          const verifyResult = await walletService.verifyMultipleTransactions(Array.from(txRefsToVerify));
          if (verifyResult && verifyResult.processed > 0) {
            console.log(`✅ Verified ${verifyResult.processed} transactions directly by txRef`);
            // Wait a bit for backend to process
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (verifyError) {
          console.warn('⚠️ Error verifying transactions by txRef (non-fatal):', verifyError.message);
        }
      }
      
      Alert.alert(
        'Syncing Transactions',
        'Please wait while we sync all your transactions from Flutterwave. This may take a few moments...',
        [{ text: 'OK' }]
      );

      console.log('🔄 Manual sync triggered by user...');
      const syncResult = await hybridWalletService.syncAllTransactions(user.email);

      if (syncResult) {
        console.log(`✅ Sync completed: ${syncResult.transactions.length} transactions, Balance: ₦${syncResult.balance.toLocaleString()}`);
        
        // Update UI with synced data
        setBalance(syncResult.balance || 0);
        setTransactions(syncResult.transactions || []);

        Alert.alert(
          'Sync Complete',
          `Successfully synced ${syncResult.transactions.length} transaction(s).\n\nYour wallet balance: ₦${(syncResult.balance || 0).toLocaleString()}`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Sync returned no results');
      }
    } catch (error) {
      console.error('❌ Error syncing all transactions:', error);
      Alert.alert(
        'Sync Error',
        `Failed to sync transactions: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user]);

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return dateString;
    }
  };

  const handleFundWallet = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to fund your wallet.');
      return;
    }
    if (!fundAmount || isNaN(parseFloat(fundAmount)) || parseFloat(fundAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    const amount = parseFloat(fundAmount);
    const MAX_WALLET_BALANCE = 10000000; // 10 million naira
    const FLUTTERWAVE_MAX_AMOUNT = 500000; // Flutterwave v3 API limit per virtual account
    
    // Check Flutterwave v3 API limit for bank transfers
    if (paymentMethod === 'bank_transfer' && amount > FLUTTERWAVE_MAX_AMOUNT) {
      Alert.alert(
        'Amount Limit Exceeded',
        `Bank transfer funding is limited to ₦${FLUTTERWAVE_MAX_AMOUNT.toLocaleString()} per transaction.\n\n` +
        `You entered: ₦${amount.toLocaleString()}\n\n` +
        `Please either:\n` +
        `• Enter an amount of ₦${FLUTTERWAVE_MAX_AMOUNT.toLocaleString()} or less\n` +
        `• Use card payment for larger amounts`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Use Card Payment', onPress: () => setPaymentMethod('card') }
        ]
      );
      return;
    }
    
    // Check if top-up would exceed maximum wallet balance
    const currentBalance = balance || 0;
    const newBalance = currentBalance + amount;
    
    if (newBalance > MAX_WALLET_BALANCE) {
      const maxAllowed = MAX_WALLET_BALANCE - currentBalance;
      Alert.alert(
        'Maximum Balance Exceeded',
        `Your wallet balance cannot exceed ₦${MAX_WALLET_BALANCE.toLocaleString()}.\n\n` +
        `Current balance: ₦${currentBalance.toLocaleString()}\n` +
        `Maximum top-up allowed: ₦${maxAllowed.toLocaleString()}\n\n` +
        `Please enter an amount of ₦${maxAllowed.toLocaleString()} or less.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if user is logged in
    if (!user || !user.email) {
      Alert.alert(
        'Authentication Required',
        'Please sign in to fund your wallet.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Sign In', 
            onPress: () => navigation.navigate('SignIn')
          }
        ]
      );
      return;
    }

    setLoading(true);
    setPaymentStatus('pending');
    try {
      // For bank transfers, create a dynamic virtual account
      if (paymentMethod === 'bank_transfer') {
        try {
          const userName = user?.name || 'Guest';
          const txRef = `wallet_topup_${user.email}_${Date.now()}`;
          
          // Create dynamic virtual account for this transaction
          console.log('🔄 Calling createVirtualAccount with:', { email: user.email, amount, name: userName, txRef });
          const account = await createVirtualAccount(
            user.email,
            amount,
            userName,
            txRef
          );
          
          console.log('✅ createVirtualAccount returned:', account);
          console.log('✅ Account type:', typeof account);
          console.log('✅ Account keys:', account ? Object.keys(account) : 'N/A');
          console.log('✅ account.accountNumber:', account?.accountNumber);
          console.log('✅ account.bankName:', account?.bankName);
          console.log('✅ account.accountName:', account?.accountName);
          
          if (!account) {
            console.error('❌ Account is null or undefined');
            throw new Error('Failed to create virtual account. No account data received.');
          }
          
          // Handle both camelCase and snake_case formats
          const accountNumber = account.accountNumber || account.account_number;
          const bankName = account.bankName || account.bank_name || 'Virtual Bank';
          const accountName = account.accountName || account.account_name || 'Nigerian Apartments Leasing Ltd';
          
          if (!accountNumber) {
            console.error('❌ Account number is missing. Account object:', JSON.stringify(account, null, 2));
            throw new Error('Failed to create virtual account. Account number not found in response.');
          }
          
          // Store account details and payment reference
          // CRITICAL: Update all states immediately for real-time display
          const accountDetails = {
            account_number: accountNumber,
            bank: bankName,
            account_name: accountName,
          };
          
          console.log('✅ Account details prepared:', accountDetails);
          console.log('✅ Account Number:', accountDetails.account_number);
          console.log('✅ Bank:', accountDetails.bank);
          console.log('✅ Account Name:', accountDetails.account_name);
          
          // IMPORTANT: Set account details FIRST before showing modal
          // This ensures data is ready when modal opens
          // React will batch these state updates automatically
          setBankAccountDetails(accountDetails);
          setPaymentReference(txRef);
          setPaymentStatus('pending');
          
          // Clear loading and close fund modal
          setLoading(false);
          setShowFundModal(false);
          
          // Show account details modal - React will render on next cycle
          setShowAccountDetails(true);
          
          console.log('✅ UI states updated - account details should display NOW');
          console.log('✅ Modal visible state set to:', true);
          console.log('✅ Account details ready:', !!accountDetails.account_number);
          console.log('✅ bankAccountDetails will be:', accountDetails);
        } catch (accountError) {
          console.error('❌ Error creating virtual account:', accountError);
          console.error('❌ Error type:', typeof accountError);
          console.error('❌ Error message:', accountError?.message);
          console.error('❌ Error stack:', accountError?.stack);
          
          // Always clear loading state on error
          setLoading(false);
          setShowFundModal(false);
          
          // Provide helpful error message
          let errorMessage = accountError?.message || 'Failed to create virtual account.';
          
          // Check for Flutterwave amount limit error
          if (errorMessage.includes('500,000') || errorMessage.includes('500000') || errorMessage.includes('amount should be between')) {
            errorMessage = `Bank transfer is limited to ₦500,000 per transaction.\n\nYou entered: ₦${amount.toLocaleString()}\n\nPlease use card payment for larger amounts or split into multiple transactions.`;
          } else if (errorMessage.includes('Flutterwave') || errorMessage.includes('credentials') || errorMessage.includes('401') || errorMessage.includes('500')) {
            errorMessage = 'Payment service is temporarily unavailable. Please use card payment instead, or try again later.';
          }
          
          Alert.alert(
            'Payment Service Unavailable',
            errorMessage + '\n\nYou can still fund your wallet using card payment.',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Use Card Payment', onPress: () => {
                setPaymentMethod('card');
              }}
            ]
          );
          return;
        }
      } 
      // For card payments, use regular payment initialization
      else {
        const userName = user?.name || 'Guest';
        const userPhone = user?.phoneNumber || null;
        
        const paymentInit = await initializePayment(
          amount,
          user.email,
          userName,
          userPhone,
          'card', // Payment method: 'card'
          null, // Reference will be generated
          {
            type: 'wallet_topup',
            amount: amount,
          }
        );

        if (!paymentInit) {
          throw new Error('Payment initialization failed. No response received from payment service.');
        }

        // Store payment reference
        setPaymentReference(paymentInit.reference);

        // Handle card payment response (authorization_url)
        if (paymentInit.authorization_url) {
          setFlutterwaveUrl(paymentInit.authorization_url);
          setShowFlutterwaveWebView(true);
          setShowFundModal(false);
        } else {
          throw new Error('Invalid payment response. Please try again or contact support.');
        }
      }
    } catch (error) {
      console.error('Error initializing Flutterwave payment:', error);
      setPaymentStatus('failed');
      const errorMessage = error.message || 'Failed to initialize payment. Please try again.';
      Alert.alert('Payment Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentReference) {
      Alert.alert('Error', 'Payment reference not found');
      return;
    }

    setVerifyingPayment(true);
    setPaymentStatus('verifying');
    try {
      const verification = await verifyPayment(paymentReference);
      
      if (verification.status !== 'success' && verification.status !== 'completed') {
        setPaymentStatus('failed');
        Alert.alert('Payment Verification Failed', 'Payment has not been confirmed yet. Please ensure you have completed the payment and try again.');
        return;
      }

      // Payment verified successfully - top up wallet
      const amount = parseFloat(fundAmount);
      setPaymentStatus('success');
      
      console.log(`✅ Payment verified successfully. Reference: ${paymentReference}, Amount: ₦${amount.toLocaleString()}`);
      
      // Top up wallet with Flutterwave reference - this should trigger backend to process webhook
      let result;
      let retryCount = 0;
      const maxRetries = 5;
      
      // Retry funding wallet multiple times to ensure backend processes the payment
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 Attempting to fund wallet (attempt ${retryCount + 1}/${maxRetries})...`);
          result = await hybridWalletService.fundWallet(
            user.email, 
            amount, 
            paymentMethod === 'bank_transfer' ? 'Flutterwave Bank Transfer' : 'Flutterwave Card',
            null,
            null,
            paymentReference // Pass Flutterwave reference as 6th parameter
          );
          
          // If we got a result, break out of retry loop
          if (result && (result.balance !== undefined || result.amount !== undefined)) {
            console.log('✅ Wallet funding successful:', result);
            break;
          }
        } catch (fundError) {
          console.error(`❌ Error funding wallet (attempt ${retryCount + 1}):`, fundError);
        }
        
        retryCount++;
        
        // Wait before retrying (exponential backoff)
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // If funding still failed, try to sync balance - webhook may have already updated it
      if (!result || (!result.balance && !result.amount)) {
        console.log('🔄 Funding failed, attempting to sync balance as payment may have been processed via webhook...');
        try {
          await walletService.syncBalance();
        } catch (syncError) {
          console.warn('⚠️ Sync failed (non-fatal):', syncError);
        }
      }
      
      // Get updated balance - ensure it's a valid number
      let updatedBalance = result?.balance || result?.amount;
      if (!updatedBalance || isNaN(parseFloat(updatedBalance))) {
        // If result doesn't have balance, fetch it directly
        console.log('🔄 Fetching updated balance from API...');
        updatedBalance = await hybridWalletService.getBalance(user.email);
        
        // If balance is still 0, wait a bit and try again (webhook might be processing)
        if (updatedBalance === 0) {
          console.log('⏳ Balance is still 0, waiting for webhook processing...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try syncing and fetching again
          try {
            await walletService.syncBalance();
          } catch (syncError) {
            console.warn('⚠️ Sync failed (non-fatal):', syncError);
          }
          updatedBalance = await hybridWalletService.getBalance(user.email);
        }
      }
      
      // Ensure balance is a valid number
      const validBalance = isNaN(parseFloat(updatedBalance)) ? 0 : parseFloat(updatedBalance);
      
      // Only update if balance actually increased
      if (validBalance > balance) {
        console.log(`✅ Balance updated! Previous: ₦${balance.toLocaleString()}, New: ₦${validBalance.toLocaleString()}`);
        setBalance(validBalance);
      } else if (validBalance === balance && balance === 0) {
        console.warn('⚠️ Balance is still 0 after payment verification. Backend may still be processing webhook.');
        // Still set the balance to ensure UI is updated
        setBalance(validBalance);
      } else {
        setBalance(validBalance);
      }
      
      // Close all modals and reset state
      setShowAccountDetails(false);
      setShowFlutterwaveWebView(false);
      setFundAmount('');
      setPaymentMethod(null);
      setPaymentReference(null);
      setBankAccountDetails(null);
      setFlutterwaveUrl(null);
      setPaymentStatus(null);
      
      // Immediately reload wallet data to show new transaction and balance
      await walletService.syncBalance();
      await loadWalletData();
      
      // Retry loading after short delays to ensure backend has processed the transaction
      // This ensures transactions are recorded in real-time
      setTimeout(async () => {
        console.log('🔄 Reloading wallet data to ensure transaction is recorded...');
        await walletService.syncBalance();
        await loadWalletData();
      }, 1000);
      
      setTimeout(async () => {
        console.log('🔄 Second reload to catch any delayed transactions...');
        await walletService.syncBalance();
        await loadWalletData();
      }, 3000);
      
      setTimeout(async () => {
        console.log('🔄 Final reload to ensure all transactions are visible...');
        await walletService.syncBalance();
        await loadWalletData();
      }, 6000);
      
      Alert.alert('Success', `₦${amount.toLocaleString()} has been added to your wallet!`);
    } catch (error) {
      console.error('Error verifying payment:', error);
      setPaymentStatus('failed');
      
      // If verification fails but payment was made, try to sync balance
      console.log('🔄 Payment verification had issues, attempting to sync balance...');
      try {
        await walletService.syncBalance();
        await loadWalletData();
        const currentBalance = await hybridWalletService.getBalance(user.email);
        if (currentBalance > balance) {
          Alert.alert(
            'Payment Processed', 
            `Your payment has been processed! Your wallet balance has been updated to ₦${currentBalance.toLocaleString()}.`
          );
          setBalance(currentBalance);
          return;
        }
      } catch (syncError) {
        console.error('Error syncing balance:', syncError);
      }
      
      const errorMessage = error.message || 'Payment verification failed. Please try again.';
      Alert.alert('Verification Error', errorMessage);
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleFlutterwaveNavigationStateChange = (navState) => {
    const { url } = navState;
    
    // Check if payment was successful (Flutterwave redirects to callback URL)
    if (url.includes('callback') || url.includes('success') || url.includes('reference=')) {
      // Extract reference from URL if present
      const refMatch = url.match(/reference=([^&]+)/);
      if (refMatch) {
        const ref = refMatch[1];
        setPaymentReference(ref);
        // Auto-verify after a short delay to allow Flutterwave to process
        setTimeout(() => {
          handleVerifyPayment();
        }, 2000);
      } else if (paymentReference) {
        setTimeout(() => {
          handleVerifyPayment();
        }, 2000);
      }
    }
  };

  const handleMakePayment = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to make a payment.');
      return;
    }
    // Handle general payment - supports payments up to ₦10,000,000 (10 million naira)
    // No maximum payment limit - only validates amount is positive and user has sufficient balance
    if (!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!paymentDescription || !paymentDescription.trim()) {
      Alert.alert('Error', 'Please enter a payment description');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (balance < amount) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance (${formatPrice(balance)}) is less than the required amount (${formatPrice(amount)}). Please fund your wallet first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Fund Wallet', 
            onPress: () => {
              setShowPaymentModal(false);
              setShowFundModal(true);
            }
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Confirm Payment',
      `Pay ${formatPrice(amount)} for ${paymentDescription}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await hybridWalletService.makePayment(
                user.email,
                amount,
                paymentDescription.trim()
              );
              const newBalance = result.balance || result.amount || await hybridWalletService.getBalance(user.email);
              setBalance(newBalance);
              setPaymentAmount('');
              setPaymentDescription('');
              setShowPaymentModal(false);
              
              // Immediately reload wallet data to show new transaction in real-time
              await loadWalletData();
              
              Alert.alert('Success', `Payment of ${formatPrice(amount)} has been processed.`);
            } catch (error) {
              console.error('Error processing payment:', error);
              Alert.alert('Error', error.message || 'Failed to process payment. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleWithdraw = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'You must be logged in to withdraw funds.');
      return;
    }
    if (!withdrawAmount || isNaN(parseFloat(withdrawAmount)) || parseFloat(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (balance < amount) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance (${formatPrice(balance)}) is less than the withdrawal amount (${formatPrice(amount)}).`
      );
      return;
    }

    if (amount < 1000) {
      Alert.alert('Error', 'Minimum withdrawal amount is ₦1,000');
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${formatPrice(amount)} via ${withdrawMethod}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await hybridWalletService.withdrawFunds(
                user.email,
                amount,
                withdrawMethod,
                withdrawAccountDetails.trim()
              );
              const newBalance = result.balance || result.amount || await hybridWalletService.getBalance(user.email);
              setBalance(newBalance);
              setWithdrawAmount('');
              setWithdrawAccountDetails('');
              setShowWithdrawModal(false);
              
              // Immediately reload wallet data to show new transaction in real-time
              await loadWalletData();
              
              Alert.alert(
                'Withdrawal Initiated',
                `Your withdrawal of ${formatPrice(amount)} has been initiated via Flutterwave. The transfer will be processed and you'll receive a notification when it's completed.`
              );
            } catch (error) {
              console.error('Error processing withdrawal:', error);
              Alert.alert('Error', error.message || 'Failed to process withdrawal. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePayNow = async () => {
    if (!isPayment || !apartment || !totalAmount) {
      Alert.alert('Error', 'No payment information available');
      return;
    }

    if (balance < totalAmount) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance (${formatPrice(balance)}) is less than the required amount (${formatPrice(totalAmount)}). Please fund your wallet first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Fund Wallet', 
            onPress: () => setShowFundModal(true) 
          },
        ]
      );
      return;
    }

    // Validate dates first
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      
      if (checkIn >= checkOut) {
        Alert.alert(
          'Invalid Dates',
          'Check-out date must be after check-in date. Please select valid dates.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    // Check for date conflicts before showing payment confirmation
    if (checkInDate && checkOutDate && apartment) {
      try {
        const { checkDateConflict } = await import('../utils/bookings');
        const hostEmail = apartment.createdBy || apartment.hostEmail;
        
        if (hostEmail) {
          const conflictResult = await checkDateConflict(
            apartment.id || apartment._id,
            hostEmail,
            checkInDate,
            checkOutDate
          );
          
          if (conflictResult.hasConflict) {
            Alert.alert(
              'Unavailable',
              'Unavailable - choose another date please\n\nThis apartment is unavailable for the selected dates. Please choose another date.',
              [{ text: 'OK' }]
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error checking date conflict:', error);
        // Continue with payment if check fails (don't block user)
      }
    }

    Alert.alert(
      'Confirm Payment',
      `Pay ${formatPrice(totalAmount)} for ${apartment.title || 'this apartment'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setLoading(true);
            try {
              if (!user || !user.email) {
                Alert.alert('Error', 'You must be logged in to make a payment.');
                setLoading(false);
                return;
              }

              // Check wallet balance again before processing
              const currentBalance = await hybridWalletService.getBalance(user.email);
              if (currentBalance < totalAmount) {
                Alert.alert(
                  'Insufficient Balance',
                  `Your wallet balance (${formatPrice(currentBalance)}) is less than the required amount (${formatPrice(totalAmount)}). Please fund your wallet first.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Fund Wallet', 
                      onPress: () => setShowFundModal(true) 
                    },
                  ]
                );
                setLoading(false);
                return;
              }

              // Deduct amount from wallet first
              const paymentResult = await hybridWalletService.makePayment(
                user.email,
                totalAmount,
                `Apartment Rent - ${apartment.title || 'Apartment'}`,
                null
              );
              const newBalance = paymentResult.balance || paymentResult.amount || await hybridWalletService.getBalance(user.email);
              setBalance(newBalance);

              // Initialize Flutterwave payment for escrow tracking
              let flutterwaveReference = null;
              try {
                const userName = user?.name || 'Guest';
                const userPhone = user?.phoneNumber || null;
                
                const paymentInit = await initializePayment(
                  totalAmount,
                  user.email,
                  userName,
                  userPhone,
                  'card', // Use card method for booking payments
                  null, // Reference will be generated
                  {
                    type: 'booking_payment',
                    bookingId: null, // Will be set after booking is created
                    apartmentId: apartment?.id || apartment?._id,
                    apartmentTitle: apartment?.title,
                    checkInDate,
                    checkOutDate,
                    numberOfDays,
                    numberOfGuests,
                  }
                );
                flutterwaveReference = paymentInit?.reference || null;
                console.log('✅ Flutterwave payment initialized for booking:', flutterwaveReference);
              } catch (flutterwaveError) {
                console.error('Error initializing Flutterwave payment:', flutterwaveError);
                // Continue with booking even if Flutterwave initialization fails
                // The wallet payment has already been deducted
              }

              // Payment is complete - send emails IMMEDIATELY
              // Get user profile information for host email
              let userName = user?.name || 'Guest';
              let userPhone = null;
              let userAddress = null;
              try {
                const userProfile = await getUserProfile(user.email);
                if (userProfile) {
                  if (userProfile.name) userName = userProfile.name;
                  userPhone = userProfile.whatsappNumber || null;
                  userAddress = userProfile.address || null;
                }
              } catch (profileError) {
                console.log('Could not load user profile for email:', profileError);
              }

              // Add booking with ESCROW status
              const bookingData = {
                apartmentId: apartment.id,
                title: apartment.title,
                location: apartment.location,
                image: apartment.image,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                numberOfDays: numberOfDays || 1,
                numberOfGuests: numberOfGuests,
                totalAmount: totalAmount,
                paymentMethod: 'Wallet (Flutterwave)',
                status: 'In Escrow', // Payment goes to escrow
                bookingDate: new Date().toISOString(),
                hostEmail: apartment?.hostEmail || apartment?.createdBy || null,
                hostName: apartment?.hostName || null,
                paymentReference: flutterwaveReference,
              };
              
              // Create booking first to get booking ID
              let savedBooking;
              try {
                savedBooking = await hybridBookingService.createBooking(user.email, bookingData);
                if (!savedBooking || !savedBooking.id) {
                  savedBooking = await addBooking(user.email, bookingData);
                }
              } catch (error) {
                console.error('Error saving booking:', error);
                savedBooking = await addBooking(user.email, bookingData);
              }

              const bookingId = savedBooking?.id || bookingData.id || `booking_${Date.now()}`;
              
              // Update booking data with the actual booking ID
              const completeBookingData = {
                ...bookingData,
                id: bookingId,
              };
              
              // Send booking confirmation emails AFTER booking is created with complete data
              // Get host email - will be normalized later for wallet funding
              let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
              if (user.email) {
                console.log('📧 Sending booking confirmation emails after booking creation...');
                try {
                  // Import individual email functions to ensure proper receipt emails
                  const { sendUserBookingConfirmationEmail, sendHostBookingNotificationEmail } = await import('../utils/emailService');
                  
                  // Send guest email with booking details and receipt
                  await sendUserBookingConfirmationEmail(
                    user.email,
                    completeBookingData,
                    userName,
                    null, // No top-up for wallet payments (wallet already has funds)
                    null  // No new balance to show
                  );
                  console.log('✅ Guest booking confirmation email sent');
                  
                  // Send host email with booking details and receipt
                  if (hostEmail) {
                    await sendHostBookingNotificationEmail(
                      hostEmail,
                      completeBookingData,
                      userName,
                      user.email,
                      userPhone,
                      userAddress
                    );
                    console.log('✅ Host booking notification email sent');
                  }
                } catch (emailError) {
                  console.error('❌ Error sending booking confirmation emails:', emailError);
                  // Don't block payment flow if email fails
                }
              }
              
              // Create escrow payment with Flutterwave reference (funds held in escrow, not released to host yet)
              try {
                await createEscrowPayment(
                  bookingId,
                  user.email,
                  hostEmail,
                  totalAmount || 0,
                  {
                    paymentMethod: 'Wallet (Flutterwave)',
                    paymentReference: flutterwaveReference,
                    checkInDate: checkInDate || new Date().toISOString().split('T')[0],
                    checkOutDate: checkOutDate || null,
                    apartmentTitle: apartment?.title || 'Apartment',
                  }
                );
                console.log(`✅ Escrow payment created for booking ${bookingId} with Flutterwave reference: ${flutterwaveReference}`);
              } catch (escrowError) {
                console.error('Error creating escrow payment:', escrowError);
              }
              
              // CRITICAL: Also store booking for the host (even if host is not signed in)
              // Normalize host email BEFORE storing to ensure consistent retrieval
              if (hostEmail) {
                try {
                  // Normalize host email to ensure it matches when host views bookings
                  const normalizedHostEmail = hostEmail.toLowerCase().trim();
                  
                  // Calculate host payment amount (after fees)
                  const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
                  const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
                  const totalServiceFees = cleaningFee + serviceFee;
                  const hostPaymentAmount = Math.max(0, (totalAmount || 0) - totalServiceFees);
                  
                  const hostBookingData = {
                    ...bookingData,
                    id: bookingId,
                    userEmail: user.email,
                    userName: userName,
                    guestEmail: user.email, // Explicitly set guest email
                    guestName: userName,    // Explicitly set guest name
                    hostEmail: normalizedHostEmail, // Store normalized email
                    hostPaymentAmount: hostPaymentAmount, // Amount host receives
                  };
                  
                  console.log(`💾 Storing host booking for: ${normalizedHostEmail} (original: ${hostEmail})`);
                  await addHostBooking(normalizedHostEmail, hostBookingData);
                  console.log(`✅ Booking stored for host: ${normalizedHostEmail}`);
                } catch (hostBookingError) {
                  console.error('❌ Error storing booking for host:', hostBookingError);
                  console.error('❌ Error details:', hostBookingError.message, hostBookingError.stack);
                  // Don't block payment flow if host booking storage fails
                }
              } else {
                console.warn('⚠️ Cannot store host booking: Host email not found');
                console.warn('Apartment data:', { hostEmail: apartment?.hostEmail, createdBy: apartment?.createdBy });
              }

              // NOTE: Funds are NOT released to host wallet yet
              // They will be released when user confirms payment on check-in date
              
              // Calculate fees and host payment amount
              // Fees set to 0 until changed
              const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
              const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
              const totalPaid = totalAmount || 0;
              const totalServiceFees = cleaningFee + serviceFee;
              const hostPaymentAmount = Math.max(0, totalPaid - totalServiceFees);
              
              console.log(`💰 Payment of ₦${totalPaid.toLocaleString()} held in escrow for booking ${bookingId}`);
              
              console.log(`💰 Payment Breakdown:
                Total Paid: ₦${totalPaid.toLocaleString()}
                Cleaning Fee: -₦${cleaningFee.toLocaleString()}
                Service Fee: -₦${serviceFee.toLocaleString()}
                Host Receives: ₦${hostPaymentAmount.toLocaleString()}`);
              
              // CRITICAL: Normalize host email to ensure consistent identification
              // hostEmail already declared above - just normalize it now
              if (hostEmail) {
                hostEmail = hostEmail.toLowerCase().trim();
              }
              
              console.log(`🏠 Host wallet funding - Email: ${hostEmail}, Amount: ₦${hostPaymentAmount.toLocaleString()}, Apartment: ${apartment?.title || 'N/A'}`);
              
              // userName already loaded above with user profile information
              // No need to reload - use the existing userName variable
              
              if (hostEmail && hostPaymentAmount > 0) {
                try {
                  // Fund host's wallet (email is already normalized)
                  const result = await hybridWalletService.fundWallet(
                    hostEmail,
                    hostPaymentAmount,
                    `Booking Payment - ${apartment?.title || 'Apartment'}`,
                    userName, // Sender name
                    user.email // Sender email
                  );
                  
                  // Verify the funding was successful
                  const hostBalance = await hybridWalletService.getBalance(hostEmail);
                  console.log(`✅ Host wallet funded successfully! Email: ${hostEmail}, Amount added: ₦${hostPaymentAmount.toLocaleString()}, New balance: ₦${hostBalance.toLocaleString()}`);
                  
                  // Notify host about wallet funding in real-time
                  await notifyHostWalletFunded(
                    hostEmail,
                    hostPaymentAmount,
                    apartment?.title || 'Apartment'
                  );
                } catch (hostWalletError) {
                  console.error(`❌ Error funding host wallet for ${hostEmail}:`, hostWalletError);
                  console.error('Error details:', hostWalletError.message || hostWalletError);
                  // Don't block payment flow if host wallet funding fails, but log the error
                  Alert.alert('Warning', `Payment successful, but host wallet funding encountered an issue. Please contact support.`);
                }
              } else {
                if (!hostEmail) {
                  console.warn('⚠️ Cannot fund host wallet: Host email not found in apartment data');
                  console.warn('Apartment data:', { hostEmail: apartment?.hostEmail, createdBy: apartment?.createdBy });
                }
                if (hostPaymentAmount <= 0) {
                  console.warn(`⚠️ Host payment amount is invalid: ₦${hostPaymentAmount.toLocaleString()}`);
                }
              }
              
              // Notify host about new booking in real-time with all booking details
              if (hostEmail) {
                try {
                  await notifyHostNewBooking(
                    hostEmail,
                    userName,
                    apartment?.title || 'Apartment',
                    checkInDate,
                    checkOutDate,
                    numberOfGuests,
                    numberOfDays || 1,
                    totalAmount,
                    'Wallet'
                  );
                  console.log(`✅ Host notification sent to ${hostEmail} about new booking with full details`);
                } catch (notificationError) {
                  console.error('Error sending host booking notification:', notificationError);
                  // Don't block payment flow if notification fails
                }
              }

              // Notify payment
              await notifyPaymentMade(totalAmount, apartment.title || 'Apartment');

              // Immediately reload wallet data to show new transaction in real-time
              await loadWalletData();

              Alert.alert(
                'Payment Successful!',
                `Your payment of ${formatPrice(totalAmount)} has been processed.`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.navigate('ExploreMain');
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error processing payment:', error);
              Alert.alert('Error', error.message || 'Failed to process payment. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncAllTransactions}
          disabled={loading}
        >
          <MaterialIcons name="sync" size={24} color={loading ? "#999" : "#000"} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFD700']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{formatPrice(balance)}</Text>
          {balance === 0 && (
            <Text style={styles.balanceHint}>
              If you just made a payment, it may take a few moments to appear
            </Text>
          )}
        </View>


        {/* Action Buttons - Above Transaction History */}
        {/* Show different buttons based on how wallet was accessed */}
        <View style={styles.actionsSection}>
          {/* Fund Wallet - Always shown */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowFundModal(true)}
            disabled={loading}
          >
            <MaterialIcons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.actionButtonText}>Fund Wallet</Text>
          </TouchableOpacity>

          {/* If accessed directly from navigation (not via payment): Show Withdraw */}
          {!isPayment && (
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={() => setShowWithdrawModal(true)}
              disabled={loading || balance <= 0}
            >
              <MaterialIcons name="arrow-downward" size={24} color="#FFF" />
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Info (if coming from payment) */}
        {isPayment && apartment && totalAmount && (
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentInfoTitle}>Pending Payment</Text>
            <Text style={styles.paymentInfoApartment}>{apartment.title}</Text>
            <Text style={styles.paymentInfoAmount}>Amount: {formatPrice(totalAmount)}</Text>
            {balance < totalAmount && (
              <Text style={styles.insufficientBalance}>
                Insufficient balance. Fund wallet to continue.
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.payNowButtonStandalone,
                (balance < totalAmount || loading) && styles.actionButtonDisabled,
              ]}
              onPress={handlePayNow}
              disabled={balance < totalAmount || loading}
            >
              <MaterialIcons name="payment" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          
          {transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="receipt" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Your transaction history will appear here
              </Text>
            </View>
          ) : (
            transactions.map((transaction, index) => {
              // Generate a truly unique key using multiple fields + index to prevent duplicates
              const uniqueKey = transaction.id 
                ? `${transaction.id}_${index}` 
                : transaction.reference 
                ? `${transaction.reference}_${index}` 
                : transaction.paymentReference 
                ? `${transaction.paymentReference}_${index}` 
                : transaction.flutterwaveTxRef 
                ? `${transaction.flutterwaveTxRef}_${index}` 
                : `txn_${transaction.type}_${transaction.amount}_${transaction.timestamp || transaction.date || index}_${index}`;
              
              return (
                <View key={uniqueKey} style={styles.transactionCard}>
                <View style={styles.transactionIconContainer}>
                  <MaterialIcons
                    name={
                      transaction.type === 'deposit' 
                        ? 'arrow-downward' 
                        : transaction.type === 'withdrawal'
                        ? 'arrow-upward'
                        : transaction.type === 'transfer_in'
                        ? 'arrow-downward'
                        : transaction.type === 'transfer_out'
                        ? 'arrow-upward'
                        : 'payment'
                    }
                    size={24}
                    color={
                      transaction.type === 'deposit' 
                        ? '#4CAF50' 
                        : transaction.type === 'withdrawal'
                        ? '#FF9800'
                        : transaction.type === 'transfer_in'
                        ? '#4CAF50'
                        : transaction.type === 'transfer_out'
                        ? '#2196F3'
                        : '#F44336'
                    }
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description || 'Transaction'}
                  </Text>
                  {/* Show sender name if available (for deposits, transfers, and booking payments) */}
                  {(transaction.senderName || (transaction.type === 'transfer_in' && transaction.senderEmail)) && (
                    <Text style={styles.transactionSubtext}>
                      From: {transaction.senderName || transaction.senderEmail || 'Unknown'}
                    </Text>
                  )}
                  {/* Show additional details for booking payments */}
                  {transaction.bookingPayment && transaction.propertyTitle && (
                    <Text style={styles.transactionSubtext}>
                      Property: {transaction.propertyTitle}
                    </Text>
                  )}
                  {transaction.method && transaction.type === 'deposit' && !transaction.bookingPayment && !transaction.senderName && (
                    <Text style={styles.transactionSubtext}>
                      Method: {transaction.method}
                    </Text>
                  )}
                  {transaction.paymentReference && (
                    <Text style={styles.transactionSubtext}>
                      Ref: {transaction.paymentReference}
                    </Text>
                  )}
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.date || transaction.timestamp)}
                  </Text>
                  {transaction.status === 'pending' && (
                    <Text style={styles.pendingStatus}>Pending</Text>
                  )}
                  {transaction.status === 'completed' && (
                    <Text style={styles.completedStatus}>Completed</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'deposit' || transaction.type === 'transfer_in'
                      ? styles.depositAmount
                      : transaction.type === 'withdrawal'
                      ? styles.withdrawalAmount
                      : transaction.type === 'transfer_out'
                      ? styles.transferOutAmount
                      : styles.paymentAmount,
                  ]}
                >
                  {(transaction.type === 'deposit' || transaction.type === 'transfer_in') ? '+' : '-'}
                  {formatPrice(transaction.amount)}
                </Text>
              </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Fund Wallet Modal */}
      <Modal
        visible={showFundModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fund Wallet</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFundModal(false);
                  setFundAmount('');
                  setPaymentMethod(null);
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Enter Amount (₦)</Text>
              <Text style={styles.modalHint}>
                Maximum wallet balance: ₦10,000,000
                {balance > 0 && (
                  <Text style={styles.balanceHint}>
                    {'\n'}Current balance: ₦{balance.toLocaleString()}
                    {'\n'}Maximum top-up: ₦{(10000000 - balance).toLocaleString()}
                  </Text>
                )}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                value={fundAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^\d.]/g, '');
                  setFundAmount(cleaned);
                }}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />

              <View style={styles.quickAmounts}>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setFundAmount('5000')}
                >
                  <Text style={styles.quickAmountText}>₦5,000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setFundAmount('10000')}
                >
                  <Text style={styles.quickAmountText}>₦10,000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setFundAmount('50000')}
                >
                  <Text style={styles.quickAmountText}>₦50,000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setFundAmount('100000')}
                >
                  <Text style={styles.quickAmountText}>₦100,000</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Payment Method</Text>
              <View style={styles.methodButtons}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    paymentMethod === 'bank_transfer' && styles.methodButtonActive,
                  ]}
                  onPress={() => setPaymentMethod('bank_transfer')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      paymentMethod === 'bank_transfer' && styles.methodButtonTextActive,
                    ]}
                  >
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    paymentMethod === 'card' && styles.methodButtonActive,
                  ]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      paymentMethod === 'card' && styles.methodButtonTextActive,
                    ]}
                  >
                    Card Payment
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, loading && styles.modalButtonDisabled]}
                onPress={handleFundWallet}
                disabled={loading || !paymentMethod}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Processing...' : 'Continue to Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Make Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentDescription('');
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Amount (₦)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                value={paymentAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^\d.]/g, '');
                  setPaymentAmount(cleaned);
                }}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="e.g., Service payment, Subscription fee"
                value={paymentDescription}
                onChangeText={setPaymentDescription}
                multiline
                numberOfLines={3}
                placeholderTextColor="#999"
              />

              <Text style={styles.modalHint}>
                Available Balance: {formatPrice(balance)}
              </Text>

              <TouchableOpacity
                style={[styles.modalButton, styles.paymentButton, (loading || !paymentAmount || !paymentDescription.trim()) && styles.modalButtonDisabled]}
                onPress={handleMakePayment}
                disabled={loading || !paymentAmount || !paymentDescription.trim()}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Processing...' : 'Pay Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Flutterwave Bank Transfer Account Details Modal */}
      <Modal
        visible={showAccountDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAccountDetails(false);
          setPaymentReference(null);
          setBankAccountDetails(null);
          setPaymentStatus(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAccountDetails(false);
                  setPaymentReference(null);
                  setBankAccountDetails(null);
                  setPaymentStatus(null);
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Transfer to this account:</Text>
              
              {bankAccountDetails ? (
                <View style={styles.accountDetailsCard}>
                  {/* Account Number - Most Important - Display Prominently */}
                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Account Number:</Text>
                    <Text style={[styles.accountDetailValue, styles.accountNumberHighlight]} selectable>
                      {bankAccountDetails.account_number}
                    </Text>
                  </View>
                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Bank:</Text>
                    <Text style={styles.accountDetailValue}>
                      {bankAccountDetails.bank}
                    </Text>
                  </View>
                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Account Name:</Text>
                    <Text style={styles.accountDetailValue}>
                      {bankAccountDetails.account_name}
                    </Text>
                  </View>
                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Amount:</Text>
                    <Text style={[styles.accountDetailValue, styles.amountValue]}>
                      {formatPrice(parseFloat(fundAmount))}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="small" color="#FFD700" />
                  <Text style={styles.loadingText}>Loading account details...</Text>
                </View>
              )}

              {paymentReference && (
                <View style={styles.referenceCard}>
                  <Text style={styles.referenceLabel}>Payment Reference:</Text>
                  <Text style={styles.referenceValue} selectable>
                    {paymentReference}
                  </Text>
                </View>
              )}

              <Text style={styles.modalHint}>
                Please transfer the exact amount to the account above. Your payment will be verified automatically and your wallet will be funded immediately once the transfer is detected.
              </Text>

              {verifyingPayment && (
                <View style={styles.verifyingContainer}>
                  <ActivityIndicator size="small" color="#FFD700" />
                  <Text style={styles.verifyingText}>Verifying payment...</Text>
                </View>
              )}

              {paymentStatus === 'success' && (
                <View style={styles.successContainer}>
                  <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                  <Text style={styles.successText}>Payment verified! Your wallet has been funded.</Text>
                </View>
              )}

              {paymentStatus === 'failed' && (
                <Text style={styles.errorText}>
                  Payment verification is in progress. If your transfer was successful, your wallet will be updated automatically.
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Flutterwave Card Payment WebView Modal */}
      <Modal
        visible={showFlutterwaveWebView}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowFlutterwaveWebView(false);
          setFlutterwaveUrl(null);
          setPaymentReference(null);
          setPaymentStatus(null);
        }}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowFlutterwaveWebView(false);
                setFlutterwaveUrl(null);
                setPaymentReference(null);
                setPaymentStatus(null);
              }}
            >
              <MaterialIcons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.webViewHeaderTitle}>Complete Payment</Text>
            <View style={{ width: 24 }} />
          </View>
          {flutterwaveUrl && (
            <PlatformWebView
              source={{ uri: flutterwaveUrl }}
              onNavigationStateChange={handleFlutterwaveNavigationStateChange}
              style={styles.webView}
            />
          )}
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Funds</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                  setWithdrawAccountDetails('');
                  setWithdrawMethod('Bank Transfer');
                }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Amount (₦)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                value={withdrawAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^\d.]/g, '');
                  setWithdrawAmount(cleaned);
                }}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />

              <Text style={styles.modalLabel}>Withdrawal Method</Text>
              <View style={styles.methodButtons}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    withdrawMethod === 'Bank Transfer' && styles.methodButtonActive,
                  ]}
                  onPress={() => setWithdrawMethod('Bank Transfer')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      withdrawMethod === 'Bank Transfer' && styles.methodButtonTextActive,
                    ]}
                  >
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    withdrawMethod === 'Mobile Money' && styles.methodButtonActive,
                  ]}
                  onPress={() => setWithdrawMethod('Mobile Money')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      withdrawMethod === 'Mobile Money' && styles.methodButtonTextActive,
                    ]}
                  >
                    Mobile Money
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>
                Account Details {withdrawMethod === 'Bank Transfer' ? '(Account Number)' : '(Phone Number)'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={withdrawMethod === 'Bank Transfer' ? 'Enter account number' : 'Enter phone number'}
                value={withdrawAccountDetails}
                onChangeText={setWithdrawAccountDetails}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />

              <Text style={styles.modalHint}>
                Available Balance: {formatPrice(balance)} | Minimum: ₦1,000
              </Text>

              <TouchableOpacity
                style={[styles.modalButton, styles.withdrawButton, (loading || !withdrawAmount || !withdrawAccountDetails.trim()) && styles.modalButtonDisabled]}
                onPress={handleWithdraw}
                disabled={loading || !withdrawAmount || !withdrawAccountDetails.trim()}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Processing...' : 'Withdraw'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  placeholder: {
    width: 40,
  },
  syncButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#FFD700',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  balanceHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paymentInfoCard: {
    backgroundColor: '#FFF9E6',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  paymentInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  paymentInfoApartment: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  paymentInfoAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  insufficientBalance: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  paymentButton: {
    backgroundColor: '#4CAF50',
  },
  withdrawButton: {
    backgroundColor: '#2196F3',
  },
  payNowButtonStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  actionButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  depositAmount: {
    color: '#4CAF50',
  },
  paymentAmount: {
    color: '#F44336',
  },
  withdrawalAmount: {
    color: '#FF9800',
  },
  transferOutAmount: {
    color: '#2196F3',
  },
  transactionSubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  pendingStatus: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 4,
  },
  completedStatus: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    gap: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#333',
    backgroundColor: '#F5F5F5',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 8,
  },
  balanceHint: {
    fontSize: 11,
    color: '#888',
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  methodButtonTextActive: {
    color: '#333',
  },
  accountDetailsCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  accountDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  accountDetailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  accountNumberHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: '#FFF9E6',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 18,
    color: '#FFD700',
  },
  referenceCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#B0D4FF',
  },
  referenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 12,
  },
  verifyingText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 8,
    textAlign: 'center',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  webViewHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  webView: {
    flex: 1,
  },
  virtualAccountCard: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B0D4FF',
  },
  virtualAccountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  virtualAccountTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  virtualAccountSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  virtualAccountDetails: {
    gap: 8,
  },
  virtualAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  virtualAccountLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  virtualAccountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  loadingCard: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorCard: {
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  errorButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
