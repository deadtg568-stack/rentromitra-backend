import { Router } from "express";
import { createComplaint, listComplaints, updateComplaint } from "../controllers/complaint.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect);
router.post("/", authorizeRoles("user"), createComplaint);
router.get("/", authorizeRoles("user", "admin", "superadmin"), listComplaints);
router.patch("/:id", authorizeRoles("admin", "superadmin"), updateComplaint);

export default router;
