import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/User.js";

// Verifies a JWT bearer token and attaches the authenticated user to req.user.
export async function protect(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.split(" ")[1] : null;

    if (!token) {
      throw new ApiError(401, "Authentication token required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "superadmin" && decoded.id === "superadmin") {
      req.user = {
        _id: "superadmin",
        id: "superadmin",
        name: "Super Admin",
        email: process.env.SUPER_ADMIN_EMAIL,
        role: "superadmin",
        isActive: true
      };
      return next();
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      throw new ApiError(401, "User is not authorized");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, "Invalid or expired token"));
  }
}

export async function superAdminOnly(req, _res, next) {
  try {
    if (req.user.role !== "superadmin") {
      throw new ApiError(403, "Access restricted to super admins only");
    }
    next();
  } catch (error) {
    next(error);
  }
}
