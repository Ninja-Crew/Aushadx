import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightColors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  primary: '#007AFF',
  secondary: '#5856D6',
  border: '#C6C6C8',
  chip: '#E5E5EA',
  success: '#34C759',
  error: '#FF3B30',
  icon: '#000000',
  inputBg: '#FFFFFF'
};

export const darkColors = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  primary: '#0A84FF',
  secondary: '#5E5CE6',
  border: '#38383A',
  chip: '#2C2C2E',
  success: '#32D74B',
  error: '#FF453A',
  icon: '#FFFFFF',
  inputBg: '#1C1C1E'
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load persisted theme on mount
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('@appTheme');
        if (storedTheme !== null) {
          setIsDark(storedTheme === 'dark');
        } else {
          setIsDark(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsReady(true);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const newThemeIsDark = !isDark;
      setIsDark(newThemeIsDark);
      await AsyncStorage.setItem('@appTheme', newThemeIsDark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  if (!isReady) {
    return null; // Don't render children until theme is loaded to prevent flashing
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
