import { ChatMessage } from "../models/ChatMessage.js";
import { Conversation } from "../models/Conversation.js";
import { Property } from "../models/Property.js";

export function userIdString(user) {
  return (user?._id || user?.id || "").toString();
}

export async function canAccessConversation(conversation, user) {
  if (!conversation || !user) return false;
  if (user.role === "superadmin") return true;

  const userId = userIdString(user);
  const isParticipant = conversation.participants?.some((participant) => participant.toString() === userId);
  if (isParticipant) return true;

  if (user.role === "admin" && conversation.property) {
    const property = await Property.findById(conversation.property).select("owner");
    return property?.owner?.toString() === userId;
  }

  return false;
}

export async function findAccessibleConversation(conversationId, user) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return null;
  return (await canAccessConversation(conversation, user)) ? conversation : null;
}

export async function createChatMessage({ conversation, sender, message }) {
  const senderId = userIdString(sender);
  const receiverId = conversation.participants.find((participant) => participant.toString() !== senderId);
  const text = String(message || "").trim();
  if (!text) return null;

  const saved = await ChatMessage.create({
    sender: sender._id,
    receiver: receiverId,
    room: conversation._id.toString(),
    message: text
  });

  conversation.lastMessage = text;
  conversation.lastMessageAt = new Date();
  conversation.lastSender = sender._id;
  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  await conversation.save();

  return ChatMessage.findById(saved._id)
    .populate("sender", "name email role profileImage")
    .populate("receiver", "name email role profileImage");
}
