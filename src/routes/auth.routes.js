import { Router } from "express";
import { login, me, register, registerAdmin, createAdmin } from "../controllers/auth.controller.js";
import { protect, superAdminOnly } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/user/register", register);
router.post("/admin/register", registerAdmin);
router.post("/login", login);
router.get("/me", protect, me);
router.post("/create-admin", protect, superAdminOnly, createAdmin);

export default router;
