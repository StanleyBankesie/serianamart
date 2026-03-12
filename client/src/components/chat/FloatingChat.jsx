import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";
import ChatModal from "./ChatModal.jsx";
import { useAuth } from "../../auth/AuthContext";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const socket = useSocket();
  const { user } = useAuth();
  const [lastSent, setLastSent] = useState({}); // { [conversation_id]: timestamp }
  const SENT_TTL_MS = 12000;
  function playChatTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext || null;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      o.connect(g).connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.frequency.setValueAtTime(660, ctx.currentTime);
      }, 150);
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.01);
        o.stop();
        ctx.close();
      }, 700);
    } catch {}
  }

  const loadUnread = async () => {
    try {
      const res = await api.get("/chat/unread-count");
      setUnread(Number(res?.data?.unread || 0));
    } catch {
      setUnread(0);
    }
  };
  useEffect(() => {
    loadUnread();
  }, []);
  useEffect(() => {
    function onOpenFromPush() {
      try {
        setOpen(true);
      } catch {}
    }
    window.addEventListener("omni.chat.open", onOpenFromPush);
    return () => window.removeEventListener("omni.chat.open", onOpenFromPush);
  }, []);
  useEffect(() => {
    function onSent(e) {
      try {
        const cid = Number(e?.detail?.conversation_id || 0);
        if (!Number.isFinite(cid) || cid <= 0) return;
        setLastSent((prev) => ({ ...prev, [cid]: Date.now() }));
      } catch {}
    }
    window.addEventListener("omni.chat.sent", onSent);
    return () => window.removeEventListener("omni.chat.sent", onSent);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      setLastSent((prev) => {
        const now = Date.now();
        const next = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v < SENT_TTL_MS) {
            next[k] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    function onRefresh() {
      loadUnread();
    }
    window.addEventListener("omni.chat.unread.refresh", onRefresh);
    return () =>
      window.removeEventListener("omni.chat.unread.refresh", onRefresh);
  }, []);
  useEffect(() => {
    if (!socket) return;
    const onReceive = (m) => {
      try {
        const uid = Number(user?.sub || user?.id) || 0;
        const senderId = Number(m?.sender_id || 0);
        // If I am the sender, don't reload unread or play tone
        if (uid && senderId && uid === senderId) return;
        const cid = Number(m?.conversation_id || 0);
        if (Number.isFinite(cid) && cid > 0) {
          const ts = lastSent[cid];
          if (ts && Date.now() - ts < SENT_TTL_MS) {
            return;
          }
        }
      } catch {}
      loadUnread();
      try {
        const hidden =
          typeof document !== "undefined" &&
          document.visibilityState !== "visible";
        if (!open || hidden) playChatTone();
      } catch {}
    };
    socket.on("receive_message", onReceive);
    socket.on("message_delivered", onReceive);
    socket.on("message_read", onReceive);
    return () => {
      socket.off("receive_message", onReceive);
      socket.off("message_delivered", onReceive);
      socket.off("message_read", onReceive);
    };
  }, [socket, user?.sub, user?.id, open, lastSent]);

  const badge = useMemo(() => {
    if (!unread) return null;
    return (
      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-[2px] shadow">
        {unread > 99 ? "99+" : unread}
      </span>
    );
  }, [unread]);

  return (
    <>
      <button
        type="button"
        aria-label="Open chat"
        onClick={() => setOpen(true)}
        data-rbac-exempt="true"
        className="fixed z-[9999] md:right-6 md:bottom-6 w-12 h-12 rounded-full shadow-xl text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{
          backgroundColor: "#22C55E",
          right: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M20.52 3.48A11.5 11.5 0 0 0 3.48 20.52L2 22l3.02-.4A11.5 11.5 0 1 0 20.52 3.48zM12 20.5c-1.8 0-3.47-.53-4.87-1.44l-.35-.22-1.8.24.25-1.75-.23-.36A8.5 8.5 0 1 1 12 20.5z"
            fill="white"
            opacity="0.9"
          />
          <path
            d="M16.4 13.3c-.25-.12-1.48-.73-1.7-.82-.23-.08-.4-.12-.57.12-.17.25-.65.82-.8.99-.15.17-.3.18-.55.06-.25-.12-1.07-.39-2.05-1.25-.76-.68-1.28-1.52-1.43-1.77-.15-.25-.02-.39.1-.51.1-.1.25-.28.37-.42.12-.14.16-.25.24-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.87-.2-.48-.41-.41-.57-.41h-.49c-.17 0-.43.06-.66.31-.23.25-.88.85-.88 2.08s.9 2.41 1.03 2.58c.12.17 1.78 2.72 4.33 3.82.61.26 1.09.41 1.46.53.61.19 1.17.16 1.6.1.49-.07 1.48-.6 1.69-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28z"
            fill="white"
          />
        </svg>
        {badge}
      </button>
      {open && <ChatModal onClose={() => setOpen(false)} />}
    </>
  );
}
