import { Server } from "socket.io";
import { query } from "../db/pool.js";

let ioInstance = null;
const onlineUsers = new Set();

/**
 * Initialize Socket.io server
 * Handles real-time communication for social feed
 */
export const initializeSocket = (server) => {
  ioInstance = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://serianamart.omnisuite-erp.com",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      // Get token from handshake auth
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      // Decode token (assuming JWT)
      // For now, just pass it through
      // In production, verify the JWT here
      next();
    } catch (error) {
      console.error("Socket.io auth error:", error);
      next(new Error("Authentication error"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    const warehouseId = socket.handshake.query.warehouseId;

    console.log(`✅ User ${userId} connected to socket`);
    if (userId) {
      onlineUsers.add(String(userId));
      ioInstance.to(`user_${userId}`).emit("presence:update", { online: true });
      // Update presence table and broadcast
      (async () => {
        try {
          await query(
            `INSERT INTO chat_presence (user_id, is_online, last_seen)
             VALUES (:uid, 1, NOW())
             ON DUPLICATE KEY UPDATE is_online = 1, last_seen = NOW()`,
            { uid: Number(userId) },
          );
          ioInstance.emit("chat2:presence", {
            user_id: Number(userId),
            is_online: true,
            last_seen: new Date().toISOString(),
          });
        } catch {}
      })();
    }

    // Join personal room
    socket.join(`user_${userId}`);

    // Join warehouse room if warehouse user
    if (warehouseId) {
      socket.join(`warehouse_${warehouseId}`);
    }

    // Join company room
    socket.join("company");

    // Event: User is viewing a specific post (for notifications)
    socket.on("viewing_post", (postId) => {
      socket.join(`post_${postId}`);
    });

    // Event: User stopped viewing a post
    socket.on("stop_viewing_post", (postId) => {
      socket.leave(`post_${postId}`);
    });

    // Event: Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ User ${userId} disconnected`);
      if (userId) {
        onlineUsers.delete(String(userId));
        ioInstance.to(`user_${userId}`).emit("presence:update", {
          online: false,
        });
        (async () => {
          try {
            await query(
              `INSERT INTO chat_presence (user_id, is_online, last_seen)
               VALUES (:uid, 0, NOW())
               ON DUPLICATE KEY UPDATE is_online = 0, last_seen = NOW()`,
              { uid: Number(userId) },
            );
            ioInstance.emit("chat2:presence", {
              user_id: Number(userId),
              is_online: false,
              last_seen: new Date().toISOString(),
            });
          } catch {}
        })();
      }
    });

    // ---------------- New Chat (WhatsApp-like) ----------------
    socket.on("join_conversation", (conversationId) => {
      try {
        const cid = Number(conversationId);
        if (!Number.isFinite(cid)) return;
        socket.join(`conv_${cid}`);
      } catch {}
    });
    socket.on("leave_conversation", (conversationId) => {
      try {
        const cid = Number(conversationId);
        if (!Number.isFinite(cid)) return;
        socket.leave(`conv_${cid}`);
      } catch {}
    });
    socket.on("typing_start", ({ conversation_id }) => {
      try {
        const cid = Number(conversation_id);
        if (!Number.isFinite(cid)) return;
        ioInstance.to(`conv_${cid}`).emit("typing_start", {
          conversation_id: cid,
          user_id: Number(userId),
        });
      } catch {}
    });
    socket.on("typing_stop", ({ conversation_id }) => {
      try {
        const cid = Number(conversation_id);
        if (!Number.isFinite(cid)) return;
        ioInstance.to(`conv_${cid}`).emit("typing_stop", {
          conversation_id: cid,
          user_id: Number(userId),
        });
      } catch {}
    });
    socket.on("send_message", async ({ conversation_id, content }) => {
      try {
        const cid = Number(conversation_id);
        if (!Number.isFinite(cid) || !String(content || "").trim()) return;
        const senderId = Number(userId);
        await query(
          `
          INSERT INTO chat_messages (conversation_id, sender_id, message_type, content, status, sent_at)
          VALUES (:cid, :senderId, 'text', :content, 'sent', NOW())
          `,
          { cid, senderId, content: String(content).trim() },
        );
        ioInstance.to(`conv_${cid}`).emit("receive_message", {
          conversation_id: cid,
          sender_id: senderId,
          message_type: "text",
          content: String(content).trim(),
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } catch {}
    });
    socket.on("mark_delivered", async ({ message_id }) => {
      try {
        const id = Number(message_id);
        if (!Number.isFinite(id)) return;
        await query(
          `UPDATE chat_messages SET status = 'delivered', delivered_at = NOW() WHERE id = :id AND status = 'sent'`,
          { id },
        );
        ioInstance.emit("message_delivered", { message_id: id });
      } catch {}
    });
    socket.on("mark_read", async ({ conversation_id }) => {
      try {
        const cid = Number(conversation_id);
        if (!Number.isFinite(cid)) return;
        const rows = await query(
          `SELECT id FROM chat_messages WHERE conversation_id = :cid ORDER BY id DESC LIMIT 1`,
          { cid },
        );
        const lastId = Number(rows?.[0]?.id || 0) || null;
        if (!lastId) return;
        await query(
          `UPDATE chat_conversation_participants SET last_read_message_id = :lastId WHERE conversation_id = :cid AND user_id = :uid`,
          { lastId, cid, uid: Number(userId) },
        );
        await query(
          `UPDATE chat_messages SET status = 'read', read_at = NOW() WHERE conversation_id = :cid AND id <= :lastId`,
          { cid, lastId },
        );
        ioInstance.to(`conv_${cid}`).emit("message_read", {
          conversation_id: cid,
          user_id: Number(userId),
          last_read_id: lastId,
        });
      } catch {}
    });

    // Error handling
    socket.on("error", (error) => {
      console.error("Socket.io error:", error);
    });
  });

  console.log("✅ Socket.io initialized");
  return ioInstance;
};

/**
 * Get Socket.io instance for emitting events
 */
export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized");
  }
  return ioInstance;
};

export const isUserOnline = (userId) => {
  return onlineUsers.has(String(userId));
};

export const getOnlineUserIds = () => {
  return Array.from(onlineUsers);
};

export default { initializeSocket, getIO };
