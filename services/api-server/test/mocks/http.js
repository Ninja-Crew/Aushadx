export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
