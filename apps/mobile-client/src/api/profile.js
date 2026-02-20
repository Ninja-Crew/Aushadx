import client from './client';

export const getProfile = async (token) => {
  try {
    const response = await client.get(`/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data ? response.data.data.user : response.data.user;
  } catch (error) {
    console.error("Get Profile error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const updateProfile = async (token, profileData) => {
  try {
    const response = await client.put(`/profile`, profileData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data ? response.data.data.profile : response.data.profile;
  } catch (error) {
    console.error("Update Profile error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const getMedicalInfo = async (token) => {
  try {
    const response = await client.get(`/profile/medical-info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data ? response.data.data.medical_info : response.data.medical_info;
  } catch (error) {
    console.error("Get Medical Info error:", error);
    throw error.response ? error.response.data : error;
  }
};
