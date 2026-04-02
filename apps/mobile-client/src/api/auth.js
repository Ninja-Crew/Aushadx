import client from "./client";

export const login = async (email, password) => {
  try {
    // Backend returns { success: true, data: { user, tokens } }
    const response = await client.post("/auth/login", { email, password });
    return response.data.data;
  } catch (error) {
    console.error("Login error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

export const register = async (userData) => {
  try {
    const response = await client.post("/auth/signup", userData);
    return response.data.data;
  } catch (error) {
    console.error("Register error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

export const refreshTokenCall = async (refreshToken) => {
  try {
    const response = await client.post("/auth/refresh", { refreshToken });
    return response.data.data;
  } catch (error) {
    console.error("Refresh token error:", error);
    throw error;
  }
};

/**
 * Request OTP for email verification during registration
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's name
 * @returns {Promise} { otpToken, message, expiresIn, email }
 */
export const requestOTP = async (email, password, name) => {
  try {
    const response = await client.post("/auth/request-otp", {
      email,
      password,
      name,
    });
    return response.data.data;
  } catch (error) {
    console.error("Request OTP error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

/**
 * Verify OTP and complete registration
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's name
 * @param {string} otpToken - JWT token containing OTP
 * @param {string} otp - 6-digit OTP entered by user
 * @returns {Promise} { user, tokens }
 */
export const verifyOTP = async (email, password, name, otpToken, otp) => {
  try {
    const response = await client.post("/auth/verify-otp", {
      email,
      password,
      name,
      otpToken,
      otp,
    });
    return response.data.data;
  } catch (error) {
    console.error("Verify OTP error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

/**
 * Request OTP for password reset
 * @param {string} email - User's email
 * @returns {Promise} { otpToken, message, expiresIn, email }
 */
export const forgotPassword = async (email) => {
  try {
    const response = await client.post("/auth/forgot-password", { email });
    return response.data.data;
  } catch (error) {
    console.error("Forgot password error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

/**
 * Verify OTP during password reset to get authorized session token
 * @param {string} email - User's email
 * @param {string} otpToken - JWT token containing OTP
 * @param {string} otp - 6-digit OTP entered by user
 * @returns {Promise} { resetSessionToken, message }
 */
export const verifyResetOTP = async (email, otpToken, otp) => {
  try {
    const response = await client.post("/auth/verify-reset-otp", {
      email,
      otpToken,
      otp,
    });
    return response.data.data;
  } catch (error) {
    console.error("Verify reset OTP error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};

/**
 * Reset password using the authorized session token
 * @param {string} email - User's email
 * @param {string} newPassword - New password
 * @param {string} resetSessionToken - 10m JWT authorized token
 * @returns {Promise} { message }
 */
export const resetPassword = async (email, newPassword, resetSessionToken) => {
  try {
    const response = await client.post("/auth/reset-password", {
      email,
      newPassword,
      resetSessionToken,
    });
    return response.data.data;
  } catch (error) {
    console.error("Reset password error:", error?.response?.data || error);
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
};
