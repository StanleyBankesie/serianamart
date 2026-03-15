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

  // Singleton socket across the app to avoid multiple connections
  // when multiple components use this hook simultaneously.
  // Dev StrictMode mounts/unmounts twice; refcount prevents premature close.
  // These variables live for the lifetime of the module.
  // eslint-disable-next-line no-undef
  if (typeof window !== "undefined") {
    window.__omniSocketGlobal__ = window.__omniSocketGlobal__ || {
      socket: null,
      users: 0,
    };
  }
  const globalHolder =
    typeof window !== "undefined" ? window.__omniSocketGlobal__ : null;

  useEffect(() => {
    const tk = token || localStorage.getItem("token");
    // Allow connection without token in dev; the server is tolerant.

    // Reuse global socket if exists
    if (globalHolder && globalHolder.socket) {
      setSocket(globalHolder.socket);
      globalHolder.users += 1;
      return () => {
        if (globalHolder) {
          globalHolder.users = Math.max(0, globalHolder.users - 1);
        }
      };
    }

    // Create socket connection (connect to backend origin in dev/prod)
    const isDev =
      typeof window !== "undefined" && window.location.port === "5173";
    const backendOrigin =
      import.meta.env.VITE_API_PROXY_TARGET ||
      (isDev ? "http://localhost:4002" : window.location.origin);
    const transportPref = (
      import.meta.env.VITE_SOCKET_TRANSPORT || ""
    ).toLowerCase();
    const transports =
      transportPref === "polling" ? ["polling"] : ["websocket"];
    const newSocket = io(backendOrigin, {
      path: "/socket.io",
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
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      transports,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to Socket.io");
      try {
        if (typeof window !== "undefined") {
          window.__omniSocketConnected = true;
        }
      } catch {}
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.io");
      try {
        if (typeof window !== "undefined") {
          window.__omniSocketConnected = false;
        }
      } catch {}
    });

    newSocket.on("error", (error) => {
      console.error("Socket.io error:", error);
    });

    // Keep socket stable across SPA navigation; only close on full unload
    if (typeof window !== "undefined") {
      const unloadHandler = () => {
        try {
          newSocket.close();
        } catch {}
      };
      window.addEventListener("beforeunload", unloadHandler);
      newSocket.on("connect_error", () => {
        // Soft nudge to reconnect faster
        try {
          newSocket.io.opts.reconnectionDelayMax = 10000;
        } catch {}
      });
    }

    setSocket(newSocket);
    if (globalHolder) {
      globalHolder.socket = newSocket;
      globalHolder.users = 1;
    }

    return () => {
      if (globalHolder) {
        globalHolder.users = Math.max(0, globalHolder.users - 1);
      }
    };
  }, [token, user?.id, user?.sub, scope?.branchId]);

  return socket;
}

export default useSocket;
