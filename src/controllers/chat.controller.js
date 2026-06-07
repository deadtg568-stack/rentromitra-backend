import { ChatMessage } from "../models/ChatMessage.js";
import { Conversation } from "../models/Conversation.js";
import { Property } from "../models/Property.js";
import { ApiError } from "../utils/apiError.js";
import { emitConversationMessage, getIO } from "../socket.js";
import { canAccessConversation, createChatMessage, findAccessibleConversation } from "../services/chat.service.js";
import { notifyChatMessage } from "../services/notification.service.js";

export async function listChatMessages(req, res, next) {
  try {
    const room = req.query.room || `user:${req.user._id}`;
    const filter = { room };

    if (req.user.role === "user") filter.room = `user:${req.user._id}`;

    const messages = await ChatMessage.find(filter)
      .populate("sender", "name email role")
      .populate("receiver", "name email role")
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}

export async function getOrCreateConversation(req, res, next) {
  try {
    const { propertyId } = req.body;
    const userId = req.user._id;

    if (req.user.role !== "user") {
      throw new ApiError(403, "Only users can start chats from property pages");
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const adminId = property.owner;
    if (!adminId) throw new ApiError(400, "Property owner is not available for chat");
    if (adminId.toString() === userId.toString()) throw new ApiError(400, "You cannot chat with yourself");

    const existing = await Conversation.findOne({
      participants: { $all: [userId, adminId], $size: 2 },
      property: propertyId
    })
      .populate("participants", "name email role profileImage")
      .populate("property", "title images owner");

    if (existing) {
      return res.json({ success: true, conversation: existing });
    }

    const conversation = await Conversation.create({
      participants: [userId, adminId],
      property: propertyId
    });

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "name email role profileImage")
      .populate("property", "title images owner");

    res.status(201).json({ success: true, conversation: populated });
  } catch (error) {
    next(error);
  }
}

export async function getUserConversations(req, res, next) {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    let conversations;

    if (role === "user") {
      conversations = await Conversation.find({ participants: userId })
        .populate("participants", "name email role profileImage")
        .populate("property", "title images owner")
        .sort({ lastMessageAt: -1, updatedAt: -1 });
    } else if (role === "admin") {
      const properties = await Property.find({ owner: userId }).select("_id");
      const propertyIds = properties.map((p) => p._id);

      conversations = await Conversation.find({ property: { $in: propertyIds } })
        .populate("participants", "name email role profileImage")
        .populate("property", "title images owner")
        .sort({ lastMessageAt: -1, updatedAt: -1 });
    } else {
      conversations = await Conversation.find()
        .populate("participants", "name email role profileImage")
        .populate("property", "title images owner")
        .sort({ lastMessageAt: -1, updatedAt: -1 });
    }

    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(req, res, next) {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (!(await canAccessConversation(conversation, req.user))) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    const messages = await ChatMessage.find({ room: conversationId.toString() })
      .populate("sender", "name email role profileImage")
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}

export async function markConversationRead(req, res, next) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const conversation = await findAccessibleConversation(conversationId, req.user);
    if (!conversation) throw new ApiError(403, "Not a participant");

    await ChatMessage.updateMany(
      { room: conversationId, sender: { $ne: userId }, readAt: null },
      { readAt: new Date() }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function sendConversationMessage(req, res, next) {
  try {
    const { conversationId } = req.params;
    if (req.user.role === "superadmin") {
      throw new ApiError(403, "Super admin chat monitoring is read-only");
    }

    const conversation = await findAccessibleConversation(conversationId, req.user);
    if (!conversation) throw new ApiError(403, "Not a participant");

    const message = await createChatMessage({
      conversation,
      sender: req.user,
      message: req.body.message
    });

    if (!message) throw new ApiError(400, "Message is required");

    const io = getIO();
    if (io) emitConversationMessage(io, conversation, message);
    await notifyChatMessage({ conversation, message, sender: req.user });

    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

export async function getAdminConversations(req, res, next) {
  try {
    const properties = await Property.find({ owner: req.user._id }).select("_id title images");
    const propertyIds = properties.map((p) => p._id);

    const conversations = await Conversation.find({ property: { $in: propertyIds } })
      .populate("participants", "name email role profileImage")
      .populate("property", "title images owner")
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json({ success: true, conversations, properties });
  } catch (error) {
    next(error);
  }
}
