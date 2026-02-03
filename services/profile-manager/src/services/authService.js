import { hashPassword, comparePassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import User from "../models/User.js";

export async function registerUser({ email, password, name }) {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("User already exists");
  const hashed = await hashPassword(password);
  const user = await User.create({ email, password: hashed, name });
  return user;
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) return null;
  const ok = await comparePassword(password, user.password);
  if (!ok) return null;
  return user;
}

export function createTokensForUser(user) {
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    roles: user.roles,
  };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken({ sub: user._id.toString() });
  return { access, refresh };
}

export default { registerUser, authenticateUser, createTokensForUser };
