import User from "../models/User.js";

export async function getProfile(userId) {
  return User.findById(userId).select("-password");
}

export async function getMedicalInfo(userId) {
  const user = await User.findById(userId).select(
    "blood_group medical_history date_of_birth",
  );
  if (!user) return null;

  return {
    id: user._id,
    blood_group: user.blood_group,
    medical_history: user.medical_history,
    age: user.age, // Virtual field calculated from date_of_birth
  };
}

export async function updateProfile(userId, data) {
  // allow updates to common profile fields only (no email/password changes here)
  const allowed = [
    "name",
    "date_of_birth",
    "gender",
    "blood_group",
    "medical_history",
  ];
  const up = {};
  for (const k of allowed) {
    if (k in data) up[k] = data[k];
  }

  // normalize medical_history: accept comma-separated string or array
  if (up.medical_history && typeof up.medical_history === "string") {
    up.medical_history = up.medical_history
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return User.findByIdAndUpdate(userId, up, {
    new: true,
    runValidators: true,
  }).select("-password");
}

export async function deleteProfile(userId) {
  return User.findByIdAndDelete(userId);
}

export default { getProfile, getMedicalInfo, updateProfile, deleteProfile };
