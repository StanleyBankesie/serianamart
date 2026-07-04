/**
 * @file socket.js
 * @description Configures and manages Socket.IO for real-time bidirectional event-based communication.
 * Uses Redis adapter for multi-instance support.
 */
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { query } from "../db/pool.js";
import {
  lookupGraceToken,
  verifyAccessToken,
} from "../services/token.service.js";
import { getRedis } from "./redis.js";

// Maintain a global singleton instance of the Socket server
let ioInstance = null;
// Track active online users — use Redis when available, fallback to in-memory
let onlineUsers = new Set();
let useRedisPresence = false;

/**
 * Initialize Socket.io server
 * Handles real-time communication for social feed
 */
/**
 * Initializes the Socket.IO server and binds it to the provided HTTP server.
 * Uses Redis adapter when available for multi-instance support.
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
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter if available
  (async () => {
    try {
      const redis = getRedis();
      const subClient = redis.duplicate();
      const pubClient = redis.duplicate();
      await Promise.all([
        new Promise((resolve, reject) => {
          subClient.on("connect", resolve);
          subClient.on("error", reject);
        }),
        new Promise((resolve, reject) => {
          pubClient.on("connect", resolve);
          pubClient.on("error", reject);
        }),
      ]);
      ioInstance.adapter(createAdapter(pubClient, subClient));
      useRedisPresence = true;
      console.log("[Socket] Redis adapter attached — multi-instance mode enabled");
    } catch (err) {
      useRedisPresence = false;
      console.log("[Socket] Redis adapter unavailable, using in-memory presence:", err.message);
    }
  })();

  ioInstance.use(async (socket, next) => {
    try {
      const { parseCookieHeader } = await import("../services/token.service.js");
      const cookies = parseCookieHeader(socket.handshake.headers.cookie || "");
      const sessionId = cookies.omnisuite_session;

      if (!sessionId) {
        const rawToken =
          socket.handshake.auth?.token ||
          socket.handshake.auth?.accessToken ||
          socket.handshake.query?.accessToken ||
          socket.handshake.headers?.authorization ||
          "";
        const bearerToken = String(rawToken || "").startsWith("Bearer ")
          ? String(rawToken).slice(7).trim()
          : String(rawToken || "").trim();

        if (!bearerToken) {
          return next(new Error("Authentication required"));
        }

        try {
          socket.user = verifyAccessToken(bearerToken);
          return next();
        } catch {
          const gracePayload = await lookupGraceToken(bearerToken);
          if (gracePayload) {
            socket.user = gracePayload;
            return next();
          }
          return next(new Error("Authentication required"));
        }
      }

      const { cacheGet } = await import("./redis.js");
      const sessionData = await cacheGet(`omnisuite_session:${sessionId}`);

      if (!sessionData || !sessionData.user) {
        const rawToken =
          socket.handshake.auth?.token ||
          socket.handshake.auth?.accessToken ||
          socket.handshake.query?.accessToken ||
          socket.handshake.headers?.authorization ||
          "";
        const bearerToken = String(rawToken || "").startsWith("Bearer ")
          ? String(rawToken).slice(7).trim()
          : String(rawToken || "").trim();

        if (bearerToken) {
          try {
            socket.user = verifyAccessToken(bearerToken);
            return next();
          } catch {
            const gracePayload = await lookupGraceToken(bearerToken);
            if (gracePayload) {
              socket.user = gracePayload;
              return next();
            }
          }
        }
        return next(new Error("Authentication required"));
      }

      socket.user = sessionData.user;
      next();
    } catch (error) {
      console.error("Socket.io auth error:", error);
      next(new Error("Authentication error"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user?.sub || socket.user?.id || socket.handshake.query.userId;
    const warehouseId = socket.handshake.query.warehouseId;

    console.log(`✅ User ${userId} connected to socket`);
    if (userId) {
      // Add to presence set (Redis or in-memory)
      if (useRedisPresence) {
        getRedis().sadd("sm:online_users", String(userId)).catch(() => {});
      } else {
        onlineUsers.add(String(userId));
      }
      ioInstance.to(`user_${userId}`).emit("presence:update", { online: true });
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

    socket.join(`user_${userId}`);
    if (warehouseId) {
      socket.join(`warehouse_${warehouseId}`);
    }
    socket.join("company");

    socket.on("viewing_post", (postId) => {
      socket.join(`post_${postId}`);
    });

    socket.on("stop_viewing_post", (postId) => {
      socket.leave(`post_${postId}`);
    });

    socket.on("error", (error) => {
      console.error(`⚠️ Socket error for User ${userId}:`, error);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected - Reason: ${reason}`);
      if (userId) {
        if (useRedisPresence) {
          getRedis().srem("sm:online_users", String(userId)).catch(() => {});
        } else {
          onlineUsers.delete(String(userId));
        }
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

    // Chat events
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

export const isUserOnline = async (userId) => {
  if (useRedisPresence) {
    try {
      const result = await getRedis().sismember("sm:online_users", String(userId));
      return result === 1;
    } catch {
      return false;
    }
  }
  return onlineUsers.has(String(userId));
};

export const getOnlineUserIds = async () => {
  if (useRedisPresence) {
    try {
      const members = await getRedis().smembers("sm:online_users");
      return members.map(Number);
    } catch {
      return [];
    }
  }
  return Array.from(onlineUsers).map(Number);
};

export default { initializeSocket, getIO };
