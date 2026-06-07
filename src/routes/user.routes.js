import { Router } from "express";
import { createAdmin, deleteUser, listUsers, updateProfile, updateUserStatus } from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect);
router.patch("/me", authorizeRoles("user", "admin", "superadmin"), updateProfile);
router.get("/", authorizeRoles("superadmin"), listUsers);
router.post("/admins", authorizeRoles("superadmin"), createAdmin);
router.patch("/:id/status", authorizeRoles("superadmin"), updateUserStatus);
router.delete("/:id", authorizeRoles("superadmin"), deleteUser);

export default router;
