import "react-native-gesture-handler"; // MUST BE AT THE TOP
import React from "react";
import { StatusBar } from "expo-status-bar";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

// Keep the native splash screen visible while we fetch tokens/profile
SplashScreen.preventAutoHideAsync().catch(() => {});
import {
  getMessaging,
  requestPermission,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidBadgeIconType,
  EventType,
} from "@notifee/react-native";
import { updateFcmToken, registerFCMToken } from "./src/api/profile";
import { getToken as getStoredToken } from "./src/utils/storage";
import { takeReminder, snoozeReminder } from "./src/api/reminders";
import {
  NotificationProvider,
  useNotificationContext,
} from "./src/context/NotificationContext";

async function displayReminderNotification(remoteMessage) {
  if (!remoteMessage) return;

  const data = remoteMessage.data || {};
  const notification = remoteMessage.notification || {};

  const channelId = await notifee.createChannel({
    id: "reminders",
    name: "Medicine Reminders",
    importance: AndroidImportance.HIGH,
    badge: true,
  });

  await notifee.displayNotification({
    id: data.reminderId || remoteMessage.messageId,
    title: notification.title || data.title || "Medicine Reminder",
    body: notification.body || data.body || "Time to take your medicine",
    data: data,
    android: {
      channelId,
      smallIcon: "notification_icon",
      largeIcon: "ic_launcher",
      color: "#245173",
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      badgeIconType: AndroidBadgeIconType.LARGE,
      pressAction: {
        id: "default",
        launchActivity: "default",
      },
      actions: data.actions
        ? JSON.parse(data.actions)
        : [
            { title: "Take", pressAction: { id: "take" } },
            { title: "Snooze", pressAction: { id: "snooze" } },
          ],
    },
  });
}

// Background handler for Firebase Messaging (must be outside component)
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  console.log("Message handled in the background!", remoteMessage);
  await displayReminderNotification(remoteMessage);
});

// Background handler for Notifee interactions (e.g. Snooze / Take actions)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log(
    "Notifee background event",
    type,
    detail?.pressAction?.id || "none",
  );

  if (type === EventType.ACTION_PRESS && detail.pressAction) {
    const { notification } = detail;
    const actionId = detail.pressAction.id;
    const reminderId = notification.data?.reminderId;

    if (reminderId) {
      try {
        const token = await getStoredToken();
        if (token) {
          if (actionId === "take") {
            console.log(`User pressed TAKE for reminder ${reminderId}`);
            await takeReminder(token, reminderId);
          } else if (actionId === "snooze") {
            console.log(`User pressed SNOOZE for reminder ${reminderId}`);
            await snoozeReminder(token, reminderId);
          }
        }
      } catch (err) {
        console.error("Failed to process notification action:", err);
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
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}

function FCMManager() {
  const { addNotification, removeNotification } = useNotificationContext();
  const appStateRef = React.useRef(AppState.currentState);

  React.useEffect(() => {
    const messaging = getMessaging();

    // Track app state via Ref to avoid useEffect re-runs
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        // When app comes to foreground, clear Android notifications
        if (nextAppState === "active" && appStateRef.current !== "active") {
          notifee.cancelAllNotifications();
        }
        appStateRef.current = nextAppState;
      },
    );

    // Request permission for push notifications
    const requestUserPermission = async () => {
      const authStatus = await requestPermission(messaging);

      // Also request permission explicitly for Notifee (required for Android 13+)
      await notifee.requestPermission();

      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log("Authorization status:", authStatus);

        // Save FCM Token if the user is already logged in
        const userToken = await getStoredToken();
        if (userToken) {
          registerFCMToken(userToken).catch((err) =>
            console.warn(
              "[FCMManager] Soft-failure registering FCM:",
              err.message,
            ),
          );
        }
      }
    };

    // Create a Notifee notification channel for Android
    const createChannel = async () => {
      await notifee.createChannel({
        id: "reminders",
        name: "Medicine Reminders",
        importance: AndroidImportance.HIGH,
        badge: true,
      });
    };

    // Foreground message handler
    const unsubscribe = onMessage(messaging, async (remoteMessage) => {
      console.log(
        "A new FCM message arrived in foreground!",
        JSON.stringify(remoteMessage),
      );

      const { title, body, reminderId } = remoteMessage.data || {};
      const displayTitle =
        remoteMessage.notification?.title || title || "Medicine Reminder";
      const displayBody =
        remoteMessage.notification?.body ||
        body ||
        "Time to take your medicine";

      if (reminderId) {
        // If app is in foreground, refresh context (which will pull from API)
        if (appStateRef.current === "active") {
          addNotification(); // Calls refreshNotifications in context
          console.log(
            "[FCM] App in foreground - triggering context refresh",
          );
        } else {
          // If app is in background, show Android notification
          await displayReminderNotification(remoteMessage);
          console.log(
            "[FCM] App in background - shown as Android notification",
          );
        }
      }
    });

    // Populate the context with any missed background notifications still in the Android tray
    const loadBackgroundPushes = async () => {
      // API sync handles everything now.
    };

    // Unified action handler for both foreground and background Notifee events
    const handleNotificationAction = async (type, detail) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction) {
        const { notification } = detail;
        const actionId = detail.pressAction.id;
        const reminderId = notification.data?.reminderId;

        if (reminderId) {
          try {
            console.log(`[Notifee] Action "${actionId}" for reminder ${reminderId} (Type: ${type})`);
            
            const token = await getStoredToken();
            if (token) {
              if (actionId === "take") {
                await takeReminder(token, reminderId);
              } else if (actionId === "snooze") {
                await snoozeReminder(token, reminderId);
              }
              // Refresh context after action
              removeNotification(reminderId);
            }
          } catch (err) {
            console.error("[Notifee] Action processing failed:", err);
          }
        }

        if (notification.id) {
          await notifee.cancelNotification(notification.id);
        }
      }
    };

    // Foreground listener
    const unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
      handleNotificationAction(type, detail);
    });

    requestUserPermission();
    createChannel();
    loadBackgroundPushes();

    return () => {
      unsubscribe();
      unsubscribeForeground();
      appStateSubscription.remove();
    };
  }, [addNotification, removeNotification]);

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
