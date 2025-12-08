import { getUserNotifications, saveUserNotifications } from './userStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to get current user email from AsyncStorage
const getCurrentUserEmail = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.email || null;
    }
  } catch (error) {
    console.error('Error getting current user email:', error);
  }
  return null;
};

// Notification types
export const NOTIFICATION_TYPES = {
  FAVORITE: 'favorite',
  PAYMENT: 'payment',
  PROFILE: 'profile',
  BOOKING: 'booking',
  LISTING: 'listing',
  RATING: 'rating',
};

/**
 * Add a new notification
 * @param {string} type - Type of notification (favorite, payment, profile, booking)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
export const addNotification = async (type, title, message, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      console.warn('addNotification: No user email provided - notification not stored');
      return null;
    }
    
    // Normalize email for consistent storage
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`📧 Adding notification for ${normalizedEmail}: ${title} - ${message.substring(0, 50)}...`);
    
    const notifications = await getUserNotifications(normalizedEmail);
    
    const newNotification = {
      id: `notif_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    
    notifications.unshift(newNotification);
    await saveUserNotifications(normalizedEmail, notifications);
    
    console.log(`✅ Notification stored for ${normalizedEmail}: ${newNotification.id}`);
    
    // Verify notification was stored
    const verifyNotifications = await getUserNotifications(normalizedEmail);
    const foundNotification = verifyNotifications.find(n => n.id === newNotification.id);
    if (foundNotification) {
      console.log(`✅ Notification verified in storage - will appear in notifications`);
    } else {
      console.error(`❌ WARNING: Notification ${newNotification.id} not found in storage after creation!`);
    }
    
    return newNotification;
  } catch (error) {
    console.error('Error adding notification:', error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
};

/**
 * Add notification when listing is added to favorites
 */
export const notifyFavoriteAdded = async (apartmentTitle) => {
  return await addNotification(
    NOTIFICATION_TYPES.FAVORITE,
    'Added to Favorites',
    `You added "${apartmentTitle}" to your favorites`
  );
};

/**
 * Add notification when listing is removed from favorites
 */
export const notifyFavoriteRemoved = async (apartmentTitle) => {
  return await addNotification(
    NOTIFICATION_TYPES.FAVORITE,
    'Removed from Favorites',
    `You removed "${apartmentTitle}" from your favorites`
  );
};

/**
 * Add notification when payment is made
 */
export const notifyPaymentMade = async (amount, apartmentTitle) => {
  const formattedAmount = `₦${amount.toLocaleString()}`;
  return await addNotification(
    NOTIFICATION_TYPES.PAYMENT,
    'Payment Successful',
    `Payment of ${formattedAmount} for "${apartmentTitle}" has been processed`
  );
};

/**
 * Add notification when transfer payment is confirmed
 */
export const notifyTransferConfirmed = async (amount) => {
  const formattedAmount = `₦${amount.toLocaleString()}`;
  return await addNotification(
    NOTIFICATION_TYPES.PAYMENT,
    'Transfer Confirmed',
    `Your transfer of ${formattedAmount} has been received. Verification in progress.`
  );
};

/**
 * Add notification when profile is edited
 */
export const notifyProfileUpdated = async () => {
  return await addNotification(
    NOTIFICATION_TYPES.PROFILE,
    'Profile Updated',
    'Your profile information has been successfully updated'
  );
};

/**
 * Add notification when booking is confirmed
 */
export const notifyBookingConfirmed = async (apartmentTitle, checkInDate, checkOutDate) => {
  return await addNotification(
    NOTIFICATION_TYPES.BOOKING,
    'Booking Confirmed',
    `Your booking for "${apartmentTitle}" from ${checkInDate} to ${checkOutDate} has been confirmed`
  );
};

/**
 * Add notification when listing is uploaded/created
 */
export const notifyListingUploaded = async (listingTitle) => {
  return await addNotification(
    NOTIFICATION_TYPES.LISTING,
    'Listing Uploaded',
    `Your listing "${listingTitle}" has been successfully uploaded and is now visible to other users`
  );
};

/**
 * Add notification when listing is deleted
 */
export const notifyListingDeleted = async (listingTitle) => {
  return await addNotification(
    NOTIFICATION_TYPES.LISTING,
    'Listing Deleted',
    `Your listing "${listingTitle}" has been successfully deleted`
  );
};

/**
 * Add notification for rating prompt after checkout
 */
export const notifyRatingPrompt = async (apartmentTitle) => {
  return await addNotification(
    NOTIFICATION_TYPES.RATING,
    'How was your stay?',
    `We hope you enjoyed your stay at "${apartmentTitle}". Tap to rate your host!`
  );
};

/**
 * Notify host about a new booking
 * @param {string} hostEmail - Host's email address
 * @param {string} bookerName - Name of the person who made the booking
 * @param {string} propertyTitle - Title of the booked property
 * @param {string} checkInDate - Check-in date
 * @param {string} checkOutDate - Check-out date
 */
export const notifyHostNewBooking = async (
  hostEmail, 
  bookerName, 
  propertyTitle, 
  checkInDate, 
  checkOutDate,
  numberOfGuests = null,
  numberOfDays = null,
  totalAmount = null,
  paymentMethod = null
) => {
  if (!hostEmail) {
    console.warn('Cannot notify host: No host email provided');
    return null;
  }
  
  // Format dates for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };
  
  const formattedCheckIn = formatDate(checkInDate);
  const formattedCheckOut = formatDate(checkOutDate);
  
  // Build detailed notification message
  let message = `${bookerName} has booked "${propertyTitle}" from ${formattedCheckIn} to ${formattedCheckOut}`;
  
  // Add additional booking details if available
  const details = [];
  if (numberOfDays !== null && numberOfDays !== undefined) {
    details.push(`${numberOfDays} ${numberOfDays === 1 ? 'night' : 'nights'}`);
  }
  if (numberOfGuests !== null && numberOfGuests !== undefined) {
    details.push(`${numberOfGuests} ${numberOfGuests === 1 ? 'guest' : 'guests'}`);
  }
  if (totalAmount !== null && totalAmount !== undefined) {
    details.push(`Total: ₦${totalAmount.toLocaleString()}`);
  }
  if (paymentMethod) {
    details.push(`Payment: ${paymentMethod}`);
  }
  
  if (details.length > 0) {
    message += ` (${details.join(', ')})`;
  }
  
  // Normalize host email
  const normalizedHostEmail = hostEmail.toLowerCase().trim();
  
  console.log(`📧 Sending booking notification to host: ${normalizedHostEmail}`);
  console.log(`📧 Booking details: ${bookerName} booked "${propertyTitle}"`);
  
  const notification = await addNotification(
    NOTIFICATION_TYPES.BOOKING,
    'New Booking Received!',
    message,
    normalizedHostEmail // Send to host's email, not current user
  );
  
  if (notification) {
    console.log(`✅ Booking notification sent to host: ${normalizedHostEmail}`);
  } else {
    console.error(`❌ Failed to send booking notification to host: ${normalizedHostEmail}`);
  }
  
  return notification;
};

/**
 * Notify host that their wallet has been funded
 * @param {string} hostEmail - Host's email address
 * @param {number} amount - Amount added to wallet (after fees deduction)
 * @param {string} propertyTitle - Title of the property that was booked
 */
export const notifyHostWalletFunded = async (hostEmail, amount, propertyTitle) => {
  if (!hostEmail) {
    console.warn('Cannot notify host: No host email provided');
    return null;
  }
  
  const formattedAmount = `₦${amount.toLocaleString()}`;
  
  return await addNotification(
    NOTIFICATION_TYPES.PAYMENT,
    'Wallet Funded',
    `Your wallet has been credited with ${formattedAmount} for booking of "${propertyTitle}"`,
    hostEmail // Send to host's email, not current user
  );
};

/**
 * Notify guest that host has requested payment
 * @param {string} guestEmail - Guest's email address
 * @param {number} amount - Payment amount requested
 * @param {string} propertyTitle - Title of the property
 * @param {string} bookingId - Booking ID
 */
export const notifyPaymentRequested = async (guestEmail, amount, propertyTitle, bookingId = null) => {
  if (!guestEmail) {
    console.warn('Cannot notify guest: No guest email provided');
    return null;
  }
  
  const formattedAmount = `₦${amount.toLocaleString()}`;
  
  return await addNotification(
    NOTIFICATION_TYPES.PAYMENT,
    'Payment Requested',
    `Host has requested payment of ${formattedAmount} for your booking at "${propertyTitle}". Please approve to release funds.`,
    guestEmail // Send to guest's email
  );
};

/**
 * Get all notifications
 */
export const getNotifications = async (userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      // Fallback to old key for backward compatibility during migration
      const notificationsJson = await AsyncStorage.getItem('notifications');
      return notificationsJson ? JSON.parse(notificationsJson) : [];
    }
    return await getUserNotifications(email);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      // Fallback to old key
      const notifications = await getNotifications();
      const updated = notifications.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
      return true;
    }

    const notifications = await getUserNotifications(email);
    const updated = notifications.map(notif => 
      notif.id === notificationId ? { ...notif, read: true } : notif
    );
    await saveUserNotifications(email, updated);
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId, userEmail = null) => {
  try {
    const email = userEmail || await getCurrentUserEmail();
    if (!email) {
      // Fallback to old key
      const notifications = await getNotifications();
      const updated = notifications.filter(notif => notif.id !== notificationId);
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
      return true;
    }

    const notifications = await getUserNotifications(email);
    const updated = notifications.filter(notif => notif.id !== notificationId);
    await saveUserNotifications(email, updated);
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userEmail = null) => {
  try {
    const notifications = await getNotifications(userEmail);
    return notifications.filter(notif => !notif.read).length;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

