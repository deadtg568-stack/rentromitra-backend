import { Router } from "express";
import {
  listChatMessages,
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  markConversationRead,
  getAdminConversations,
  sendConversationMessage
} from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(protect);

router.get("/messages", authorizeRoles("user", "admin", "superadmin"), listChatMessages);

router.post("/conversations", authorizeRoles("user", "admin", "superadmin"), getOrCreateConversation);
router.get("/conversations", authorizeRoles("user", "admin", "superadmin"), getUserConversations);
router.get("/conversations/admin", authorizeRoles("admin"), getAdminConversations);
router.get("/conversations/:conversationId/messages", authorizeRoles("user", "admin", "superadmin"), getConversationMessages);
router.post("/conversations/:conversationId/messages", authorizeRoles("user", "admin", "superadmin"), sendConversationMessage);
router.patch("/conversations/:conversationId/read", authorizeRoles("user", "admin", "superadmin"), markConversationRead);

export default router;
