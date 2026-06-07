import { Router } from "express";
import {
  approveProperty,
  listPendingProperties,
  rejectProperty
} from "../controllers/property.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validatePropertyId } from "../middleware/property.validation.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect, authorizeRoles("superadmin"));
router.get("/properties/pending", listPendingProperties);
router.patch("/properties/:id/approve", validatePropertyId, approveProperty);
router.patch("/properties/:id/reject", validatePropertyId, rejectProperty);

export default router;
