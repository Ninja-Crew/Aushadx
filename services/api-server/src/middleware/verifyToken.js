import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";

dotenv.config();

// Initialize the JWKS client
// Point to Profile Manager's JWKS endpoint
const client = jwksClient({
  jwksUri: process.env.JWKS_URI || "http://localhost:3000/.well-known/jwks.json",
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

// Helper to get the signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, function(err, key) {
    if (err) {
        console.error("Error fetching signing key", err);
        return callback(err, null);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verifies a JWT token using JWKS.
 * Returns a Promise that resolves to the decoded token or rejects with an error.
 * @param {string} token 
 * @returns {Promise<object>}
 */
export const verifyJWT = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
      if (err) {
        return reject(err);
      }
      resolve(decoded);
    });
  });
};

export default function verifyToken(req, res, next) {
  const auth =
    req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth)
    return res
      .status(401)
      .json({ success: false, message: "Missing Authorization" });
  
  const token = auth.split(" ")[1];
  
  verifyJWT(token)
    .then(decoded => {
      req.user = decoded;
      next();
    })
    .catch(err => {
      res.status(401).json({ success: false, message: "Invalid token", details: err.message });
    });
}
