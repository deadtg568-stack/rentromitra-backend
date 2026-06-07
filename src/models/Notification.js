import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      required: true,
      index: true
    },
    senderId: { type: String },
    senderRole: {
      type: String,
      enum: ["user", "admin", "superadmin"]
    },
    type: {
      type: String,
      enum: ["message", "booking", "approval", "property"],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, default: "/" },
    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, recipientRole: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
