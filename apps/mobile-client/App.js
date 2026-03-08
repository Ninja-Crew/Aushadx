import 'react-native-gesture-handler'; // MUST BE AT THE TOP
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import {
  getMessaging,
  requestPermission,
  getToken,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, AndroidBadgeIconType, EventType } from '@notifee/react-native';
import { updateFcmToken } from './src/api/profile';
import { getToken as getStoredToken } from './src/utils/storage';
import { takeReminder, snoozeReminder } from './src/api/reminders';
import { saveNotification, removeStoredNotification } from './src/utils/notificationStore';
import { NotificationProvider, useNotificationContext } from './src/context/NotificationContext';

async function displayReminderNotification(remoteMessage) {
  if (!remoteMessage || !remoteMessage.data) {
    console.log('Skipping notification display: no remoteMessage data');
    return;
  }

  const channelId = await notifee.createChannel({
    id: 'reminders',
    name: 'Medicine Reminders',
    importance: AndroidImportance.HIGH,
    badge: true, // Show badge on app icon
  });

  await notifee.displayNotification({
    id: remoteMessage.data?.reminderId,
    title: remoteMessage.notification?.title || remoteMessage.data?.title,
    body: remoteMessage.notification?.body || remoteMessage.data?.body,
    data: remoteMessage.data || {}, // Pass reminderId and other data directly
    android: {
      channelId,
      smallIcon: 'ic_launcher',
      visibility: AndroidVisibility.PUBLIC,
      badgeIconType: AndroidBadgeIconType.LARGE,
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: remoteMessage.data?.actions ? JSON.parse(remoteMessage.data.actions) : [],
    },
  });
}

// Background handler for Firebase Messaging (must be outside component)
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  
  const { title, body, reminderId } = remoteMessage.data || {};
  if (reminderId) {
    await saveNotification({
       reminderId,
       medicineName: body?.replace('Time to take ', '').split(' (')[0] || 'Unknown',
       scheduledTime: new Date().toISOString(),
       timeSinceMissedMinutes: 0
    });
  }
  
  await displayReminderNotification(remoteMessage);
});

// Background handler for Notifee interactions (e.g. Snooze / Take actions)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Notifee background event', type, detail?.pressAction?.id || 'none');
  
  if (type === EventType.ACTION_PRESS && detail.pressAction) {
    const { notification } = detail;
    const actionId = detail.pressAction.id;
    const reminderId = notification.data?.reminderId;
    
    if (reminderId) {
      try {
        // Optimistically remove from persistent background store
        await removeStoredNotification(reminderId);

        const token = await getStoredToken();
        if (token) {
          if (actionId === 'take') {
            console.log(`User pressed TAKE for reminder ${reminderId}`);
            await takeReminder(token, reminderId);
          } else if (actionId === 'snooze') {
            console.log(`User pressed SNOOZE for reminder ${reminderId}`);
            await snoozeReminder(token, reminderId);
          }
        } else {
          console.warn('Cannot process notification action: User is not logged in');
        }
      } catch (err) {
        console.error('Failed to process notification action:', err);
      }
    }

    // Dismiss the notification after action is pressed
    if (notification.id) {
      await notifee.cancelNotification(notification.id);
    }
  }
});

function Root() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

function FCMManager() {
  const { addNotification } = useNotificationContext();

  React.useEffect(() => {
    const messaging = getMessaging();

    // Request permission for push notifications
    const requestUserPermission = async () => {
      const authStatus = await requestPermission(messaging);
      
      // Also request permission explicitly for Notifee (required for Android 13+)
      await notifee.requestPermission();

      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        const fcmToken = await getToken(messaging);

        // Save FCM Token if the user is already logged in
        const userToken = await getStoredToken();
        if (userToken && fcmToken) {
           try {
             await updateFcmToken(userToken, fcmToken, 'add');
             console.log('FCM Token submitted to backend.');
           } catch (err) {
             console.error('Failed to submit FCM token', err);
           }
        }
      }
    };

    // Create a Notifee notification channel for Android
    const createChannel = async () => {
      await notifee.createChannel({
        id: 'reminders',
        name: 'Medicine Reminders',
        importance: AndroidImportance.HIGH,
        badge: true,
      });
    };

    // Foreground message handler
    const unsubscribe = onMessage(messaging, async remoteMessage => {
      console.log('A new FCM message arrived in foreground!', JSON.stringify(remoteMessage));
      
      const { title, body, reminderId } = remoteMessage.data || {};
      if (reminderId) {
        addNotification({
           reminderId,
           medicineName: body?.replace('Time to take ', '').split(' (')[0] || 'Unknown',
           scheduledTime: new Date().toISOString(),
           timeSinceMissedMinutes: 0
        });
      }
    });

    // Populate the context with any missed background notifications still in the Android tray
    const loadBackgroundPushes = async () => {
       const displayed = await notifee.getDisplayedNotifications();
       displayed.forEach(notification => {
          const data = notification.notification?.data || {};
          const reminderId = data.reminderId || notification.id;
          if (reminderId) {
             addNotification({
               reminderId,
               medicineName: (notification.notification?.body || '').replace('Time to take ', '').split(' (')[0] || 'Unknown',
               scheduledTime: new Date().toISOString(),
               timeSinceMissedMinutes: 0
             });
          }
       });
    };

    requestUserPermission();
    createChannel();
    loadBackgroundPushes();

    return unsubscribe;
  }, [addNotification]);

  return null;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <SafeAreaProvider>
          <FCMManager />
          <Root />
        </SafeAreaProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
