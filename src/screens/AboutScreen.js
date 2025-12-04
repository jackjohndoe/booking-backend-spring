import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AboutScreen() {
  const navigation = useNavigation();

  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
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
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo/Icon Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <MaterialIcons name="home" size={64} color="#FFD700" />
          </View>
          <Text style={styles.appName}>Apartment Rental App</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appTagline}>
            Your trusted platform for finding and renting apartments
          </Text>
        </View>

        {/* App Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This App</Text>
          <Text style={styles.sectionText}>
            Welcome to our Apartment Rental App! We provide a seamless platform for 
            finding, booking, and managing apartment rentals. Whether you're looking for 
            a temporary stay or a long-term rental, we've got you covered.
          </Text>
          <Text style={styles.sectionText}>
            Our mission is to make apartment hunting easy, transparent, and convenient 
            for everyone. We connect property owners with potential renters, ensuring 
            a smooth rental experience.
          </Text>
        </View>

        {/* Guide to Use the App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Use This App</Text>
          
          <View style={styles.guideItem}>
            <MaterialIcons name="explore" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>1. Explore Apartments</Text>
              <Text style={styles.guideText}>
                Browse through our extensive collection of apartments. Use the search 
                bar to find properties in your preferred location.
              </Text>
            </View>
          </View>

          <View style={styles.guideItem}>
            <MaterialIcons name="favorite" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>2. Save Favorites</Text>
              <Text style={styles.guideText}>
                Tap the heart icon to save apartments you like. Access them anytime 
                from the Favorites tab.
              </Text>
            </View>
          </View>

          <View style={styles.guideItem}>
            <MaterialIcons name="info" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>3. View Details</Text>
              <Text style={styles.guideText}>
                Click on any apartment to see detailed information, photos, amenities, 
                and location.
              </Text>
            </View>
          </View>

          <View style={styles.guideItem}>
            <MaterialIcons name="calendar-today" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>4. Select Dates</Text>
              <Text style={styles.guideText}>
                Choose your check-in and check-out dates, and specify the number of guests.
              </Text>
            </View>
          </View>

          <View style={styles.guideItem}>
            <MaterialIcons name="payment" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>5. Make Payment</Text>
              <Text style={styles.guideText}>
                Complete your booking by choosing a payment method: card, bank transfer, 
                or wallet.
              </Text>
            </View>
          </View>

          <View style={styles.guideItem}>
            <MaterialIcons name="add-business" size={24} color="#FFD700" />
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>6. List Your Property</Text>
              <Text style={styles.guideText}>
                Property owners can list their apartments by going to Profile → Upload Listing.
              </Text>
            </View>
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms and Conditions</Text>
          
          <Text style={styles.subsectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionText}>
            By using this app, you agree to be bound by these Terms and Conditions. 
            If you do not agree with any part of these terms, you must not use the app.
          </Text>

          <Text style={styles.subsectionTitle}>2. User Responsibilities</Text>
          <Text style={styles.sectionText}>
            • You must provide accurate information when creating listings or bookings{'\n'}
            • You are responsible for maintaining the confidentiality of your account{'\n'}
            • You must be at least 18 years old to use this service{'\n'}
            • You agree not to use the app for any illegal or unauthorized purpose
          </Text>

          <Text style={styles.subsectionTitle}>3. Booking and Payment</Text>
          <Text style={styles.sectionText}>
            • All bookings are subject to availability{'\n'}
            • Payment must be completed to confirm a booking{'\n'}
            • Cancellation policies vary by property and are displayed during booking{'\n'}
            • Refunds are processed according to the property's cancellation policy
          </Text>

          <Text style={styles.subsectionTitle}>4. Property Listings</Text>
          <Text style={styles.sectionText}>
            • Property owners are responsible for accurate listing information{'\n'}
            • We reserve the right to remove listings that violate our policies{'\n'}
            • Property owners must honor confirmed bookings{'\n'}
            • False or misleading information may result in account suspension
          </Text>

          <Text style={styles.subsectionTitle}>5. Limitation of Liability</Text>
          <Text style={styles.sectionText}>
            We act as a platform connecting renters and property owners. We are not 
            responsible for disputes between users, property conditions, or any issues 
            arising from bookings. Users are encouraged to communicate directly and 
            resolve disputes amicably.
          </Text>

          <Text style={styles.subsectionTitle}>6. Modifications</Text>
          <Text style={styles.sectionText}>
            We reserve the right to modify these terms at any time. Continued use of 
            the app after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        {/* Privacy Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          
          <Text style={styles.subsectionTitle}>Information We Collect</Text>
          <Text style={styles.sectionText}>
            We collect information you provide directly, including name, email, phone 
            number, and payment information. We also collect usage data to improve 
            our services.
          </Text>

          <Text style={styles.subsectionTitle}>How We Use Your Information</Text>
          <Text style={styles.sectionText}>
            • To process bookings and payments{'\n'}
            • To communicate with you about your account and bookings{'\n'}
            • To improve our services and user experience{'\n'}
            • To send promotional materials (with your consent)
          </Text>

          <Text style={styles.subsectionTitle}>Data Security</Text>
          <Text style={styles.sectionText}>
            We implement appropriate security measures to protect your personal information. 
            However, no method of transmission over the internet is 100% secure.
          </Text>

          <Text style={styles.subsectionTitle}>Third-Party Services</Text>
          <Text style={styles.sectionText}>
            We may use third-party services for payment processing and analytics. These 
            services have their own privacy policies.
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => openLink('mailto:support@apartmentrental.com')}
          >
            <MaterialIcons name="email" size={24} color="#FFD700" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>support@apartmentrental.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => openLink('tel:+2341234567890')}
          >
            <MaterialIcons name="phone" size={24} color="#FFD700" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+234 123 456 7890</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => openLink('https://www.apartmentrental.com')}
          >
            <MaterialIcons name="language" size={24} color="#FFD700" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Website</Text>
              <Text style={styles.contactValue}>www.apartmentrental.com</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.contactItem}>
            <MaterialIcons name="location-on" size={24} color="#FFD700" />
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Address</Text>
              <Text style={styles.contactValue}>
                123 Rental Street, Lagos, Nigeria
              </Text>
            </View>
          </View>
        </View>

        {/* Social Media */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow Us</Text>
          <View style={styles.socialContainer}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://facebook.com/apartmentrental')}
            >
              <MaterialIcons name="facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://twitter.com/apartmentrental')}
            >
              <MaterialIcons name="alternate-email" size={24} color="#1DA1F2" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://instagram.com/apartmentrental')}
            >
              <MaterialIcons name="camera-alt" size={24} color="#E4405F" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://linkedin.com/company/apartmentrental')}
            >
              <MaterialIcons name="work" size={24} color="#0077B5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Copyright */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Apartment Rental App. All rights reserved.
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Made with </Text>
            <MaterialIcons name="favorite" size={14} color="#F44336" />
            <Text style={styles.footerText}> for renters and property owners</Text>
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: '#FFFFFF',
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
  logoSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFF9E6',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  guideItem: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  guideContent: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  guideText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 30,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

