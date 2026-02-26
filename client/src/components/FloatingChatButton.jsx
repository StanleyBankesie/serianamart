import React, { useEffect, useState } from "react";
import api from "../api/client";
import useSocket from "../hooks/useSocket";

export default function FloatingChatButton({ onOpen }) {
  const [count, setCount] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get("/chat/unread-count");
        if (!mounted) return;
        setCount(Number(res.data?.total || 0));
      } catch {
        if (!mounted) return;
        setCount(0);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMessage = () => setCount((c) => c + 1);
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed right-4 bottom-20 md:right-6 md:bottom-6 z-40"
      title="Chat"
    >
      <div
        className="relative w-14 h-14 rounded-full text-white shadow-erp-lg flex items-center justify-center transition-colors"
        style={{ backgroundColor: "#1E7E34" }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#155D27")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#1E7E34")}
      >
        <span className="text-2xl">💬</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
    </button>
  );
}
