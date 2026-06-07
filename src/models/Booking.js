import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    room: { type: mongoose.Schema.Types.ObjectId },
    moveInDate: { type: Date, required: true },
    months: { type: Number, required: true, min: 1 },
    occupants: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "completed"],
      default: "pending"
    },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: String,
    chatConversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" }
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);
