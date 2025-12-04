// Apartment/Property Service
import api from './api';

export const apartmentService = {
  // Get all apartments
  getApartments: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams 
        ? `/api/apartments?${queryParams}` 
        : '/api/apartments';
      const response = await api.get(endpoint);
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

  // Get apartment by ID
  getApartmentById: async (id) => {
    try {
      const response = await api.get(`/api/apartments/${id}`);
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },

  // Create apartment listing
  createApartment: async (apartmentData) => {
    try {
      const response = await api.post('/api/apartments', apartmentData);
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

  // Update apartment listing
  updateApartment: async (id, apartmentData) => {
    try {
      const response = await api.put(`/api/apartments/${id}`, apartmentData);
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

  // Delete apartment listing
  deleteApartment: async (id) => {
    try {
      const response = await api.delete(`/api/apartments/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get user's apartments
  getMyApartments: async () => {
    try {
      const response = await api.get('/api/apartments/my-listings');
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

  // Search apartments
  searchApartments: async (query, filters = {}) => {
    try {
      const params = { ...filters, search: query };
      const queryParams = new URLSearchParams(params).toString();
      const response = await api.get(`/api/apartments/search?${queryParams}`);
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },
};

