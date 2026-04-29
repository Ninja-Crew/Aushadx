import {
  getProfile,
  updateProfile,
  getMedicalInfo,
  deleteProfile,
  updateFcmToken,
  registerFCMToken,
  deleteFCMToken,
  getFCMToken,
} from '../../../src/api/profile';
import client from '../../../src/api/client';
import { getMessaging, getToken } from '@react-native-firebase/messaging';

// Mock client and firebase messaging
jest.mock('../../../src/api/client', () => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
}));

describe('Profile API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should fetch and return profile user data', async () => {
      const mockData = { data: { data: { user: { id: 1, name: 'Test User' } } } };
      client.get.mockResolvedValueOnce(mockData);

      const result = await getProfile('token123');
      expect(client.get).toHaveBeenCalledWith('/profile', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual({ id: 1, name: 'Test User' });
    });
  });

  describe('updateProfile', () => {
    it('should update and return profile data', async () => {
      const mockData = { data: { data: { profile: { age: 30 } } } };
      client.put.mockResolvedValueOnce(mockData);

      const result = await updateProfile('token123', { age: 30 });
      expect(client.put).toHaveBeenCalledWith('/profile', { age: 30 }, { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual({ age: 30 });
    });
  });

  describe('getMedicalInfo', () => {
    it('should fetch medical info', async () => {
      const mockData = { data: { data: { medical_info: { bloodType: 'O+' } } } };
      client.get.mockResolvedValueOnce(mockData);

      const result = await getMedicalInfo('token123');
      expect(client.get).toHaveBeenCalledWith('/profile/medical-info', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual({ bloodType: 'O+' });
    });
  });

  describe('deleteProfile', () => {
    it('should delete profile', async () => {
      const mockData = { data: { success: true } };
      client.delete.mockResolvedValueOnce(mockData);

      const result = await deleteProfile('token123');
      expect(client.delete).toHaveBeenCalledWith('/profile', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual(mockData.data);
    });
  });

  describe('FCM Token functions', () => {
    it('updateFcmToken should work', async () => {
      const mockData = { data: { success: true } };
      client.patch.mockResolvedValueOnce(mockData);

      const result = await updateFcmToken('token123', 'fcm_token_123', 'add');
      expect(client.patch).toHaveBeenCalledWith(
        '/profile/fcm-token',
        { token: 'fcm_token_123', action: 'add' },
        { headers: { Authorization: 'Bearer token123' } }
      );
      expect(result).toEqual(mockData.data);
    });

    it('registerFCMToken should fetch and register token', async () => {
      getToken.mockResolvedValueOnce('fcm_token_123');
      client.patch.mockResolvedValueOnce({ data: { success: true } });

      const result = await registerFCMToken('token123');
      expect(getToken).toHaveBeenCalled();
      expect(client.patch).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('deleteFCMToken should fetch and remove token', async () => {
      getToken.mockResolvedValueOnce('fcm_token_123');
      client.patch.mockResolvedValueOnce({ data: { success: true } });

      const result = await deleteFCMToken('token123');
      expect(getToken).toHaveBeenCalled();
      expect(client.patch).toHaveBeenCalledWith(
        '/profile/fcm-token',
        { token: 'fcm_token_123', action: 'remove' },
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('getFCMToken should return token', async () => {
      getToken.mockResolvedValueOnce('fcm_token_123');
      const result = await getFCMToken();
      expect(result).toBe('fcm_token_123');
    });
  });
});
