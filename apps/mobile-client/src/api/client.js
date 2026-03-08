import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getToken, getRefreshToken, saveToken, removeToken } from '../utils/storage';
import { navigate, replace, navigationRef } from '../navigation/navigationRef';

// Use Expo config for environment variables
const BASE_URL = Constants.expoConfig?.extra?.baseUrl || 'http://192.168.0.107:30000';

const getBaseUrl = () => {
  if (Platform.OS === 'android' && (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1'))) {
    // Replace localhost/127.0.0.1 with Android's expected emulator host IP, keeping the rest of the url
    return BASE_URL.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }
  return BASE_URL;
};

const EXTRA_HEADERS = Constants.expoConfig?.extra?.apiHeaders || {};

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    ...EXTRA_HEADERS,
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


// ─── Token refresh queue ──────────────────────────────────────────────────────
// Prevents concurrent 401s from each triggering their own refresh call.
// All requests that fail while a refresh is in-flight are queued and replayed
// with the new token once it arrives.
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthError = status === 401 || status === 403;

    if (isAuthError && !originalRequest._retry) {
      // If a refresh is already in-flight, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      console.log(`[client] Got ${status} on ${originalRequest.url} — attempting token refresh`);

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        // Plain axios (no interceptors) to avoid infinite loop
        const response = await axios.post(`${getBaseUrl()}/auth/refresh`, { refreshToken });

        // Backend returns: { success: true, data: { tokens: { access, refresh } } }
        const { tokens } = response.data.data;

        await saveToken(tokens.access, tokens.refresh);

        client.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

        processQueue(null, tokens.access);

        console.log('[client] Token refreshed — retrying original request');
        originalRequest.headers['Authorization'] = `Bearer ${tokens.access}`;
        return client(originalRequest);
      } catch (refreshError) {
        console.error('[client] Token refresh failed:', refreshError?.response?.data || refreshError.message);
        processQueue(refreshError, null);

        // Snapshot current route so the user can resume after re-login
        const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
        if (currentRoute && currentRoute.name !== 'Login') {
          const { name, params } = currentRoute;
          const safeParams = params ? JSON.parse(JSON.stringify(params, (_, v) => typeof v === 'function' ? undefined : v)) : undefined;
          AsyncStorage.setItem('@pendingRoute', JSON.stringify({ name, params: safeParams })).catch(() => {});
        }

        await removeToken();
        replace('Login');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


export default client;

