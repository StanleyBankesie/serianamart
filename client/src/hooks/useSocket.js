import { useEffect, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "../auth/AuthContext";

/**
 * Hook to manage Socket.io connection
 * Automatically connects/disconnects and handles auth
 */
export function useSocket() {
  const [socket, setSocket] = useState(null);
  const { token, user, scope } = useAuth();

  useEffect(() => {
    const tk = token || localStorage.getItem("token");
    if (!tk) {
      console.warn("No token available for Socket.io connection");
      return;
    }

    // Create socket connection
    const newSocket = io(window.location.origin, {
      auth: {
        token: tk,
      },
      query: {
        userId:
          (user && (user.id || user.sub)) ||
          localStorage.getItem("userId") ||
          "",
        warehouseId:
          (scope && scope.branchId) ||
          localStorage.getItem("warehouseId") ||
          "",
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to Socket.io");
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.io");
    });

    newSocket.on("error", (error) => {
      console.error("Socket.io error:", error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, user?.id, user?.sub, scope?.branchId]);

  return socket;
}

export default useSocket;
