import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      required: true,
      index: true
    },
    endpoint: { type: String, required: true, unique: true },
    expirationTime: Date,
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ recipientId: 1, recipientRole: 1 });

export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
