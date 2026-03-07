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
    const medicalInfo = await profileService.getMedicalInfo(userId);
    if (!medicalInfo) return error(res, "Profile not found", 404);
    return success(res, { medical_info: medicalInfo });
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

export default { getProfile, getMedicalInfo, updateProfile, deleteProfile };
