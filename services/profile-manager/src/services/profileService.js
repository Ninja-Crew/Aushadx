import User from "../models/User.js";

export async function getProfile(userId) {
  return User.findById(userId).select("-password -roles -is_active -__v");
}

export async function getMedicalInfo(userId) {
  const user = await User.findById(userId,{medicalInfo:1});
  return user;
}

export async function updateProfile(userId, data) {
  // allow updates to common profile fields only (no email/password changes here)
  const allowed = [
    "name",
    "phone",
    "address",
    "dateOfBirth",
    "date_of_birth",
    "gender",
    "medicalInfo",
  ];
  const up = {};
  for (const k of allowed) {
    if (k in data) up[k] = data[k];
  }

  return User.findByIdAndUpdate(userId, up, {
    new: true,
    runValidators: true,
  }).select("-password");
}

export async function deleteProfile(userId) {
  return User.findByIdAndDelete(userId);
}

export async function addFcmToken(userId, token) {
  return User.findByIdAndUpdate(
    userId,
    { $addToSet: { fcmTokens: token } },
    { new: true }
  ).select("fcmTokens");
}

export async function removeFcmToken(userId, token) {
  return User.findByIdAndUpdate(
    userId,
    { $pull: { fcmTokens: token } },
    { new: true }
  ).select("fcmTokens");
}

export default { getProfile, getMedicalInfo, updateProfile, deleteProfile, addFcmToken, removeFcmToken };
