import { Server } from "socket.io";

let ioInstance = null;

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

export default { initializeSocket, getIO };
