import { Router } from "express";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removePushSubscription,
  savePushSubscription
} from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protect);

router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.post("/push-subscriptions", savePushSubscription);
router.delete("/push-subscriptions", removePushSubscription);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

export default router;
