import { Router } from "express";
import { listManagedProperties } from "../controllers/property.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect, authorizeRoles("admin"));
router.get("/properties", listManagedProperties);

export default router;
