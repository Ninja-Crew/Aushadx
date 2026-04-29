import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../../src/screens/LoginScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff' },
    isDark: false,
  }),
}));

jest.mock('../../../src/api/auth', () => ({
  login: jest.fn(),
}));

jest.mock('../../../src/utils/storage', () => ({
  saveToken: jest.fn(),
}));

describe('Auth Flow Integration', () => {
  const mockNavigation = { replace: jest.fn() };
  const authApi = require('../../../src/api/auth');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows user to type credentials and login', async () => {
    authApi.login.mockResolvedValueOnce({
      tokens: { access: 'access_token', refresh: 'refresh_token' },
      user: { name: 'Test' }
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Email Address'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');

    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockNavigation.replace).toHaveBeenCalledWith('MainTabs', {
        token: 'access_token',
        user: { name: 'Test' }
      });
    });
  });
});
