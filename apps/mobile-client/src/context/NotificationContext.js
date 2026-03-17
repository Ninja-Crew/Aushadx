import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import notifee from '@notifee/react-native';

import { getMissedReminders, takeReminder, snoozeReminder, getPendingCount } from '../api/reminders';
import { getToken } from '../utils/storage';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshNotifications = useCallback(async () => {
     setLoading(true);
     try {
        const token = await getToken();
        if (token) {
          // Pull both: list for screen, count for badge
          const [listData, count] = await Promise.all([
            getMissedReminders(token),
            getPendingCount(token)
          ]);
          setNotifications(listData.notifications || []);
          setUnreadCount(count);
        }
     } catch (e) {
        console.error("Context refresh error", e);
     } finally {
        setLoading(false);
     }
  }, []);

  useEffect(() => {
    refreshNotifications();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshNotifications();
        notifee.cancelAllNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshNotifications]);

  const decrementUnread = useCallback(() => setUnreadCount(prev => Math.max(0, prev - 1)), []);

  const addNotificationToContext = useCallback(async () => {
    await refreshNotifications();
  }, [refreshNotifications]);
  
  const removeNotificationFromContext = useCallback(async (reminderId) => {
    // Optimistic removal from local list done in screen, 
    // but context should also stay semi-consistent or just refresh
    setNotifications(prev => prev.filter(n => n.reminderId !== reminderId));
    decrementUnread();
  }, [decrementUnread]);

  return (
    <NotificationContext.Provider value={{ 
      unreadCount, 
      decrementUnread,
      notifications,
      loading,
      addNotification: addNotificationToContext,
      removeNotification: removeNotificationFromContext,
      refreshNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => useContext(NotificationContext);
