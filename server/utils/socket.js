/**
 * @file socket.js
 * @description Configures and manages Socket.IO for real-time bidirectional event-based communication.
 */
import { Server } from "socket.io";
import { query } from "../db/pool.js";
import { verifyAccessToken } from "../services/token.service.js";

// Maintain a global singleton instance of the Socket server
let ioInstance = null;
// Track active online users in memory for quick presence checking
const onlineUsers = new Set();

/**
 * Initialize Socket.io server
 * Handles real-time communication for social feed
 */
/**
 * Initializes the Socket.IO server and binds it to the provided HTTP server.
 *
 * @param {import('http').Server} server - The Node.js HTTP server instance.
 * @returns {import('socket.io').Server} The initialized Socket.IO server.
 */
export const initializeSocket = (server) => {
  // Boot and configure Socket.IO on top of the HTTP server
  ioInstance = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000, // Send ping every 25 seconds
    pingTimeout: 60000, // Wait 60 seconds for pong response before disconnect
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
  });

  ioInstance.use(async (socket, next) => {
    // Intercept socket connections to enforce JWT authentication
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        console.error("Socket.io auth error: TokenExpiredError: jwt expired");
      } else {
        console.error("Socket.io auth error:", error);
      }
      next(new Error("Authentication error"));
    }
  });

  ioInstance.on("connection", (socket) => {
    // Handle newly authenticated user connections
    const userId = socket.user?.sub || socket.user?.id || socket.handshake.query.userId;
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
    // Automatically subscribe user to personal, warehouse, and company channels
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

    // Event: Handle socket errors
    socket.on("error", (error) => {
      console.error(`⚠️ Socket error for User ${userId}:`, error);
    });

    // Event: Disconnect
    // Clean up socket state and emit offline presence upon disconnect
    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected - Reason: ${reason}`);
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
    // Handle joining and leaving chat conversation channels
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
      // Ingest incoming chat messages and broadcast to channel participants
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
      // Process delivery receipts for chat messages
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
      // Update read receipts to indicate a user has seen the latest messages
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
/**
 * Retrieves the active Socket.IO server instance.
 * Throws an error if socket.io has not been initialized.
 *
 * @returns {import('socket.io').Server}
 */
export const getIO = () => {
  // Provide access to the initialized socket instance for external modules
  if (!ioInstance) {
    throw new Error("Socket.io not initialized");
  }
  return ioInstance;
};

export const isUserOnline = (userId) => {
  // Check real-time presence of a specific user
  return onlineUsers.has(String(userId));
};

export const getOnlineUserIds = () => {
  // Return an array of all currently active socket users
  return Array.from(onlineUsers);
};

export default { initializeSocket, getIO };
