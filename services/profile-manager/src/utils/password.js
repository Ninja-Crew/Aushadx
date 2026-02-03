import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export default { hashPassword, comparePassword };
