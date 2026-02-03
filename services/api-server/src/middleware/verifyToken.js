import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

function loadPublicKey() {
  const p = process.env.JWT_PUBLIC_KEY_PATH;
  if (p) {
    try {
      const resolved = path.isAbsolute(p) ? p : path.resolve(p);
      return fs.readFileSync(resolved, "utf8");
    } catch (err) {
      // fall through to raw env
    }
  }
  if (process.env.JWT_PUBLIC_KEY) return process.env.JWT_PUBLIC_KEY;
  return null;
}

const PUBLIC_KEY = loadPublicKey();

export default function verifyToken(req, res, next) {
  const auth =
    req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith("Bearer "))
    return res
      .status(401)
      .json({ success: false, message: "Missing Authorization" });
  const token = auth.split(" ")[1];
  if (!PUBLIC_KEY)
    return res
      .status(500)
      .json({
        success: false,
        message: "Public key not configured on API server",
      });
  try {
    const payload = jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] });
    req.user = payload;
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid token", details: err.message });
  }
}
