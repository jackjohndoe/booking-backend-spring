// Apartment/Property Service
import api from './api';
import { API_ENDPOINTS } from '../config/api';

export const apartmentService = {
  // Get all apartments
  getApartments: async (filters = {}) => {
    try {
      // Add pagination parameters if not provided (fetch more listings for cross-platform sync)
      const page = filters.page !== undefined ? filters.page : 0;
      const size = filters.size !== undefined ? filters.size : 100; // Fetch more listings by default
      
      const queryParams = new URLSearchParams({
        ...filters,
        page: page.toString(),
        size: size.toString(),
      }).toString();
      
      const endpoint = queryParams 
        ? `${API_ENDPOINTS.APARTMENTS.LIST}?${queryParams}` 
        : API_ENDPOINTS.APARTMENTS.LIST;
      const response = await api.get(endpoint);
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      
      // Handle PageResponse structure: { content: [...], page, size, totalElements, ... }
      // Extract the content array which contains the actual listings
      if (response.data) {
        // If response.data exists, check if it's a PageResponse
        if (response.data.content && Array.isArray(response.data.content)) {
          return response.data.content; // Return the content array
        }
        // If response.data is already an array, return it
        if (Array.isArray(response.data)) {
          return response.data;
        }
        return response.data;
      }
      
      // If response is a PageResponse directly
      if (response.content && Array.isArray(response.content)) {
        return response.content;
      }
      
      // If response is already an array
      if (Array.isArray(response)) {
        return response;
      }
      
      return null;
    } catch (error) {
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Get apartment by ID
  getApartmentById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.APARTMENTS.DETAIL(id));
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },

  // Create apartment listing
  createApartment: async (apartmentData) => {
    try {
      // Map frontend data format to backend DTO format
      // Backend expects: title, description, price (BigDecimal), location, amenities (Set<String>), policies (Set<String>)
      const backendRequest = {
        title: apartmentData.title || apartmentData.name || 'Untitled Listing',
        description: apartmentData.description || '',
        price: apartmentData.price || 0,
        location: apartmentData.location || apartmentData.address || 'Nigeria',
        amenities: (() => {
          // Convert amenities object/array to Set<String> format
          if (!apartmentData.amenities) {
            return [];
          }
          if (Array.isArray(apartmentData.amenities)) {
            return apartmentData.amenities;
          }
          if (typeof apartmentData.amenities === 'object') {
            // Convert object to array of keys (amenities that are true)
            return Object.keys(apartmentData.amenities).filter(key => apartmentData.amenities[key] === true);
          }
          return [];
        })(),
        policies: apartmentData.policies || [],
      };
      
      // Ensure price is a number (backend expects BigDecimal which will be converted from number)
      if (typeof backendRequest.price !== 'number') {
        backendRequest.price = parseFloat(backendRequest.price) || 0;
      }
      
      // Ensure required fields are present
      if (!backendRequest.title || !backendRequest.title.trim()) {
        throw new Error('Title is required');
      }
      if (!backendRequest.location || !backendRequest.location.trim()) {
        throw new Error('Location is required');
      }
      if (!backendRequest.price || backendRequest.price <= 0) {
        throw new Error('Valid price is required');
      }
      
      console.log('📤 Sending listing to API:', {
        title: backendRequest.title,
        location: backendRequest.location,
        price: backendRequest.price,
        amenitiesCount: backendRequest.amenities.length,
      });
      
      const response = await api.post(API_ENDPOINTS.APARTMENTS.CREATE, backendRequest);
      // If response is null (403, 401, etc.), return null for hybrid service to handle
      if (response === null || response === undefined) {
        return null;
      }
      return response.data || response;
    } catch (error) {
      console.error('❌ Error creating apartment via API:', error);
      // Log the error details for debugging
      if (error.response) {
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          message: error.response.data?.message || error.message,
        });
      }
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  },

  // Update apartment listing
  updateApartment: async (id, apartmentData) => {
    try {
      const response = await api.put(API_ENDPOINTS.APARTMENTS.UPDATE(id), apartmentData);
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
      const response = await api.delete(API_ENDPOINTS.APARTMENTS.DELETE(id));
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get user's apartments
  getMyApartments: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.APARTMENTS.MY_LISTINGS);
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
      const response = await api.get(`${API_ENDPOINTS.APARTMENTS.SEARCH}?${queryParams}`);
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },
};

