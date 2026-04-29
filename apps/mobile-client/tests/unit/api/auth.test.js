import {
  login,
  register,
  refreshTokenCall,
  requestOTP,
  verifyOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
} from '../../../src/api/auth';
import client from '../../../src/api/client';

// Mock the client
jest.mock('../../../src/api/client', () => ({
  post: jest.fn(),
}));

describe('Auth API unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login and return user and tokens', async () => {
      const mockData = {
        data: {
          data: {
            user: { id: 1, email: 'test@example.com' },
            tokens: { access: 'access_token', refresh: 'refresh_token' },
          },
        },
      };
      client.post.mockResolvedValueOnce(mockData);

      const result = await login('test@example.com', 'password123');

      expect(client.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual(mockData.data.data);
    });

    it('should throw an error if login fails', async () => {
      const errorMsg = 'Invalid credentials';
      client.post.mockRejectedValueOnce({
        response: { data: { error: errorMsg } },
      });

      await expect(login('test@example.com', 'wrong_pass')).rejects.toThrow(errorMsg);
    });
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      const mockData = { data: { data: { message: 'Registration initiated' } } };
      client.post.mockResolvedValueOnce(mockData);

      const userData = { email: 'new@example.com', password: 'password', name: 'New User' };
      const result = await register(userData);

      expect(client.post).toHaveBeenCalledWith('/auth/signup', userData);
      expect(result).toEqual(mockData.data.data);
    });
  });

  describe('refreshTokenCall', () => {
    it('should refresh token successfully', async () => {
      const mockData = { data: { data: { tokens: { access: 'new_access' } } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await refreshTokenCall('refresh_token');

      expect(client.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh_token' });
      expect(result).toEqual(mockData.data.data);
    });
  });

  describe('OTP functions', () => {
    it('requestOTP should work', async () => {
      const mockData = { data: { data: { otpToken: 'token' } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await requestOTP('test@example.com', 'pass', 'Name');
      expect(client.post).toHaveBeenCalledWith('/auth/request-otp', {
        email: 'test@example.com',
        password: 'pass',
        name: 'Name',
      });
      expect(result).toEqual(mockData.data.data);
    });

    it('verifyOTP should work', async () => {
      const mockData = { data: { data: { user: {}, tokens: {} } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await verifyOTP('test@example.com', 'pass', 'Name', 'token', '123456');
      expect(result).toEqual(mockData.data.data);
    });

    it('forgotPassword should work', async () => {
      const mockData = { data: { data: { otpToken: 'token' } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await forgotPassword('test@example.com');
      expect(result).toEqual(mockData.data.data);
    });

    it('verifyResetOTP should work', async () => {
      const mockData = { data: { data: { resetSessionToken: 'session_token' } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await verifyResetOTP('test@example.com', 'token', '123456');
      expect(result).toEqual(mockData.data.data);
    });

    it('resetPassword should work', async () => {
      const mockData = { data: { data: { message: 'Success' } } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await resetPassword('test@example.com', 'new_pass', 'session_token');
      expect(result).toEqual(mockData.data.data);
    });
  });
});
