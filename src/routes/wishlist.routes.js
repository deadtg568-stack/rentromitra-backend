import { Router } from "express";
import { listWishlist, toggleWishlist } from "../controllers/wishlist.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect, authorizeRoles("user"));
router.get("/", listWishlist);
router.post("/:propertyId", toggleWishlist);

export default router;
