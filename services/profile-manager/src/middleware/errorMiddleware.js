export default function errorMiddleware(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ success: false, message });
}
