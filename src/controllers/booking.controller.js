import { ApiError } from "../utils/apiError.js";
import { Booking } from "../models/Booking.js";
import { Conversation } from "../models/Conversation.js";
import { Property } from "../models/Property.js";
import { getIO } from "../socket.js";
import { notifyBookingCreated, notifyBookingStatus } from "../services/notification.service.js";

function roomForUser(userId) {
  return `user:${userId}`;
}

async function ensureBookingConversation(booking, property) {
  if (!booking || !property?.owner || !booking.user) return null;
  const userId = booking.user._id || booking.user;
  const ownerId = property.owner._id || property.owner;
  const propertyId = property._id || booking.property;

  const existing = await Conversation.findOne({
    participants: { $all: [userId, ownerId], $size: 2 },
    property: propertyId
  });

  if (existing) {
    booking.chatConversation = existing._id;
    return existing;
  }

  const conversation = await Conversation.create({
    participants: [userId, ownerId],
    property: propertyId,
    lastMessage: "Booking approved. You can now chat with the owner.",
    lastMessageAt: new Date()
  });

  booking.chatConversation = conversation._id;
  return conversation;
}

async function populateBookingForDashboard(booking) {
  await booking.populate([
    { path: "user", select: "name email phone" },
    { path: "property", select: "title city locality area type owner" },
    { path: "chatConversation", select: "participants property lastMessage lastMessageAt" }
  ]);
  return booking;
}

function emitBookingEvent(eventName, booking) {
  const io = getIO();
  if (!io || !booking) return;

  const ownerId = booking.property?.owner?._id || booking.property?.owner;
  const userId = booking.user?._id || booking.user;

  if (ownerId) io.to(roomForUser(ownerId.toString())).emit(eventName, booking);
  if (userId) io.to(roomForUser(userId.toString())).emit(eventName, booking);
}

export async function createBooking(req, res, next) {
  try {
    const { property: propertyId, room, moveInDate, months, occupants, notes } = req.body;
    const property = await Property.findById(propertyId);
    if (!property || property.status !== "approved" || property.availability !== "available") {
      throw new ApiError(404, "Property is not available");
    }

    const selectedRoom = property.rooms.id(room) || property.rooms[0];
    if (!selectedRoom) throw new ApiError(400, "Selected room is not available");
    if (selectedRoom.availableBeds <= 0) throw new ApiError(400, "Room is already booked");

    const totalAmount = selectedRoom.monthlyRent * Number(months);
    const booking = await Booking.create({
      user: req.user._id,
      property: property._id,
      room: selectedRoom._id,
      moveInDate,
      months,
      occupants,
      totalAmount,
      notes
    });

    await populateBookingForDashboard(booking);
    await notifyBookingCreated({ booking, property, sender: req.user });
    emitBookingEvent("booking:created", booking);

    res.status(201).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
}

export async function listBookings(req, res, next) {
  try {
    const filter = {};
    if (req.user.role === "user") filter.user = req.user._id;

    if (req.user.role === "admin") {
      const owned = await Property.find({ owner: req.user._id }).select("_id");
      filter.property = { $in: owned.map((item) => item._id) };
    }

    const bookings = await Booking.find(filter)
      .populate("user", "name email phone")
      .populate("property", "title city locality area type owner")
      .populate("chatConversation", "participants property lastMessage lastMessageAt")
      .sort({ createdAt: -1 });

    for (const booking of bookings) {
      if (booking.status === "approved" && !booking.chatConversation && booking.property?.owner) {
        await ensureBookingConversation(booking, booking.property);
        await booking.save();
        await booking.populate("chatConversation", "participants property lastMessage lastMessageAt");
      }
    }

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

export async function updateBookingStatus(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new ApiError(404, "Booking not found");

    const property = await Property.findById(booking.property);
    if (!property) throw new ApiError(404, "Property not found");

    const ownsProperty = property.owner.toString() === req.user._id.toString();
    if (req.user.role === "admin" && !ownsProperty) {
      throw new ApiError(403, "Admins can only update bookings for their own properties");
    }

    const previousStatus = booking.status;
    const nextStatus = req.body.status;
    const selectedRoom = property.rooms.id(booking.room);

    if (selectedRoom && nextStatus === "approved" && previousStatus !== "approved") {
      if (selectedRoom.availableBeds <= 0) throw new ApiError(400, "Room is already booked");
      selectedRoom.availableBeds -= 1;
    }

    if (selectedRoom && previousStatus === "approved" && ["rejected", "cancelled"].includes(nextStatus)) {
      selectedRoom.availableBeds = Math.min(selectedRoom.totalBeds, selectedRoom.availableBeds + 1);
    }

    if (selectedRoom) {
      property.availableRooms = property.rooms.reduce((total, room) => total + Number(room.availableBeds || 0), 0);
      property.availability = property.availableRooms > 0 ? "available" : "booked";
      await property.save();
    }

    booking.status = nextStatus;
    if (nextStatus === "approved") {
      await ensureBookingConversation(booking, property);
    }
    await booking.save();

    await populateBookingForDashboard(booking);
    if (["approved", "rejected"].includes(nextStatus) && previousStatus !== nextStatus) {
      await notifyBookingStatus({ booking, status: nextStatus, sender: req.user });
    }
    emitBookingEvent("booking:updated", booking);

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
}
