// Booking Service
import api from './api';
import { API_ENDPOINTS } from '../config/api';

export const bookingService = {
  // Create booking
  createBooking: async (bookingData) => {
    try {
      const response = await api.post(API_ENDPOINTS.BOOKINGS.CREATE, bookingData);
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

  // Get all bookings
  getBookings: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.BOOKINGS.LIST);
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },

  // Get booking by ID
  getBookingById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.BOOKINGS.DETAIL(id));
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },

  // Update booking
  updateBooking: async (id, bookingData) => {
    try {
      const response = await api.put(API_ENDPOINTS.BOOKINGS.UPDATE(id), bookingData);
      return response.data || response;
    } catch (error) {
      throw error;
    }
  },

  // Cancel booking
  cancelBooking: async (id) => {
    try {
      const response = await api.delete(API_ENDPOINTS.BOOKINGS.DELETE(id));
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get user's bookings
  getMyBookings: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.BOOKINGS.MY_BOOKINGS);
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
};

