import React from 'react';
import { Text, Button } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const TestComponent = () => {
  const { isDark, colors, toggleTheme } = useTheme();
  return (
    <>
      <Text testID="theme-status">{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
      <Text testID="bg-color">{colors.background}</Text>
      <Button testID="toggle-btn" title="Toggle" onPress={toggleTheme} />
    </>
  );
};

describe('ThemeContext Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with light theme by default if nothing in storage', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Wait for async loadTheme
    await waitFor(() => {
      expect(getByTestId('theme-status').props.children).toBe('Light Mode');
    });
  });

  it('should load dark theme from storage', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('dark');

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('theme-status').props.children).toBe('Dark Mode');
    });
  });

  it('should toggle theme and save to storage', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('light');

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('theme-status').props.children).toBe('Light Mode');
    });

    fireEvent.press(getByTestId('toggle-btn'));

    await waitFor(() => {
      expect(getByTestId('theme-status').props.children).toBe('Dark Mode');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@appTheme', 'dark');
    });
  });
});
