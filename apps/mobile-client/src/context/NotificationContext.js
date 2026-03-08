import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import notifee from '@notifee/react-native';
import { getStoredNotifications, saveNotification, removeStoredNotification, clearAllStoredNotifications } from '../utils/notificationStore';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadStore = async () => {
       const stored = await getStoredNotifications();
       setNotifications(stored);
       setUnreadCount(stored.length);
       
       // Clear OS-level notifications as the user has opened the app
       await notifee.cancelAllNotifications();
    };
    loadStore();
    
    // Auto-refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        loadStore();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const incrementUnread = useCallback(() => setUnreadCount(prev => prev + 1), []);
  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const refreshNotifications = useCallback(async () => {
     const stored = await getStoredNotifications();
     setNotifications(stored);
  }, []);
  
  const addNotificationToContext = useCallback(async (notif) => {
    const updatedList = await saveNotification(notif);
    setNotifications(updatedList);
    incrementUnread();
  }, [incrementUnread]);
  
  const removeNotificationFromContext = useCallback(async (reminderId) => {
    const updatedList = await removeStoredNotification(reminderId);
    setNotifications(updatedList);
  }, []);
  
  const clearNotificationsFromContext = useCallback(async () => {
    await clearAllStoredNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      unreadCount, 
      incrementUnread, 
      clearUnread,
      notifications,
      addNotification: addNotificationToContext,
      removeNotification: removeNotificationFromContext,
      clearNotifications: clearNotificationsFromContext,
      refreshNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => useContext(NotificationContext);
