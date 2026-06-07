import { Router } from "express";
import { createBooking, listBookings, updateBookingStatus } from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect);
router.get("/", listBookings);
router.post("/", authorizeRoles("user"), createBooking);
router.patch("/:id/status", authorizeRoles("admin", "superadmin"), updateBookingStatus);

export default router;
