import { Notification } from "../models/Notification.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { ApiError } from "../utils/apiError.js";
import { authUserId, refreshUnreadCountForUser } from "../services/notification.service.js";

function ownerFilter(user) {
  return { recipientId: authUserId(user), recipientRole: user.role };
}

export async function listNotifications(req, res, next) {
  try {
    const filter = ownerFilter(req.user);
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ ...filter, isRead: false })
    ]);

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req.user) },
      { isRead: true },
      { new: true }
    );

    if (!notification) throw new ApiError(404, "Notification not found");
    const unreadCount = await refreshUnreadCountForUser(req.user);
    res.json({ success: true, notification, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany(ownerFilter(req.user), { isRead: true });
    const unreadCount = await refreshUnreadCountForUser(req.user);
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req.user) });
    if (!notification) throw new ApiError(404, "Notification not found");
    const unreadCount = await refreshUnreadCountForUser(req.user);
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function savePushSubscription(req, res, next) {
  try {
    const { endpoint, expirationTime, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new ApiError(400, "Invalid push subscription");
    }

    const filter = { endpoint };
    const update = {
      ...ownerFilter(req.user),
      endpoint,
      expirationTime,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    };

    const subscription = await PushSubscription.findOneAndUpdate(filter, update, { new: true, upsert: true });
    res.status(201).json({ success: true, subscription });
  } catch (error) {
    next(error);
  }
}

export async function removePushSubscription(req, res, next) {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) throw new ApiError(400, "Endpoint is required");
    await PushSubscription.deleteOne({ endpoint, ...ownerFilter(req.user) });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
