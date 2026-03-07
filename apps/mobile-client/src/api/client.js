import axios from 'axios';
import { Platform } from 'react-native';
import { BASE_URL } from '@env';
import { getToken, getRefreshToken, saveToken, removeToken } from '../utils/storage';
import { navigate, replace } from '../navigation/navigationRef';

const getBaseUrl = () => {
  if (Platform.OS === 'android' && BASE_URL.includes('localhost')) {
    return BASE_URL.replace('localhost', '192.168.0.106');
  }
  return BASE_URL;
};




const client = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        
        // Use a new instance or fetch to avoid interceptors
        // Accessing backend directly via full URL constructed from getBaseUrl()
        const response = await axios.post(`${getBaseUrl()}/auth/refresh`, { refreshToken });
        
        // Backend returns wrapped response: { success: true, data: { tokens: { accessToken, refreshToken } } }
        const { tokens } = response.data.data;
        
        await saveToken(tokens.accessToken, tokens.refreshToken);
        
        // Initializing headers object if undefined
        if (!originalRequest.headers) {
             originalRequest.headers = {};
        }

        client.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        
        return client(originalRequest);
      } catch (refreshError) {
        console.error('RefreshToken failed:', refreshError);
        await removeToken();
        // Replace to Login to clear stack
        replace('Login');
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
