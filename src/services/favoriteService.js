// Favorites Service
import api from './api';

export const favoriteService = {
  // Add to favorites
  addFavorite: async (apartmentId) => {
    try {
      const response = await api.post('/api/favorites', {
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
      const response = await api.delete(`/api/favorites/${apartmentId}`);
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
      const response = await api.get('/api/favorites');
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
      const response = await api.get(`/api/favorites/check/${apartmentId}`);
      return response.data?.isFavorite || false;
    } catch (error) {
      return false;
    }
  },
};

