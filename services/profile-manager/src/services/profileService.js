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
  // 1. Cascading delete: Clear all reminders in medicine-scheduler service
  try {
    const schedulerUrl = process.env.MEDICINE_SCHEDULER_URL || "http://medicine-scheduler:3002";
    const response = await fetch(`${schedulerUrl}/reminders/user/${userId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.warn(`[profileService] Failed to clear reminders for user ${userId}: ${response.statusText}`);
    }
  } catch (err) {
    console.error(`[profileService] Error calling medicine-scheduler for user ${userId}:`, err.message);
    // We continue deleting the profile even if the scheduler cleanup fails to avoid stuck profiles,
    // though in a production system we might want more robust error handling/retries.
  }

  // 2. Delete the user profile
  return User.findByIdAndDelete(userId);
}

export async function addFcmToken(userId, token) {
  // Ensure the token is not associated with any other user
  await User.updateMany(
    { fcmTokens: token, _id: { $ne: userId } },
    { $pull: { fcmTokens: token } }
  );

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
