import { ApiError } from "../utils/apiError.js";
import { User } from "../models/User.js";

export async function listUsers(req, res, next) {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(req, res, next) {
  try {
    const { name, email, password, phone, city } = req.body;
    const exists = await User.exists({ email: String(email || "").trim().toLowerCase() });
    if (exists) throw new ApiError(409, "Email is already registered");

    const admin = await User.create({ name, email, password, phone, city, role: "admin", isActive: true });
    res.status(201).json({ success: true, user: admin });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const allowedFields = ["name", "phone", "city", "profileImage"];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select("-password");
    if (!user) throw new ApiError(404, "User not found");

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) throw new ApiError(404, "User not found");
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found");
    if (user.role === "superadmin") throw new ApiError(403, "Super admin account cannot be deleted");

    await user.deleteOne();
    res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    next(error);
  }
}
