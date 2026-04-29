import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AppNavigator from '../../src/navigation/AppNavigator';

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red' },
    isDark: false,
  }),
}));

jest.mock('../../src/context/NotificationContext', () => ({
  useNotificationContext: () => ({ refreshNotifications: jest.fn() }),
}));

jest.mock('../../src/components/BootSplash', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => <View testID="boot-splash" />;
});

jest.mock('../../src/utils/storage', () => ({
  getRefreshToken: jest.fn(),
  saveToken: jest.fn(),
}));

jest.mock('../../src/api/auth', () => ({
  refreshTokenCall: jest.fn(),
}));

describe('AppNavigator Integration', () => {
  const storage = require('../../src/utils/storage');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders BootSplash initially', async () => {
    storage.getRefreshToken.mockResolvedValueOnce(null);
    const { getByTestId } = render(<AppNavigator />);
    expect(getByTestId('boot-splash')).toBeTruthy();
  });
});
