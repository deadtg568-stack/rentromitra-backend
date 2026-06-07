import { Router } from "express";
import {
  createProperty,
  deleteProperty,
  getProperty,
  listManagedProperties,
  listProperties,
  searchProperties,
  updateProperty
} from "../controllers/property.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validatePropertyId, validatePropertyPayload, validatePropertyQuery } from "../middleware/property.validation.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { handleMulterError, upload } from "../middleware/upload.middleware.js";

const router = Router();

router.get("/", validatePropertyQuery, listProperties);
router.get("/search", validatePropertyQuery, searchProperties);
router.get("/manage", protect, authorizeRoles("admin", "superadmin"), listManagedProperties);
router.get("/:id", validatePropertyId, getProperty);
router.post("/", protect, authorizeRoles("admin"), upload.array("images", 10), handleMulterError, validatePropertyPayload, createProperty);
router.patch("/:id", protect, authorizeRoles("admin", "superadmin"), validatePropertyId, upload.array("images", 10), handleMulterError, validatePropertyPayload, updateProperty);
router.delete("/:id", protect, authorizeRoles("admin", "superadmin"), validatePropertyId, deleteProperty);

export default router;
