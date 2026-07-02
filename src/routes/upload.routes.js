import { Router } from "express";
import { deletePropertyImage, uploadMultipleImages, uploadPropertyImages, uploadSingleImage } from "../controllers/upload.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validatePropertyId } from "../middleware/property.validation.js";
import { handleMulterError, upload } from "../middleware/upload.middleware.js";

const router = Router();

router.use(protect, authorizeRoles("admin", "superadmin"));

router.post("/single", upload.single("image"), handleMulterError, uploadSingleImage);
router.post("/multiple", upload.array("images", 10), handleMulterError, uploadMultipleImages);
router.post("/properties", upload.array("images", 10), handleMulterError, uploadMultipleImages);

router.post(
  "/properties/:propertyId/images",
  validatePropertyId,
  upload.array("images", 10),
  handleMulterError,
  uploadPropertyImages
);

router.delete("/properties/:propertyId/images", validatePropertyId, deletePropertyImage);

export default router;
