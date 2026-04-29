import client from '../../../src/api/client';
import axios from 'axios';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
import { getToken, getRefreshToken, saveToken, removeToken } from '../../../src/utils/storage';
import { replace, navigationRef } from '../../../src/navigation/navigationRef';

jest.mock('../../../src/utils/storage', () => ({
  getToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveToken: jest.fn(),
  removeToken: jest.fn(),
}));

jest.mock('../../../src/navigation/navigationRef', () => ({
  replace: jest.fn(),
  navigate: jest.fn(),
  navigationRef: {
    isReady: jest.fn().mockReturnValue(false),
    getCurrentRoute: jest.fn(),
  },
}));

describe('Client API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add Authorization header if token exists', async () => {
    getToken.mockResolvedValueOnce('test_token');
    
    // Test the request interceptor directly
    const config = { headers: {} };
    const interceptor = client.interceptors.request.handlers[0].fulfilled;
    const result = await interceptor(config);
    
    expect(getToken).toHaveBeenCalled();
    expect(result.headers.Authorization).toBe('Bearer test_token');
  });

  it('should not add Authorization header if no token', async () => {
    getToken.mockResolvedValueOnce(null);
    
    const config = { headers: {} };
    const interceptor = client.interceptors.request.handlers[0].fulfilled;
    const result = await interceptor(config);
    
    expect(result.headers.Authorization).toBeUndefined();
  });
  
  // Note: testing the response interceptor for token refresh involves mocking axios
  // deeply and the queue logic, which is complex. For unit testing, checking the basic
  // request interceptor ensures our auth injection is working.
});
