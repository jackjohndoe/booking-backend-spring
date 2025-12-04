import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const navigation = useNavigation();
  const [expandedSection, setExpandedSection] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const openEmail = () => {
    const email = 'help@apartments.com';
    const subject = encodeURIComponent(subject || 'Support Request');
    const body = encodeURIComponent(message || '');
    const url = `mailto:${email}?subject=${subject}&body=${body}`;
    
    Linking.openURL(url).catch(err => {
      Alert.alert('Error', 'Unable to open email client. Please email us at help@apartments.com');
    });
  };

  const openWebsite = () => {
    Linking.openURL('https://www.apartments.com/support').catch(err => {
      Alert.alert('Error', 'Unable to open website. Please visit www.apartments.com/support');
    });
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const faqData = [
    {
      id: 'booking',
      question: 'How do I book an apartment?',
      answer: 'To book an apartment, browse through available listings, select your preferred dates, choose the number of guests, and proceed to payment. You can pay via card, bank transfer, or wallet.',
    },
    {
      id: 'payment',
      question: 'What payment methods are accepted?',
      answer: 'We accept credit/debit cards, bank transfers, and wallet payments. All payments are secure and processed through our trusted payment partners.',
    },
    {
      id: 'cancellation',
      question: 'Can I cancel my booking?',
      answer: 'Yes, you can cancel your booking. Cancellation policies vary by property. Check the property details for specific cancellation terms. Refunds are processed according to the property\'s policy.',
    },
    {
      id: 'listing',
      question: 'How do I list my property?',
      answer: 'Go to your Profile page, tap "Upload Listing", fill in all property details including images, amenities, and pricing. Once submitted, your listing will be reviewed and published.',
    },
    {
      id: 'modify',
      question: 'Can I modify my booking?',
      answer: 'Booking modifications depend on the property\'s policy. Contact the property owner directly or reach out to our support team for assistance with changes.',
    },
    {
      id: 'refund',
      question: 'How long does it take to process refunds?',
      answer: 'Refunds are typically processed within 5-10 business days after cancellation approval. The exact time depends on your payment method and bank processing times.',
    },
    {
      id: 'profile',
      question: 'How do I update my profile?',
      answer: 'Go to Profile → Edit Profile. You can update your name, email, WhatsApp number, address, and profile picture. Changes are saved immediately.',
    },
    {
      id: 'favorites',
      question: 'How do I save apartments to favorites?',
      answer: 'Tap the heart icon on any apartment listing to save it to your favorites. Access all saved apartments from the Favorites tab.',
    },
  ];

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
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get in Touch</Text>
          <Text style={styles.sectionDescription}>
            We're here to help! Reach out to us through any of the following channels.
          </Text>

          {/* Email */}
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={openEmail}
          >
            <View style={styles.contactIconContainer}>
              <MaterialIcons name="email" size={28} color="#FFD700" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>help@apartments.com</Text>
              <Text style={styles.contactHint}>Tap to send an email</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          {/* Website */}
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={openWebsite}
          >
            <View style={styles.contactIconContainer}>
              <MaterialIcons name="language" size={28} color="#FFD700" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Visit Our Website</Text>
              <Text style={styles.contactValue}>www.apartments.com/support</Text>
              <Text style={styles.contactHint}>Tap to open in browser</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => Linking.openURL('tel:+2341234567890')}
          >
            <View style={styles.contactIconContainer}>
              <MaterialIcons name="phone" size={28} color="#FFD700" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Phone Support</Text>
              <Text style={styles.contactValue}>+234 123 456 7890</Text>
              <Text style={styles.contactHint}>Available Mon-Fri, 9AM-6PM</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Quick Contact Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Us a Message</Text>
          <Text style={styles.sectionDescription}>
            Fill out the form below and we'll get back to you as soon as possible.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="What can we help you with?"
              value={subject}
              onChangeText={setSubject}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your issue or question..."
              value={message}
              onChangeText={setMessage}
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity 
            style={styles.sendButton}
            onPress={openEmail}
          >
            <MaterialIcons name="send" size={20} color="#FFF" />
            <Text style={styles.sendButtonText}>Send Email</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Text style={styles.sectionDescription}>
            Find quick answers to common questions.
          </Text>

          {faqData.map((faq) => (
            <View key={faq.id} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleSection(faq.id)}
              >
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                <MaterialIcons
                  name={expandedSection === faq.id ? 'expand-less' : 'expand-more'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
              {expandedSection === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Help Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help Resources</Text>
          
          <TouchableOpacity 
            style={styles.resourceCard}
            onPress={() => navigation.navigate('About')}
          >
            <MaterialIcons name="info" size={24} color="#FFD700" />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>App Information</Text>
              <Text style={styles.resourceDescription}>
                Learn more about the app, terms, and privacy policy
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <View style={styles.resourceCard}>
            <MaterialIcons name="video-library" size={24} color="#FFD700" />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>Video Tutorials</Text>
              <Text style={styles.resourceDescription}>
                Watch step-by-step guides on using the app
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </View>

          <View style={styles.resourceCard}>
            <MaterialIcons name="article" size={24} color="#FFD700" />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>Help Articles</Text>
              <Text style={styles.resourceDescription}>
                Browse our knowledge base for detailed guides
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </View>
        </View>

        {/* Support Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support Hours</Text>
          <View style={styles.hoursContainer}>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Monday - Friday</Text>
              <Text style={styles.hoursTime}>9:00 AM - 6:00 PM</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Saturday</Text>
              <Text style={styles.hoursTime}>10:00 AM - 4:00 PM</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Sunday</Text>
              <Text style={styles.hoursTime}>Closed</Text>
            </View>
          </View>
          <Text style={styles.hoursNote}>
            Email support is available 24/7. We typically respond within 24 hours.
          </Text>
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
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  contactIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  contactHint: {
    fontSize: 12,
    color: '#999',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F5F5F5',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  faqItem: {
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resourceContent: {
    flex: 1,
    marginLeft: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 14,
    color: '#666',
  },
  hoursContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  hoursDay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  hoursTime: {
    fontSize: 16,
    color: '#666',
  },
  hoursNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

