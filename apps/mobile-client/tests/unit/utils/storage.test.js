import { saveToken, getToken, getRefreshToken, removeToken } from '../../../src/utils/storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('Storage Utils Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveToken', () => {
    it('should save token and refresh token securely', async () => {
      await saveToken('access_token', 'refresh_token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('user_token', 'access_token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh_token');
    });

    it('should save only token if refresh token is not provided', async () => {
      await saveToken('access_token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('user_token', 'access_token');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('refresh_token', undefined);
    });
  });

  describe('getToken', () => {
    it('should return the saved token', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('access_token');
      const token = await getToken();
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('user_token');
      expect(token).toBe('access_token');
    });

    it('should return null if token is not found', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);
      const token = await getToken();
      expect(token).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return the saved refresh token', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('refresh_token');
      const token = await getRefreshToken();
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('refresh_token');
      expect(token).toBe('refresh_token');
    });
  });

  describe('removeToken', () => {
    it('should delete both user and refresh tokens', async () => {
      await removeToken();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });
  });
});
