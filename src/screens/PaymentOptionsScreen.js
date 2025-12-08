import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function PaymentOptionsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apartment, checkInDate, checkOutDate, numberOfDays, numberOfGuests, totalAmount } = route.params || {};
  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const paymentOptions = [
    {
      id: 'wallet',
      title: 'Pay with Wallet',
      icon: 'account-balance-wallet',
      description: 'Get amazing discounts when you pay with wallet (via Flutterwave)',
    },
    {
      id: 'card',
      title: 'Pay with Card',
      icon: 'credit-card',
      description: 'Credit or debit card (via Flutterwave)',
    },
    {
      id: 'transfer',
      title: 'Pay with Transfer',
      icon: 'account-balance',
      description: 'Bank transfer payment (via Flutterwave)',
    },
  ];

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
    
    // Navigate immediately when "Pay with Card" is selected
    if (methodId === 'card') {
      navigation.navigate('CardPayment', {
        apartment,
        totalAmount,
        checkInDate,
        checkOutDate,
        numberOfDays,
        numberOfGuests,
        paymentProvider: 'flutterwave',
      });
    }
  };

  const handleContinue = () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    // Navigate based on selected payment method
    if (selectedPaymentMethod === 'card') {
      navigation.navigate('CardPayment', {
        apartment,
        totalAmount,
        checkInDate,
        checkOutDate,
        numberOfDays,
        numberOfGuests,
        paymentProvider: 'flutterwave',
      });
    } else if (selectedPaymentMethod === 'transfer') {
      navigation.navigate('TransferPayment', {
        apartment,
        checkInDate,
        checkOutDate,
        numberOfDays,
        numberOfGuests,
        totalAmount,
        paymentProvider: 'flutterwave',
      });
    } else if (selectedPaymentMethod === 'wallet') {
      // Navigate to wallet screen with payment details
      navigation.navigate('Wallet', {
        apartment,
        checkInDate,
        checkOutDate,
        numberOfDays,
        numberOfGuests,
        totalAmount,
        isPayment: true,
      });
    }
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
        <Text style={styles.headerTitle}>Payment Options</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Total Amount Display */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>{formatPrice(totalAmount || 0)}</Text>
        </View>

        {/* Payment Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          
          {paymentOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.paymentOption,
                selectedPaymentMethod === option.id && styles.paymentOptionSelected
              ]}
              onPress={() => handlePaymentMethodSelect(option.id)}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionContent}>
                <View style={[
                  styles.iconContainer,
                  selectedPaymentMethod === option.id && styles.iconContainerSelected
                ]}>
                  <MaterialIcons 
                    name={option.icon} 
                    size={28} 
                    color={selectedPaymentMethod === option.id ? '#FFD700' : '#666'} 
                  />
                </View>
                <View style={styles.paymentOptionText}>
                  <Text style={[
                    styles.paymentOptionTitle,
                    selectedPaymentMethod === option.id && styles.paymentOptionTitleSelected
                  ]}>
                    {option.title}
                  </Text>
                  <Text style={styles.paymentOptionDescription}>
                    {option.description}
                  </Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedPaymentMethod === option.id && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By proceeding, you agree to the terms and conditions of payment. All payments are processed securely through Flutterwave and held in escrow until booking conditions are met.
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedPaymentMethod && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedPaymentMethod}
        >
          <Text style={[
            styles.continueButtonText,
            !selectedPaymentMethod && styles.continueButtonTextDisabled
          ]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 20,
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
  totalContainer: {
    padding: 20,
    backgroundColor: '#FFF9E6',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  paymentOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  paymentOptionSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#FFF9E6',
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#FFD700',
  },
  paymentOptionText: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentOptionTitleSelected: {
    color: '#333',
  },
  paymentOptionDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD700',
  },
  termsContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  continueButtonTextDisabled: {
    color: '#999',
  },
});

