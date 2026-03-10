import client from './client';

export const login = async (email, password) => {
  try {
    // Backend returns { success: true, data: { user, tokens } }
    const response = await client.post('/auth/login', { email, password });
    return response.data.data;
  } catch (error) {
    console.error("Login error:", error?.response?.data || error);
    const msg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
    throw new Error(msg);
  }
};

export const register = async (userData) => {
  try {
    const response = await client.post('/auth/signup', userData);
    return response.data.data;
  } catch (error) {
    console.error("Register error:", error?.response?.data || error);
    const msg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
    throw new Error(msg);
  }
};

export const refreshTokenCall = async (refreshToken) => {
    try {
        const response = await client.post('/auth/refresh', { refreshToken });
        return response.data.data;
    } catch (error) {
        console.error("Refresh token error:", error);
        throw error;
    }
};
