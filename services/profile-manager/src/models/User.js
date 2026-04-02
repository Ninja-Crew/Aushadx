import mongoose from "mongoose";

const { Schema } = mongoose;

const GENDERS = ["male", "female", "other", "prefer_not_to_say", "unknown"];
const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "unknown",
];

const userSchema = new Schema(
  {
    // Authentication fields
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },

    // Basic identity
    name: { type: String, required: true },

    // Profile fields
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    date_of_birth: { type: Date },
    dateOfBirth: { type: Date }, // added for mobile client compatibility
    gender: { type: String, enum: GENDERS, default: "unknown" },

    // Extended Medical Info
    medicalInfo: {
      bloodType: { type: String, enum: BLOOD_GROUPS, default: "unknown" },
      height: { type: Number },
      weight: { type: Number },
      allergies: { type: [String], default: [] },
      medical_history: { type: [String], default: [] },
    },

    fcmTokens: { type: [String], default: [] },

    // Meta
    roles: { type: [String], default: ["user"] },
    is_active: { type: Boolean, default: true },
    last_login_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: age derived from date_of_birth
userSchema.virtual("age").get(function () {
  if (!this.date_of_birth) return null;
  const diff = Date.now() - this.date_of_birth.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
});

// Normalize email before save
userSchema.pre("save", async function () {
  if (this.email) {
    this.email = String(this.email).toLowerCase().trim();
  }
});

// Ensure medical_history is always an array of strings
userSchema.pre("save", async function () {
  if (
    this.medicalInfo &&
    this.medicalInfo.medical_history &&
    !Array.isArray(this.medicalInfo.medical_history)
  ) {
    this.medicalInfo.medical_history = String(this.medicalInfo.medical_history)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
});

const User =
  mongoose.models && mongoose.models.User
    ? mongoose.models.User
    : mongoose.model("User", userSchema);

export default User;
