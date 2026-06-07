import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["booking", "property", "payment", "owner", "tenant", "platform", "other"],
      default: "other"
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "rejected"],
      default: "open",
      index: true
    },
    resolutionNote: String,
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
