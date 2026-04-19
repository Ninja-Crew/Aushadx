import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../../App';

// Mock expo-font to avoid loading errors in tests
jest.mock('expo-font', () => ({
  useFonts: () => [true, null]
}));

// Mock splash screen to prevent it from failing tests
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(),
  hideAsync: jest.fn().mockResolvedValue(),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(),
  requestPermission: jest.fn().mockResolvedValue(1),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('channel-id'),
    displayNotification: jest.fn(),
    onBackgroundEvent: jest.fn(),
    onForegroundEvent: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue(),
    cancelAllNotifications: jest.fn(),
    cancelNotification: jest.fn(),
  },
  AndroidImportance: { HIGH: 4 },
  AndroidVisibility: { PUBLIC: 1 },
  AndroidBadgeIconType: { LARGE: 2 },
  EventType: { ACTION_PRESS: 1 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('App Component', () => {
  it('renders without crashing', () => {
    // Basic smoke test to ensure the app boots up and context providers mount successfully
    const { toJSON } = render(<App />);
    expect(toJSON()).toBeDefined();
  });
});
