// Favorites Service
import api from './api';
import { API_ENDPOINTS } from '../config/api';

export const favoriteService = {
  // Add to favorites
  addFavorite: async (apartmentId) => {
    try {
      const response = await api.post(API_ENDPOINTS.FAVORITES.ADD, {
        apartmentId,
      });
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Remove from favorites
  removeFavorite: async (apartmentId) => {
    try {
      const response = await api.delete(API_ENDPOINTS.FAVORITES.REMOVE(apartmentId));
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      return response;
    } catch (error) {
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Get favorites
  getFavorites: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.FAVORITES.LIST);
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Check if apartment is favorite
  isFavorite: async (apartmentId) => {
    try {
      const response = await api.get(API_ENDPOINTS.FAVORITES.CHECK(apartmentId));
      return response.data?.isFavorite || false;
    } catch (error) {
      return false;
    }
  },
};

