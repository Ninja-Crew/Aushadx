import client from './client';

export const login = async (email, password) => {
  try {
    // Backend returns { success: true, data: { user, tokens } }
    const response = await client.post('/auth/login', { email, password });
    return response.data.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const register = async (userData) => {
  try {
    const response = await client.post('/auth/signup', userData);
    return response.data.data;
  } catch (error) {
    console.error("Register error:", error);
    throw error.response ? error.response.data : error;
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
