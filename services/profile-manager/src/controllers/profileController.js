import * as profileService from "../services/profileService.js";
import { success, error } from "../utils/response.js";

export async function getProfile(req, res) {
  try {
    const userId = req.params.user_id || req.user.sub;
    const user = await profileService.getProfile(userId);
    if (!user) return error(res, "Profile not found", 404);
    return success(res, {user});
  } catch (err) {
    return error(res, "Failed to get profile", 500, err.message);
  }
}

export async function getMedicalInfo(req, res) {
  try {
    const userId = req.params.user_id || req.user.sub;
    const profile = await profileService.getMedicalInfo(userId);
    if (!profile) return error(res, "Profile not found", 404);
    return success(res, { profile });
  } catch (err) {
    return error(res, "Failed to get medical info", 500, err.message);
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.params.user_id || req.user.sub;
    const updated = await profileService.updateProfile(userId, req.body);
    return success(res, { profile: updated });
  } catch (err) {
    return error(res, "Failed to update profile", 500, err.message);
  }
}

export async function deleteProfile(req, res) {
  try {
    const userId = req.params.user_id || req.user.sub;
    await profileService.deleteProfile(userId);
    return success(res, { deleted: true });
  } catch (err) {
    return error(res, "Failed to delete profile", 500, err.message);
  }
}

export async function updateFcmToken(req, res) {
  try {
    const userId = req.params.user_id || req.user.sub;
    const { token, action } = req.body; // action: 'add' or 'remove'
    
    if (!token) return error(res, "FCM Token is required", 400);

    let updated;
    if (action === 'remove') {
      updated = await profileService.removeFcmToken(userId, token);
    } else {
      updated = await profileService.addFcmToken(userId, token);
    }

    return success(res, { fcmTokens: updated ? updated.fcmTokens : [] });
  } catch (err) {
    return error(res, "Failed to update FCM token", 500, err.message);
  }
}

export default { getProfile, getMedicalInfo, updateProfile, deleteProfile, updateFcmToken };
