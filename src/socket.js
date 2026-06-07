import jwt from "jsonwebtoken";
import { corsOptions } from "./config/cors.js";
import { Conversation } from "./models/Conversation.js";
import { User } from "./models/User.js";
import { canAccessConversation, createChatMessage } from "./services/chat.service.js";
import { notifyChatMessage, refreshUnreadCountForUser } from "./services/notification.service.js";

const onlineUsers = new Map();
let ioInstance = null;

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export function roomForUser(userId) {
  return `user:${userId}`;
}

export function getIO() {
  return ioInstance;
}

export function emitConversationMessage(io, conversation, message) {
  const conversationId = conversation._id.toString();
  io.to(conversationId).emit("chat:message", message);

  conversation.participants.forEach((participantId) => {
    io.to(roomForUser(participantId.toString())).emit("conversation:update", {
      _id: conversationId,
      lastMessage: message.message,
      lastMessageAt: conversation.lastMessageAt,
      lastSender: message.sender?._id || message.sender
    });
  });
}

export async function initializeSocket(server) {
  let Server;

  try {
    ({ Server } = await import("socket.io"));
  } catch {
    console.warn("Socket.IO is not installed. Run npm install in backend to enable real-time chat.");
    return null;
  }

  const io = new Server(server, {
    cors: corsOptions
  });
  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication token required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === "superadmin" && decoded.id === "superadmin") {
        socket.user = {
          _id: "superadmin",
          id: "superadmin",
          name: "Super Admin",
          email: process.env.SUPER_ADMIN_EMAIL,
          role: "superadmin",
          isActive: true
        };
        return next();
      }

      const user = await User.findById(decoded.id).select("-password");
      if (!user || !user.isActive) return next(new Error("User is not authorized"));

      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    const userId = user._id.toString();
    const baseRoom = roomForUser(userId);

    onlineUsers.set(userId, publicUser(user));
    socket.join(baseRoom);
    if (["admin", "superadmin"].includes(user.role)) socket.join("admins");
    refreshUnreadCountForUser(user).catch(() => {});

    io.emit("presence:update", [...onlineUsers.values()]);

    socket.on("chat:join", async ({ room } = {}) => {
      if (!room) return;
      const conversation = await Conversation.findById(room);
      if (await canAccessConversation(conversation, user)) socket.join(room);
    });

    socket.on("chat:leave", ({ room } = {}) => {
      if (room) socket.leave(room);
    });

    socket.on("chat:typing", async ({ conversationId, isTyping }) => {
      const targetRoom = conversationId || baseRoom;
      if (conversationId) {
        const conversation = await Conversation.findById(conversationId);
        if (!(await canAccessConversation(conversation, user))) return;
      }
      socket.to(targetRoom).emit("chat:typing", {
        conversationId: targetRoom,
        user: publicUser(user),
        isTyping: Boolean(isTyping)
      });
    });

    socket.on("chat:message", async ({ conversationId, message } = {}) => {
      const text = String(message || "").trim();
      if (!text || !conversationId) return;
      if (user.role === "superadmin") return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      if (!(await canAccessConversation(conversation, user))) return;

      const populated = await createChatMessage({ conversation, sender: user, message: text });
      if (populated) {
        emitConversationMessage(io, conversation, populated);
        notifyChatMessage({ conversation, message: populated, sender: user }).catch(() => {});
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("presence:update", [...onlineUsers.values()]);
    });
  });

  return io;
}
