// Booking history utility functions - User-specific storage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleRatingNotification } from './phoneNotifications';
import { getUserStorageKey } from './userStorage';

/**
 * Add a new booking to history for a specific user
 * @param {string} userEmail - User's email address
 * @param {object} bookingData - Booking data
 */
export const addBooking = async (userEmail, bookingData) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    const key = getUserStorageKey('userBookings', userEmail);
    const bookingsJson = await AsyncStorage.getItem(key);
    const bookings = bookingsJson ? JSON.parse(bookingsJson) : [];
    
    const newBooking = {
      id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...bookingData,
      createdAt: new Date().toISOString(),
      status: bookingData.status || 'confirmed',
      userEmail: userEmail, // Store user email with booking
    };
    
    // Add to beginning of array (most recent first)
    bookings.unshift(newBooking);
    
    await AsyncStorage.setItem(key, JSON.stringify(bookings));
    
    // Schedule rating notification for after checkout
    try {
      await scheduleRatingNotification(newBooking);
    } catch (error) {
      console.error('Error scheduling rating notification:', error);
      // Don't fail the booking if notification scheduling fails
    }
    
    return newBooking;
  } catch (error) {
    console.error('Error adding booking:', error);
    throw error;
  }
};

/**
 * Get all bookings for a specific user
 * @param {string} userEmail - User's email address
 */
export const getBookings = async (userEmail) => {
  try {
    if (!userEmail) {
      console.warn('getBookings: No user email provided');
      return [];
    }
    const key = getUserStorageKey('userBookings', userEmail);
    const bookingsJson = await AsyncStorage.getItem(key);
    return bookingsJson ? JSON.parse(bookingsJson) : [];
  } catch (error) {
    console.error('Error getting bookings:', error);
    return [];
  }
};

/**
 * Get booking by ID for a specific user
 * @param {string} userEmail - User's email address
 * @param {string} bookingId - Booking ID
 */
export const getBookingById = async (userEmail, bookingId) => {
  try {
    if (!userEmail) {
      console.warn('getBookingById: No user email provided');
      return null;
    }
    const bookings = await getBookings(userEmail);
    return bookings.find(booking => booking.id === bookingId);
  } catch (error) {
    console.error('Error getting booking by ID:', error);
    return null;
  }
};

/**
 * Update booking status for a specific user
 * @param {string} userEmail - User's email address
 * @param {string} bookingId - Booking ID
 * @param {string} status - New status
 */
export const updateBookingStatus = async (userEmail, bookingId, status) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    const key = getUserStorageKey('userBookings', userEmail);
    const bookings = await getBookings(userEmail);
    const index = bookings.findIndex(booking => booking.id === bookingId);
    
    if (index !== -1) {
      bookings[index].status = status;
      bookings[index].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(key, JSON.stringify(bookings));
      return bookings[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
};

/**
 * Delete a booking for a specific user
 * @param {string} userEmail - User's email address
 * @param {string} bookingId - Booking ID
 */
export const deleteBooking = async (userEmail, bookingId) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }
    const key = getUserStorageKey('userBookings', userEmail);
    const bookings = await getBookings(userEmail);
    const filteredBookings = bookings.filter(booking => booking.id !== bookingId);
    await AsyncStorage.setItem(key, JSON.stringify(filteredBookings));
    return true;
  } catch (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }
};

/**
 * Add a booking for a host (when someone books their property)
 * PERSISTENCE: Host bookings persist across sign-out and sign-in
 * @param {string} hostEmail - Host's email address
 * @param {object} bookingData - Booking data (includes guest info, dates, amount, etc.)
 */
export const addHostBooking = async (hostEmail, bookingData) => {
  try {
    if (!hostEmail) {
      console.warn('addHostBooking: No host email provided - booking not stored for host');
      return null;
    }
    // Normalize host email for consistent storage
    const normalizedHostEmail = hostEmail.toLowerCase().trim();
    const key = getUserStorageKey('hostBookings', normalizedHostEmail);
    const bookingsJson = await AsyncStorage.getItem(key);
    const bookings = bookingsJson ? JSON.parse(bookingsJson) : [];
    
    const newBooking = {
      id: bookingData.id || `host_booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...bookingData,
      createdAt: bookingData.bookingDate || bookingData.createdAt || new Date().toISOString(),
      status: bookingData.status || 'Confirmed',
      hostEmail: normalizedHostEmail, // Store host email with booking
      // Store guest information
      guestEmail: bookingData.userEmail || bookingData.guestEmail || null,
      guestName: bookingData.userName || bookingData.guestName || 'Guest',
    };
    
    // Check if booking already exists (prevent duplicates)
    const existingIndex = bookings.findIndex(b => b.id === newBooking.id);
    if (existingIndex === -1) {
      // Add to beginning of array (most recent first)
      bookings.unshift(newBooking);
      await AsyncStorage.setItem(key, JSON.stringify(bookings));
      console.log(`✅ Host booking stored for ${normalizedHostEmail}: ${newBooking.title || 'Apartment'}`);
    } else {
      console.log(`⚠️ Host booking already exists for ${normalizedHostEmail}: ${newBooking.id}`);
    }
    
    return newBooking;
  } catch (error) {
    console.error('Error adding host booking:', error);
    // Don't throw - host booking storage failure shouldn't block payment
    return null;
  }
};

/**
 * Get all bookings for a specific host
 * PERSISTENCE: Host bookings persist across sign-out and sign-in
 * @param {string} hostEmail - Host's email address
 * @returns {Promise<Array>} Array of bookings for the host
 */
export const getHostBookings = async (hostEmail) => {
  try {
    if (!hostEmail) {
      console.warn('getHostBookings: No host email provided');
      return [];
    }
    // Normalize host email for consistent retrieval
    const normalizedHostEmail = hostEmail.toLowerCase().trim();
    const key = getUserStorageKey('hostBookings', normalizedHostEmail);
    const bookingsJson = await AsyncStorage.getItem(key);
    const bookings = bookingsJson ? JSON.parse(bookingsJson) : [];
    
    // Sort by date (most recent first)
    return bookings.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.bookingDate || 0);
      const dateB = new Date(b.createdAt || b.bookingDate || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting host bookings:', error);
    return [];
  }
};

/**
 * Delete a host booking
 * @param {string} hostEmail - Host's email address
 * @param {string} bookingId - Booking ID
 */
export const deleteHostBooking = async (hostEmail, bookingId) => {
  try {
    if (!hostEmail) {
      throw new Error('Host email is required');
    }
    const normalizedHostEmail = hostEmail.toLowerCase().trim();
    const key = getUserStorageKey('hostBookings', normalizedHostEmail);
    const bookings = await getHostBookings(normalizedHostEmail);
    const filteredBookings = bookings.filter(booking => booking.id !== bookingId);
    await AsyncStorage.setItem(key, JSON.stringify(filteredBookings));
    return true;
  } catch (error) {
    console.error('Error deleting host booking:', error);
    throw error;
  }
};

/**
 * Get all bookings for a specific apartment
 * @param {string} apartmentId - Apartment ID
 * @param {string} hostEmail - Host's email address
 * @returns {Promise<Array>} Array of bookings for the apartment
 */
export const getApartmentBookings = async (apartmentId, hostEmail) => {
  try {
    if (!apartmentId || !hostEmail) {
      return [];
    }
    
    // Get all host bookings and filter by apartmentId
    const hostBookings = await getHostBookings(hostEmail);
    
    // Filter bookings for this apartment with active status
    const apartmentBookings = hostBookings.filter(booking => {
      const bookingApartmentId = booking.apartmentId || String(booking.apartmentId);
      const requestedApartmentId = String(apartmentId);
      const status = (booking.status || '').toLowerCase();
      
      // Only include confirmed or pending bookings (active bookings)
      const isActive = status === 'confirmed' || status === 'pending';
      
      return bookingApartmentId === requestedApartmentId && isActive;
    });
    
    return apartmentBookings;
  } catch (error) {
    console.error('Error getting apartment bookings:', error);
    return [];
  }
};

/**
 * Check if two date ranges overlap
 * @param {string} checkIn1 - First check-in date (YYYY-MM-DD)
 * @param {string} checkOut1 - First check-out date (YYYY-MM-DD)
 * @param {string} checkIn2 - Second check-in date (YYYY-MM-DD)
 * @param {string} checkOut2 - Second check-out date (YYYY-MM-DD)
 * @returns {boolean} True if dates overlap
 */
const datesOverlap = (checkIn1, checkOut1, checkIn2, checkOut2) => {
  try {
    const date1In = new Date(checkIn1);
    const date1Out = new Date(checkOut1);
    const date2In = new Date(checkIn2);
    const date2Out = new Date(checkOut2);
    
    // Check for overlap: ranges overlap if one starts before the other ends and ends after the other starts
    return date1In <= date2Out && date1Out >= date2In;
  } catch (error) {
    console.error('Error checking date overlap:', error);
    return false;
  }
};

/**
 * Check if requested dates conflict with existing bookings for an apartment
 * @param {string} apartmentId - Apartment ID
 * @param {string} hostEmail - Host's email address
 * @param {string} checkInDate - Requested check-in date (YYYY-MM-DD)
 * @param {string} checkOutDate - Requested check-out date (YYYY-MM-DD)
 * @param {string} excludeBookingId - Optional booking ID to exclude from conflict check (for updates)
 * @returns {Promise<{hasConflict: boolean, conflictingBookings: Array}>}
 */
export const checkDateConflict = async (apartmentId, hostEmail, checkInDate, checkOutDate, excludeBookingId = null) => {
  try {
    if (!apartmentId || !hostEmail || !checkInDate || !checkOutDate) {
      return { hasConflict: false, conflictingBookings: [] };
    }
    
    const apartmentBookings = await getApartmentBookings(apartmentId, hostEmail);
    
    // Filter out the booking being updated (if provided)
    const bookingsToCheck = excludeBookingId 
      ? apartmentBookings.filter(booking => booking.id !== excludeBookingId)
      : apartmentBookings;
    
    // Check each booking for date overlap
    const conflictingBookings = bookingsToCheck.filter(booking => {
      const existingCheckIn = booking.checkInDate;
      const existingCheckOut = booking.checkOutDate;
      
      if (!existingCheckIn || !existingCheckOut) {
        return false;
      }
      
      return datesOverlap(checkInDate, checkOutDate, existingCheckIn, existingCheckOut);
    });
    
    return {
      hasConflict: conflictingBookings.length > 0,
      conflictingBookings: conflictingBookings
    };
  } catch (error) {
    console.error('Error checking date conflict:', error);
    return { hasConflict: false, conflictingBookings: [] };
  }
};

/**
 * Get unavailable dates for an apartment (for calendar display)
 * @param {string} apartmentId - Apartment ID
 * @param {string} hostEmail - Host's email address
 * @returns {Promise<Object>} Object with dates marked as unavailable (format for react-native-calendars)
 */
export const getUnavailableDates = async (apartmentId, hostEmail) => {
  try {
    if (!apartmentId || !hostEmail) {
      return {};
    }
    
    const apartmentBookings = await getApartmentBookings(apartmentId, hostEmail);
    const unavailableDates = {};
    
    // Mark all dates within each booking period as unavailable
    apartmentBookings.forEach(booking => {
      const checkIn = booking.checkInDate;
      const checkOut = booking.checkOutDate;
      
      if (!checkIn || !checkOut) {
        return;
      }
      
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      // Iterate through each date from check-in to check-out (inclusive)
      const currentDate = new Date(checkInDate);
      while (currentDate <= checkOutDate) {
        const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        unavailableDates[dateString] = {
          marked: true,
          disabled: true,
          dotColor: '#F44336',
          selectedColor: '#F44336',
        };
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return unavailableDates;
  } catch (error) {
    console.error('Error getting unavailable dates:', error);
    return {};
  }
};

