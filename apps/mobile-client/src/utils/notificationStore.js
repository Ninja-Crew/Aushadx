import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = '@medicine_notifications';

export const getStoredNotifications = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to get notifications', e);
    return [];
  }
};

export const saveNotification = async (notif) => {
  try {
    let notifications = await getStoredNotifications();
    const existingIndex = notifications.findIndex(n => n.reminderId === notif.reminderId);
    
    if (existingIndex >= 0) {
      notifications[existingIndex] = notif;
    } else {
      notifications = [notif, ...notifications];
    }
    
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(notifications));
    return notifications;
  } catch (e) {
    console.error('Failed to save notification', e);
    return [];
  }
};

export const removeStoredNotification = async (reminderId) => {
  try {
    let notifications = await getStoredNotifications();
    notifications = notifications.filter(n => n.reminderId !== reminderId);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(notifications));
    return notifications;
  } catch (e) {
    console.error('Failed to remove notification', e);
    return [];
  }
};

export const clearAllStoredNotifications = async () => {
  try {
    await AsyncStorage.removeItem(STORE_KEY);
  } catch (e) {
    console.error('Failed to clear notifications', e);
  }
};
