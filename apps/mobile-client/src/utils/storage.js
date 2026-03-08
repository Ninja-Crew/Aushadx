import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// ... existing imports

// ... existing isWeb check

export const saveToken = async (token, refreshToken) => {
  if (isWeb) {
    try {
      await AsyncStorage.setItem('user_token', token);
      if (refreshToken) await AsyncStorage.setItem('refresh_token', refreshToken);
    } catch (e) {
      console.error('Error saving token (Web):', e);
    }
  } else {
    try {
      await SecureStore.setItemAsync('user_token', token);
      if (refreshToken) await SecureStore.setItemAsync('refresh_token', refreshToken);
    } catch (e) {
      console.error('Error saving token (Native):', e);
    }
  }
};

export const getToken = async () => {
  // ... existing implementation
  if (isWeb) {
    try {
      return await AsyncStorage.getItem('user_token');
    } catch (e) {
      console.error('Error getting token (Web):', e);
      return null;
    }
  } else {
    try {
      return await SecureStore.getItemAsync('user_token');
    } catch (e) {
      console.error('Error getting token (Native):', e);
      return null;
    }
  }
};

export const getRefreshToken = async () => {
  if (isWeb) {
    try {
      return await AsyncStorage.getItem('refresh_token');
    } catch (e) {
      console.error('Error getting refresh token (Web):', e);
      return null;
    }
  } else {
    try {
      return await SecureStore.getItemAsync('refresh_token');
    } catch (e) {
      console.error('Error getting refresh token (Native):', e);
      return null;
    }
  }
};

export const removeToken = async () => {
    if (isWeb) {
        try {
            await AsyncStorage.removeItem('user_token');
            await AsyncStorage.removeItem('refresh_token');
        } catch (e) {
            console.error('Error removing token (Web):', e);
        }
    } else {
        try {
            await SecureStore.deleteItemAsync('user_token');
            await SecureStore.deleteItemAsync('refresh_token');
        } catch (e) {
            console.error('Error removing token (Native):', e);
        }
    }
};
