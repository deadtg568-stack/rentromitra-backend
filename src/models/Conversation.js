import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    lastMessage: { type: String, default: "" },
    lastMessageAt: Date,
    lastSender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    unreadCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ property: 1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
