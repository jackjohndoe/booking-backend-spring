// Phone notification utilities using expo-notifications
// Sends notifications directly to user's phone
// Note: Notifications have limited support in Expo Go
import { Platform } from 'react-native';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification behavior (only if available)
  if (Notifications && Notifications.setNotificationHandler) {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (e) {
      // Not available in Expo Go
    }
  }
} catch (e) {
  // Notifications not available - app continues without them
}

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async () => {
  if (!Notifications) {
    return false;
  }
  
  try {
    if (!Notifications.getPermissionsAsync) {
      return false;
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted' && Notifications.requestPermissionsAsync) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }
    
    // Configure notification channel for Android
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
        });
      } catch (e) {
        // Not available in Expo Go
      }
    }
    
    return true;
  } catch (error) {
    // Not available in Expo Go - return false silently
    return false;
  }
};

/**
 * Schedule a notification for rating prompt after checkout
 */
export const scheduleRatingNotification = async (booking) => {
  if (!Notifications || !Notifications.scheduleNotificationAsync) {
    return null;
  }
  
  try {
    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    if (!booking || !booking.checkOutDate) {
      return null;
    }

    // Parse checkout date
    const checkoutDate = new Date(booking.checkOutDate);
    checkoutDate.setHours(10, 0, 0, 0); // Set to 10 AM on checkout day
    
    // If checkout date is in the past, schedule for tomorrow at 10 AM
    const now = new Date();
    const notificationDate = checkoutDate < now 
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
      : checkoutDate;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'How was your stay?',
        body: `We hope you enjoyed your stay at "${booking.title || 'the apartment'}". Tap to rate your host!`,
        data: {
          type: 'rating_prompt',
          bookingId: booking.id,
          apartmentId: booking.apartmentId,
          hostEmail: booking.hostEmail,
          apartmentTitle: booking.title,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: notificationDate,
    });

    return notificationId;
  } catch (error) {
    // Not available in Expo Go - return null silently
    return null;
  }
};

/**
 * Send immediate notification for rating prompt
 */
export const sendRatingNotification = async (booking) => {
  if (!Notifications || !Notifications.scheduleNotificationAsync) {
    return false;
  }
  
  try {
    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    if (!booking) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'How was your stay?',
        body: `We hope you enjoyed your stay at "${booking.title || 'the apartment'}". Tap to rate your host!`,
        data: {
          type: 'rating_prompt',
          bookingId: booking.id,
          apartmentId: booking.apartmentId,
          hostEmail: booking.hostEmail,
          apartmentTitle: booking.title,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    return true;
  } catch (error) {
    // Not available in Expo Go - return false silently
    return false;
  }
};

/**
 * Cancel a scheduled notification
 */
export const cancelNotification = async (notificationId) => {
  if (!Notifications || !Notifications.cancelScheduledNotificationAsync) {
    return false;
  }
  
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async () => {
  if (!Notifications || !Notifications.cancelAllScheduledNotificationsAsync) {
    return false;
  }
  
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async () => {
  if (!Notifications || !Notifications.getAllScheduledNotificationsAsync) {
    return [];
  }
  
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications;
  } catch (error) {
    return [];
  }
};



