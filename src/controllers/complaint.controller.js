import { ApiError } from "../utils/apiError.js";
import { Complaint } from "../models/Complaint.js";

const VALID_STATUSES = ["open", "in_progress", "resolved", "rejected"];

export async function createComplaint(req, res, next) {
  try {
    const { property, subject, message, category, priority } = req.body;
    if (!subject || !message) throw new ApiError(400, "Subject and message are required");

    const complaint = await Complaint.create({
      user: req.user._id,
      property,
      subject,
      message,
      category,
      priority
    });

    res.status(201).json({ success: true, complaint });
  } catch (error) {
    next(error);
  }
}

export async function listComplaints(req, res, next) {
  try {
    const filter = {};
    if (req.user.role === "user") filter.user = req.user._id;
    if (req.query.status) filter.status = req.query.status;

    const complaints = await Complaint.find(filter)
      .populate("user", "name email phone role")
      .populate("property", "title city locality owner")
      .populate("handledBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (error) {
    next(error);
  }
}

export async function updateComplaint(req, res, next) {
  try {
    const { status, priority, resolutionNote } = req.body;
    const updates = {};

    if (status) {
      if (!VALID_STATUSES.includes(status)) throw new ApiError(400, "Invalid complaint status");
      updates.status = status;
      updates.handledBy = req.user._id;
    }

    if (priority) updates.priority = priority;
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate("user", "name email phone role")
      .populate("property", "title city locality owner")
      .populate("handledBy", "name email");

    if (!complaint) throw new ApiError(404, "Complaint not found");
    res.json({ success: true, complaint });
  } catch (error) {
    next(error);
  }
}
