export function notFound(req, _res, next) {
  // Convert unmatched routes into a normal error for one consistent response shape.
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  // Global API error format consumed by the React frontend.
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}
