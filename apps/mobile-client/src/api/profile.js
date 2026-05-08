import client from "./client";
import { getMessaging, getToken } from "@react-native-firebase/messaging";

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
    return response.data.data
      ? response.data.data.profile
      : response.data.profile;
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
    return response.data.data
      ? response.data.data.medical_info
      : response.data.medical_info;
  } catch (error) {
    console.error("Get Medical Info error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const deleteProfile = async (token) => {
  try {
    const response = await client.delete(`/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Delete Profile error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const updateFcmToken = async (token, tokenStr, action = "add") => {
  try {
    const response = await client.patch(
      `/profile/fcm-token`,
      { token: tokenStr, action },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Update FCM Token error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const registerFCMToken = async (userToken) => {
  try {
    const messaging = getMessaging();
    const fcmToken = await getToken(messaging);
    if (fcmToken) {
      console.log("[FCM] Registering token:", fcmToken);
      await updateFcmToken(userToken, fcmToken, "add");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[FCM] Register token error:", error);
    return false;
  }
};

export const deleteFCMToken = async (userToken) => {
  try {
    const messaging = getMessaging();
    const fcmToken = await getToken(messaging);
    if (fcmToken) {
      console.log("[FCM] Deleting token:", fcmToken);
      await updateFcmToken(userToken, fcmToken, "remove");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[FCM] Delete token error:", error);
    return false;
  }
};

export const getFCMToken = async () => {
  try {
    const messaging = getMessaging();
    const fcmToken = await getToken(messaging);
    return fcmToken || null;
  } catch (error) {
    console.error("[FCM] Get token error:", error);
    return null;
  }
};
