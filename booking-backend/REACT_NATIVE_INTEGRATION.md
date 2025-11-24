# React Native Frontend Integration Guide

Complete guide for integrating your React Native app with the Booking API.

## 🚀 Quick Start

### API Base URL

**Staging/Production:**
```
https://your-app-name.up.railway.app/api
```

**Local Development:**
```
http://localhost:8080/api
```

**Note:** Use environment variables in your React Native app:
```javascript
// config/api.js
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080/api'  // Development
  : 'https://your-app-name.up.railway.app/api';  // Production
```

### Interactive API Documentation

**Swagger UI:** `https://your-app-name.up.railway.app/swagger-ui.html`

Use Swagger UI to:
- Explore all available endpoints
- See request/response schemas with examples
- Test API calls directly
- Copy example requests for your code

---

## 📦 Setup

### 1. Install Required Packages

```bash
npm install axios @react-native-async-storage/async-storage
# or
yarn add axios @react-native-async-storage/async-storage
```

### 2. Create API Client

```javascript
// services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080/api'
  : 'https://your-app-name.up.railway.app/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Navigate to login screen (implement based on your navigation)
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🔐 Authentication

### 1. Register a User

```javascript
// services/authService.js
import api from './api';

export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', {
      name: userData.name,
      email: userData.email,
      phone: userData.phone, // Optional, e.g., "+2348012345678"
      password: userData.password,
      role: userData.role, // "GUEST" or "HOST"
    });
    
    const { token, userId, email, role } = response.data;
    
    // Store token and user info
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify({ userId, email, role }));
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

**Example Usage:**
```javascript
// In your RegisterScreen component
const handleRegister = async () => {
  try {
    const result = await register({
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+2348012345678',
      password: 'securePassword123',
      role: 'GUEST', // or 'HOST'
    });
    
    // Navigate to home screen
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Registration Failed', error.message || 'Please try again');
  }
};
```

### 2. Login

```javascript
// services/authService.js
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    
    const { token, userId, email: userEmail, role } = response.data;
    
    // Store token and user info
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify({ userId, email: userEmail, role }));
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

**Example Usage:**
```javascript
// In your LoginScreen component
const handleLogin = async () => {
  try {
    const result = await login(email, password);
    
    // Navigate to home screen
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Login Failed', error.message || 'Invalid credentials');
  }
};
```

### 3. Get Current User

```javascript
// services/authService.js
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/users/profile');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### 4. Logout

```javascript
// services/authService.js
export const logout = async () => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
  // Navigate to login screen
};
```

---

## 📋 API Endpoints

### Listings

#### Get All Listings
```javascript
// services/listingService.js
import api from './api';

export const getListings = async (filters = {}) => {
  try {
    const response = await api.get('/listings', { params: filters });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

**Example Usage:**
```javascript
const listings = await getListings({
  page: 0,
  size: 10,
  sort: 'price,asc',
  // Optional filters
  minPrice: 100,
  maxPrice: 500,
  location: 'Lagos',
});
```

#### Get Listing by ID
```javascript
export const getListingById = async (id) => {
  try {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Create Listing (HOST only)
```javascript
export const createListing = async (listingData) => {
  try {
    const response = await api.post('/listings', {
      title: listingData.title,
      description: listingData.description,
      price: listingData.price, // e.g., 150.00
      location: listingData.location,
      amenities: listingData.amenities, // ["WiFi", "Air Conditioning", "Parking"]
      policies: listingData.policies, // ["No smoking", "No pets"]
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Update Listing (HOST only)
```javascript
export const updateListing = async (id, listingData) => {
  try {
    const response = await api.put(`/listings/${id}`, listingData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Delete Listing (HOST only)
```javascript
export const deleteListing = async (id) => {
  try {
    const response = await api.delete(`/listings/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### Bookings

#### Get User's Bookings
```javascript
// services/bookingService.js
import api from './api';

export const getMyBookings = async (page = 0, size = 10) => {
  try {
    const response = await api.get('/bookings', {
      params: { page, size },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Create Booking (GUEST only)
```javascript
export const createBooking = async (bookingData) => {
  try {
    const response = await api.post('/bookings', {
      listingId: bookingData.listingId,
      startDate: bookingData.startDate, // "2024-02-15"
      endDate: bookingData.endDate, // "2024-02-20"
      totalPrice: bookingData.totalPrice, // 750.00
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

**Example Usage:**
```javascript
const booking = await createBooking({
  listingId: 1,
  startDate: '2024-02-15',
  endDate: '2024-02-20',
  totalPrice: 750.00,
});
```

#### Get Booking by ID
```javascript
export const getBookingById = async (id) => {
  try {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Complete Booking
```javascript
export const completeBooking = async (id) => {
  try {
    const response = await api.put(`/bookings/${id}/complete`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Cancel Booking
```javascript
export const cancelBooking = async (id) => {
  try {
    const response = await api.put(`/bookings/${id}/cancel`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### Reviews

#### Get Reviews for Listing
```javascript
// services/reviewService.js
import api from './api';

export const getListingReviews = async (listingId, page = 0, size = 10) => {
  try {
    const response = await api.get(`/listings/${listingId}/reviews`, {
      params: { page, size },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Create Review
```javascript
export const createReview = async (listingId, reviewData) => {
  try {
    const response = await api.post(`/listings/${listingId}/reviews`, {
      rating: reviewData.rating, // 1-5
      comment: reviewData.comment,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Update Review
```javascript
export const updateReview = async (reviewId, reviewData) => {
  try {
    const response = await api.put(`/reviews/${reviewId}`, reviewData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Delete Review
```javascript
export const deleteReview = async (reviewId) => {
  try {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### Wallet

#### Get Wallet Balance
```javascript
// services/walletService.js
import api from './api';

export const getWallet = async () => {
  try {
    const response = await api.get('/wallet');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Deposit to Wallet
```javascript
export const depositToWallet = async (amount, paymentMethodId, description) => {
  try {
    const response = await api.post('/wallet/deposit', {
      amount, // e.g., 100.00
      paymentMethodId, // Optional
      description, // Optional
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Withdraw from Wallet
```javascript
export const withdrawFromWallet = async (amount, destinationAccountId, description) => {
  try {
    const response = await api.post('/wallet/withdraw', {
      amount, // e.g., 50.00
      destinationAccountId, // Required
      description, // Optional
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Get Wallet Transactions
```javascript
export const getWalletTransactions = async (page = 0, size = 10) => {
  try {
    const response = await api.get('/wallet/transactions', {
      params: { page, size },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### Payments

#### Create Payment Intent
```javascript
// services/paymentService.js
import api from './api';

export const createPaymentIntent = async (bookingId, useWallet = false, paymentMethodId) => {
  try {
    const response = await api.post('/payments/intent', {
      bookingId,
      useWallet,
      paymentMethodId, // Required if useWallet is false
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Confirm Payment
```javascript
export const confirmPayment = async (paymentIntentId) => {
  try {
    const response = await api.post('/payments/confirm', {
      paymentIntentId,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### User Profile

#### Get User Profile
```javascript
// services/userService.js
import api from './api';

export const getUserProfile = async () => {
  try {
    const response = await api.get('/users/profile');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

#### Update User Profile
```javascript
export const updateUserProfile = async (profileData) => {
  try {
    const response = await api.put('/users/profile', {
      name: profileData.name,
      phone: profileData.phone, // Optional
      bio: profileData.bio, // Optional
      location: profileData.location, // Optional
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

### File Upload

#### Upload File/Image
```javascript
// services/fileService.js
import api from './api';

export const uploadFile = async (fileUri, fileName, fileType) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: fileType, // e.g., 'image/jpeg'
    });

    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

**Example Usage:**
```javascript
// In your component
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  });

  if (!result.canceled) {
    const file = result.assets[0];
    const uploadedFile = await uploadFile(
      file.uri,
      file.fileName || 'image.jpg',
      'image/jpeg'
    );
    console.log('File uploaded:', uploadedFile);
  }
};
```

---

## 🔄 Error Handling

### Standard Error Response Format

```javascript
{
  "error": "Error type",
  "message": "Human-readable error message",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Error Handling Utility

```javascript
// utils/errorHandler.js
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return data.message || 'Invalid request';
      case 401:
        return 'Unauthorized. Please login again';
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'Resource not found';
      case 500:
        return 'Server error. Please try again later';
      default:
        return data.message || 'An error occurred';
    }
  } else if (error.request) {
    // Request made but no response received
    return 'Network error. Please check your connection';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
};
```

**Usage:**
```javascript
try {
  const listings = await getListings();
} catch (error) {
  const errorMessage = handleApiError(error);
  Alert.alert('Error', errorMessage);
}
```

---

## 🎯 Complete Example: React Native Component

```javascript
// screens/ListingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { getListings } from '../services/listingService';
import { handleApiError } from '../utils/errorHandler';

const ListingsScreen = ({ navigation }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      const data = await getListings({ page: 0, size: 20 });
      setListings(data.content || []);
    } catch (error) {
      Alert.alert('Error', handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const renderListing = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('ListingDetail', { id: item.id })}
      style={{ padding: 16, borderBottomWidth: 1 }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.title}</Text>
      <Text style={{ color: '#666' }}>{item.location}</Text>
      <Text style={{ fontSize: 16, color: '#007AFF', marginTop: 8 }}>
        ₦{item.price}/night
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <FlatList
      data={listings}
      renderItem={renderListing}
      keyExtractor={(item) => item.id.toString()}
      refreshing={loading}
      onRefresh={loadListings}
    />
  );
};

export default ListingsScreen;
```

---

## 📝 Important Notes

### 1. User Roles

- **GUEST**: Can book listings, create reviews, manage wallet
- **HOST**: Can create and manage listings, view bookings for their listings

### 2. JWT Token Expiration

Tokens expire after 1 hour (3600000ms). Implement token refresh or re-authentication logic.

### 3. CORS Configuration

The backend is configured to accept requests from any origin (`*`) for React Native. No CORS issues should occur.

### 4. Environment Variables

Use React Native Config or similar to manage different API URLs:

```javascript
// .env
API_URL=https://your-app-name.up.railway.app/api

// config/api.js
import Config from 'react-native-config';
const API_BASE_URL = Config.API_URL || 'http://localhost:8080/api';
```

### 5. Date Format

Use ISO 8601 format for dates: `"2024-02-15"` (YYYY-MM-DD)

### 6. Currency

All prices are in the configured currency (default: NGN). Format as needed in your UI.

---

## 🧪 Testing

### Health Check

```javascript
// Test if API is accessible
const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    console.log('API is healthy:', response.data);
  } catch (error) {
    console.error('API health check failed:', error);
  }
};
```

### Swagger UI

Visit `https://your-app-name.up.railway.app/swagger-ui.html` to:
- Test endpoints interactively
- See request/response examples
- Understand API structure

---

## 📞 Support

- **API Documentation**: `https://your-app-name.up.railway.app/swagger-ui.html`
- **OpenAPI Spec**: `https://your-app-name.up.railway.app/api-docs`
- **Health Check**: `https://your-app-name.up.railway.app/api/health`

For issues or questions, contact the backend team.

