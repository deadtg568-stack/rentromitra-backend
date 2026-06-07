import { ApiError } from "../utils/apiError.js";
import { signToken } from "../utils/token.js";
import { User } from "../models/User.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePassword(password) {
  return String(password || "").trim();
}

function getSuperAdminCredentials() {
  return {
    email: normalizeEmail(process.env.SUPER_ADMIN_EMAIL),
    password: normalizePassword(process.env.SUPER_ADMIN_PASSWORD)
  };
}

function isSuperAdminCredentials(email, password) {
  const superAdmin = getSuperAdminCredentials();
  return Boolean(
    superAdmin.email &&
      superAdmin.password &&
      normalizeEmail(email) === superAdmin.email &&
      normalizePassword(password) === superAdmin.password
  );
}

function authResponse(user, token) {
  return {
    token,
    user: {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      city: user.city
    }
  };
}

export async function register(req, res, next) {
  try {
    const { name, email, password, phone, profileImage, city } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, "Name, email and password are required");
    }

    const exists = await User.exists({ email: normalizeEmail(email) });
    if (exists) throw new ApiError(409, "Email is already registered");

    const user = await User.create({ name, email, password, phone, profileImage, city, role: "user" });
    const token = signToken(user);
    res.status(201).json({ success: true, ...authResponse(user, token) });
  } catch (error) {
    next(error);
  }
}

export async function registerAdmin(req, res, next) {
  try {
    const { name, email, password, phone, profileImage, city } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, "Name, email and password are required");
    }

    const exists = await User.exists({ email: normalizeEmail(email) });
    if (exists) throw new ApiError(409, "Email is already registered");

    const admin = await User.create({
      name,
      email,
      password,
      phone,
      profileImage,
      city,
      role: "admin",
      isActive: true
    });
    const token = signToken(admin);
    res.status(201).json({ success: true, ...authResponse(admin, token) });
  } catch (error) {
    next(error);
  }
}

export async function superAdminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!isSuperAdminCredentials(email, password)) {
      throw new ApiError(401, "Invalid Super Admin email or password");
    }

    const superAdmin = {
      id: "superadmin",
      name: "Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL,
      role: "superadmin",
      isActive: true
    };

    const token = signToken(superAdmin);
    res.json({ success: true, ...authResponse(superAdmin, token) });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    if (isSuperAdminCredentials(email, password)) {
      const superAdmin = {
        id: "superadmin",
        name: "Super Admin",
        email: process.env.SUPER_ADMIN_EMAIL,
        role: "superadmin",
        isActive: true
      };

      const token = signToken(superAdmin);
      return res.json({ success: true, ...authResponse(superAdmin, token) });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (!user.isActive) throw new ApiError(403, "Account is disabled");

    const token = signToken(user);
    res.json({ success: true, ...authResponse(user, token) });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ success: true, user: req.user });
}

export async function createAdmin(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, "Name, email, and password are required");
    }

    const exists = await User.exists({ email: normalizeEmail(email) });
    if (exists) throw new ApiError(409, "Email is already registered");

    const admin = await User.create({ name, email, password, role: "admin", isActive: true });
    res.status(201).json({ success: true, message: "Admin account created successfully", admin });
  } catch (error) {
    next(error);
  }
}
