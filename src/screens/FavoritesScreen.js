import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyFavoriteRemoved } from '../utils/notifications';
import { hybridFavoriteService } from '../services/hybridService';
import { hybridApartmentService } from '../services/hybridService';

const { width } = Dimensions.get('window');

const allApartments = [
  {
    id: '1',
    title: 'Modern 3-Bedroom Apartment in Victoria Island',
    price: 83333, // Daily rate (under 100K)
    location: 'Lagos',
    beds: 3,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
  },
  {
    id: '2',
    title: 'Luxury 2-Bedroom Penthouse in Lekki',
    price: 95000, // Daily rate (under 100K)
    location: 'Lagos',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800',
  },
  {
    id: '3',
    title: 'Cozy 1-Bedroom Studio in Garki',
    price: 26667, // Daily rate (under 100K)
    location: 'Abuja',
    beds: 1,
    baths: 1,
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  },
  {
    id: '4',
    title: 'Spacious 4-Bedroom Family Home in Port Harcourt',
    price: 60000, // Daily rate (under 100K)
    location: 'Port Harcourt',
    beds: 4,
    baths: 3,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  },
  {
    id: '5',
    title: 'Elegant 2-Bedroom Apartment in Ibadan',
    price: 20000, // Daily rate (under 100K)
    location: 'Ibadan',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
  },
  {
    id: '6',
    title: 'Contemporary 3-Bedroom Duplex in Kano',
    price: 40000, // Daily rate (under 100K)
    location: 'Kano',
    beds: 3,
    baths: 3,
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
  },
  {
    id: '7',
    title: 'Stylish 2-Bedroom Apartment in Ikeja',
    price: 50000, // Daily rate (under 100K)
    location: 'Lagos',
    beds: 2,
    baths: 2,
    image: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
  },
  {
    id: '8',
    title: 'Luxury 5-Bedroom Mansion in Asokoro',
    price: 98000, // Daily rate (under 100K)
    location: 'Abuja',
    beds: 5,
    baths: 4,
    image: 'https://images.unsplash.com/photo-1600585152915-d208bec867a1?w=800',
  },
];

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Reload favorites when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      // Get user-specific favorites (persists across logout/login)
      const favoriteIds = await hybridFavoriteService.getFavorites();
      console.log('FavoritesScreen - Loaded favorite IDs:', favoriteIds.length);
      
      if (!favoriteIds || favoriteIds.length === 0) {
        setFavorites([]);
        return;
      }
      
      // Get all apartments (from global listings + defaults)
      const allApartments = await hybridApartmentService.getAllApartmentsForExplore();
      console.log('FavoritesScreen - All apartments loaded:', allApartments.length);
      
      // Filter to only show favorite apartments
      const favoriteApartments = allApartments.filter((apt) =>
        favoriteIds.includes(apt.id) || favoriteIds.includes(String(apt.id))
      );
      
      console.log('FavoritesScreen - Favorite apartments found:', favoriteApartments.length);
      setFavorites(favoriteApartments);
    } catch (error) {
      console.error('Error loading favorites:', error);
      setFavorites([]);
    }
  };

  const removeFavorite = async (id) => {
    try {
      const apartment = favorites.find((apt) => apt.id === id);
      
      // Remove from user-specific favorites (persists across logout/login)
      await hybridFavoriteService.removeFavorite(id);
      
      // Update local state
      const updatedFavorites = favorites.filter((apt) => apt.id !== id);
      setFavorites(updatedFavorites);
      
      // Add notification
      if (apartment) {
        await notifyFavoriteRemoved(apartment.title);
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '₦0';
    
    // Format price with m for millions and k for thousands
    if (price >= 1000000) {
      // Millions: divide by 1,000,000 and show with "m" (e.g., ₦5m)
      const millions = price / 1000000;
      // Show up to 1 decimal place if needed, otherwise whole number
      const formatted = millions % 1 === 0 
        ? millions.toFixed(0) 
        : millions.toFixed(1);
      return `₦${formatted}m`;
    } else if (price >= 1000) {
      // Thousands: divide by 1,000 and show with "k" (e.g., ₦50k)
      const thousands = price / 1000;
      // Show up to 1 decimal place if needed, otherwise whole number
      const formatted = thousands % 1 === 0 
        ? thousands.toFixed(0) 
        : thousands.toFixed(1);
      return `₦${formatted}k`;
    } else {
      // Less than 1000: show full number
      return `₦${price.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  };

  const renderFavoriteCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ApartmentDetails', { apartment: item })}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.price}>{formatPrice(item.price)}/day</Text>
            <Text style={styles.location}>{item.location}</Text>
            <Text style={styles.details}>
              {item.beds} bed · {item.baths} bath
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFavorite(item.id)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="favorite" size={24} color="#FF0000" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (favorites.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Favorites</Text>
          <Text style={styles.headerSubtitle}>Your saved apartments</Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="favorite-border" size={64} color="#999" />
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubtext}>
            Start exploring and add apartments to your favorites
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSubtitle}>{favorites.length} saved apartments</Text>
      </View>
      <FlatList
        data={favorites}
        renderItem={renderFavoriteCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#999',
  },
  removeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

