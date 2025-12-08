import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function PaymentConfirmationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apartment, checkInDate, checkOutDate, numberOfDays, numberOfGuests } = route.params || {};

  // Safety check
  if (!apartment) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      // Handle both YYYY-MM-DD and DD/MM/YYYY formats
      let date;
      if (dateString.includes('/')) {
        // DD/MM/YYYY format
        const parts = dateString.split('/');
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        // YYYY-MM-DD format
        date = new Date(dateString);
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    } catch (error) {
      return dateString;
    }
  };

  const calculatePriceBreakdown = () => {
    // Payment calculation - supports payments up to ₦10,000,000 (10 million naira)
    // No maximum payment limit - calculates total based on daily rate and days
    const dailyRate = apartment?.price || 0; // Price is already daily rate
    const basePrice = dailyRate * numberOfDays;
    const cleaningFee = 0; // Fixed cleaning fee: ₦0 (set to 0 until changed)
    const serviceFee = 0; // Fixed service fee: ₦0 (set to 0 until changed)
    const total = basePrice + cleaningFee + serviceFee;

    return {
      basePrice,
      cleaningFee,
      serviceFee,
      total,
    };
  };

  const priceBreakdown = calculatePriceBreakdown();

  const handleConfirmAndPay = () => {
    navigation.navigate('PaymentOptions', {
      apartment,
      checkInDate,
      checkOutDate,
      numberOfDays,
      numberOfGuests: numberOfGuests || 1,
      totalAmount: priceBreakdown.total,
    });
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
        <Text style={styles.headerTitle}>Confirm and Book</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Property Card */}
        <View style={styles.propertyCard}>
          <View style={styles.propertyInfo}>
            <Text style={styles.propertyTitle}>{apartment?.title || 'Apartment'}</Text>
            <Text style={styles.propertyType}>
              Entire apartment in {apartment?.location || 'Nigeria'}, Nigeria
            </Text>
            <Text style={styles.hostName}>Hosted by John D.</Text>
          </View>
          <Image
            source={{ uri: apartment?.image || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800' }}
            style={styles.propertyImage}
          />
        </View>

        {/* Your Trip Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your trip</Text>
          
          <View style={styles.tripRow}>
            <View style={styles.tripItem}>
              <Text style={styles.tripLabel}>Dates</Text>
              <Text style={styles.tripValue}>
                {checkInDate && checkOutDate
                  ? `${formatDate(checkInDate)} – ${formatDate(checkOutDate)}`
                  : 'Not selected'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tripRow}>
            <View style={styles.tripItem}>
              <Text style={styles.tripLabel}>Guests</Text>
              <Text style={styles.tripValue}>
                {numberOfGuests || 1} {numberOfGuests === 1 ? 'guest' : 'guests'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price details</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {formatPrice(apartment?.price || 0)}/day × {numberOfDays} {numberOfDays === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.priceValue}>{formatPrice(priceBreakdown.basePrice)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Cleaning fee</Text>
            <Text style={styles.priceValue}>{formatPrice(priceBreakdown.cleaningFee)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service fee</Text>
            <Text style={styles.priceValue}>{formatPrice(priceBreakdown.serviceFee)}</Text>
          </View>

          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total (NGN)</Text>
            <Text style={styles.totalValue}>{formatPrice(priceBreakdown.total)}</Text>
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By selecting the button below, I agree to the Host's House Rules, Ground rules for guests, and the Guest Refund Policy. I also agree to pay the total amount shown, which includes Service Fees.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm and Pay Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmAndPay}
        >
          <Text style={styles.confirmButtonText}>Confirm and Pay</Text>
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
  propertyCard: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  propertyInfo: {
    flex: 1,
    marginRight: 12,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  propertyType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  hostName: {
    fontSize: 14,
    color: '#666',
  },
  propertyImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripItem: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#333',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 16,
    color: '#333',
  },
  priceValue: {
    fontSize: 16,
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  termsContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
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
  confirmButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

