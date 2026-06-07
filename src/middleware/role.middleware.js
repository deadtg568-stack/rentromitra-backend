import { ApiError } from "../utils/apiError.js";

// Allows a route to be accessed only by one of the supplied roles.
export function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    next();
  };
}
