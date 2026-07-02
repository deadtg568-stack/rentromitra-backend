import webPush from "web-push";
import { Notification } from "../models/Notification.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { User } from "../models/User.js";
import { getIO, roomForUser } from "../socket.js";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || `mailto:${process.env.SUPER_ADMIN_EMAIL || "superadmin@rentromitra.com"}`;
const pushEnabled = Boolean(
  vapidPublicKey &&
    vapidPrivateKey &&
    !vapidPublicKey.startsWith("replace_with") &&
    !vapidPrivateKey.startsWith("replace_with")
);

if (pushEnabled) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function authUserId(user) {
  return (user?._id || user?.id || "").toString();
}

async function emitUnreadCount(recipientId, recipientRole) {
  const unreadCount = await Notification.countDocuments({
    recipientId: recipientId.toString(),
    recipientRole,
    isRead: false
  });

  const io = getIO();
  if (io) {
    io.to(roomForUser(recipientId.toString())).emit("notification:unread-count", { unreadCount });
  }

  return unreadCount;
}

async function sendPush(notification) {
  if (!pushEnabled) return;

  const subscriptions = await PushSubscription.find({
    recipientId: notification.recipientId,
    recipientRole: notification.recipientRole
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: subscription.keys
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            link: notification.link,
            type: notification.type,
            notificationId: notification._id
          })
        );
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await PushSubscription.deleteOne({ _id: subscription._id });
        }
      }
    })
  );
}

export async function createNotification(payload) {
  const recipientId = payload.recipientId?.toString();
  if (!recipientId || !payload.recipientRole) return null;

  const notification = await Notification.create({
    recipientId,
    recipientRole: payload.recipientRole,
    senderId: payload.senderId?.toString(),
    senderRole: payload.senderRole,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link || "/"
  });

  const unreadCount = await emitUnreadCount(recipientId, payload.recipientRole);
  const io = getIO();
  if (io) {
    io.to(roomForUser(recipientId)).emit("notification:new", { notification, unreadCount });
  }

  await sendPush(notification);
  return notification;
}

export async function refreshUnreadCountForUser(user) {
  return emitUnreadCount(authUserId(user), user.role);
}

export async function notifyChatMessage({ conversation, message, sender }) {
  const senderId = authUserId(sender || message.sender);
  const receiverId = (message.receiver?._id || message.receiver || conversation.participants?.find((participant) => participant.toString() !== senderId))?.toString();
  if (!receiverId || receiverId === senderId) return null;

  const receiver = message.receiver?.role ? message.receiver : await User.findById(receiverId).select("role");
  const senderName = sender?.name || message.sender?.name || "Rentomitra";

  return createNotification({
    recipientId: receiverId,
    recipientRole: receiver?.role || "user",
    senderId,
    senderRole: sender?.role || message.sender?.role,
    type: "message",
    title: `New message from ${senderName}`,
    body: message.message,
    link: `/chat?conversation=${conversation._id}`
  });
}

export async function notifyBookingCreated({ booking, property, sender }) {
  const ownerId = (property?.owner?._id || property?.owner || booking.property?.owner?._id || booking.property?.owner)?.toString();
  if (!ownerId) return null;

  const propertyTitle = property?.title || booking.property?.title || "your property";
  return createNotification({
    recipientId: ownerId,
    recipientRole: "admin",
    senderId: authUserId(sender || booking.user),
    senderRole: "user",
    type: "booking",
    title: "New booking request",
    body: `${sender?.name || booking.user?.name || "A user"} requested ${propertyTitle}.`,
    link: "/admin/bookings"
  });
}

export async function notifyBookingStatus({ booking, status, sender }) {
  const userId = (booking.user?._id || booking.user)?.toString();
  if (!userId) return null;

  const propertyTitle = booking.property?.title || "your booking";
  return createNotification({
    recipientId: userId,
    recipientRole: "user",
    senderId: authUserId(sender),
    senderRole: sender?.role || "admin",
    type: "booking",
    title: `Booking ${status}`,
    body: `${propertyTitle} was ${status}.`,
    link: "/user/dashboard"
  });
}

export async function notifyPropertyApprovalRequest({ property, sender }) {
  return createNotification({
    recipientId: "superadmin",
    recipientRole: "superadmin",
    senderId: authUserId(sender),
    senderRole: "admin",
    type: "property",
    title: "New property approval request",
    body: `${property.title} is waiting for review.`,
    link: "/superadmin/approve-properties"
  });
}

export async function notifyPropertyApprovalStatus({ property, status, sender }) {
  const ownerId = (property.owner?._id || property.owner)?.toString();
  if (!ownerId) return null;

  return createNotification({
    recipientId: ownerId,
    recipientRole: "admin",
    senderId: authUserId(sender),
    senderRole: "superadmin",
    type: "approval",
    title: `Property ${status}`,
    body: `${property.title} was ${status} by Super Admin.`,
    link: "/admin/manage-properties"
  });
}
