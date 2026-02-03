export function success(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function error(
  res,
  message = "An error occurred",
  status = 500,
  details = undefined
) {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

export default { success, error };
