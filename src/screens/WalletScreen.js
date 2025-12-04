import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getWalletBalance, 
  getTransactions, 
  addFunds, 
  makePayment 
} from '../utils/wallet';
import { hybridWalletService } from '../services/hybridService';
import { addBooking, addHostBooking } from '../utils/bookings';
import { notifyPaymentMade } from '../utils/notifications';
import { getUserProfile } from '../utils/userStorage';
import { sendBookingEmails } from '../utils/emailService';
import { notifyHostNewBooking, notifyHostWalletFunded } from '../utils/notifications';

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
      
      // Always load both balance and transactions to ensure real-time updates
      // Data is automatically loaded from user-specific AsyncStorage keys
      const [walletBalance, walletTransactions] = await Promise.all([
        hybridWalletService.getBalance(normalizedEmail),
        hybridWalletService.getTransactions(normalizedEmail),
      ]);
      
      setBalance(walletBalance || 0);
      
      // Sort transactions by date (most recent first) - ensures all transactions are visible
      const sortedTransactions = Array.isArray(walletTransactions) 
        ? walletTransactions.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date || 0);
            const dateB = new Date(b.timestamp || b.date || 0);
            return dateB - dateA; // Most recent first
          })
        : [];
      
      setTransactions(sortedTransactions);
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
        const { getWalletBalance, getTransactions } = await import('../utils/wallet');
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
      
      // Validate transactions to ensure they're exclusive to this user
      if (user && user.email) {
        import('../utils/wallet').then(({ validateUserTransactions }) => {
          validateUserTransactions(user.email).catch(err => {
            console.error('Error validating transactions:', err);
          });
        }).catch(err => {
          console.error('Error importing wallet utils:', err);
        });
      }
    }, [loadWalletData, user])
  );

  // Also load wallet data on initial mount
  useEffect(() => {
    loadWalletData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWalletData();
  }, [loadWalletData]);

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

    const amount = parseFloat(fundAmount);
    const MAX_WALLET_BALANCE = 10000000; // 10 million naira
    
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

    setLoading(true);
    try {
      const result = await hybridWalletService.fundWallet(user.email, amount);
      const updatedBalance = result.balance || result.amount || await hybridWalletService.getBalance(user.email);
      setBalance(updatedBalance);
      setFundAmount('');
      setShowFundModal(false);
      
      // Immediately reload wallet data to show new transaction in real-time
      await loadWalletData();
      
      Alert.alert('Success', `₦${amount.toLocaleString()} has been added to your wallet!`);
    } catch (error) {
      console.error('Error funding wallet:', error);
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to fund wallet. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
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
                'Withdrawal Request Submitted',
                `Your withdrawal request of ${formatPrice(amount)} has been submitted. It will be processed within 1-3 business days.`
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
              const result = await hybridWalletService.makePayment(
                user.email,
                totalAmount,
                `Apartment Rent - ${apartment.title || 'Apartment'}`,
                null
              );
              const newBalance = result.balance || result.amount || await hybridWalletService.getBalance(user.email);
              setBalance(newBalance);

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

              // Add booking
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
                paymentMethod: 'Wallet',
                status: 'Confirmed',
                bookingDate: new Date().toISOString(),
                hostEmail: apartment?.hostEmail || apartment?.createdBy || null,
                hostName: apartment?.hostName || null,
              };
              
              // Send booking confirmation emails IMMEDIATELY after payment confirmation
              // Get host email - will be normalized later for wallet funding
              let hostEmail = apartment?.hostEmail || apartment?.createdBy || null;
              if (user.email) {
                console.log('📧 Sending booking confirmation emails immediately after payment...');
                try {
                  await sendBookingEmails(
                    user.email,
                    userName,
                    hostEmail,
                    bookingData,
                    userPhone,
                    userAddress
                  );
                } catch (emailError) {
                  console.error('❌ Error sending booking confirmation emails:', emailError);
                  // Don't block payment flow if email fails
                }
              }

              await addBooking(user.email, bookingData);
              
              // CRITICAL: Also store booking for the host (even if host is not signed in)
              // This ensures hosts can see bookings when they sign in later
              if (hostEmail) {
                try {
                  const hostBookingData = {
                    ...bookingData,
                    userEmail: user.email, // Guest's email
                    userName: userName, // Guest's name
                    // Include all booking details for host
                    apartmentId: bookingData.apartmentId,
                    title: bookingData.title,
                    location: bookingData.location,
                    image: bookingData.image,
                    checkInDate: bookingData.checkInDate,
                    checkOutDate: bookingData.checkOutDate,
                    numberOfDays: bookingData.numberOfDays,
                    numberOfGuests: bookingData.numberOfGuests,
                    totalAmount: bookingData.totalAmount,
                    paymentMethod: bookingData.paymentMethod,
                    status: bookingData.status,
                    bookingDate: bookingData.bookingDate,
                    hostPaymentAmount: hostPaymentAmount, // Amount host receives (minus fees)
                  };
                  await addHostBooking(hostEmail, hostBookingData);
                  console.log(`✅ Booking stored for host: ${hostEmail}`);
                } catch (hostBookingError) {
                  console.error('Error storing booking for host:', hostBookingError);
                  // Don't block payment flow if host booking storage fails
                }
              }

              // Fund host's wallet with payment amount minus fees
              // CRITICAL: Host receives totalAmount MINUS cleaningFee (₦2,500) MINUS serviceFee (₦3,000)
              // Formula: hostPaymentAmount = totalAmount - cleaningFee - serviceFee
              // This ensures host gets the base price only, not the fees
              const cleaningFee = 2500; // Fixed cleaning fee: ₦2,500
              const serviceFee = 3000; // Fixed service fee: ₦3,000
              const totalPaid = totalAmount;
              const hostPaymentAmount = totalPaid - cleaningFee - serviceFee;
              
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
        <View style={styles.placeholder} />
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
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
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
            ))
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

              <TouchableOpacity
                style={[styles.modalButton, loading && styles.modalButtonDisabled]}
                onPress={handleFundWallet}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Processing...' : 'Add Funds'}
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
});
