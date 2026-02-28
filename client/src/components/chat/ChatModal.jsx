import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";
import { useAuth } from "../../auth/AuthContext";

function ConversationList({ items, activeId, onOpen }) {
  return (
    <div className="w-[290px] border-r border-slate-200 bg-slate-50 h-full overflow-auto">
      <div className="p-2 font-semibold text-slate-700">Chats</div>
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c)}
          className={
            "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-white " +
            (activeId === c.id ? "bg-white" : "")
          }
        >
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">
              {c.title || `Conversation #${c.id}`}
            </div>
            <div className="text-[11px] text-slate-500">
              {c.last_preview || ""}
            </div>
          </div>
          <div className="text-right w-14">
            <div className="text-[10px] text-slate-500">
              {c.last_time
                ? new Date(c.last_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </div>
            {!!c.unread_count && (
              <div className="mt-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-green-600 text-white text-[10px] px-1">
                {c.unread_count}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageList({ items, myId }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [items]);
  return (
    <div
      ref={ref}
      className="flex-1 overflow-auto p-4 space-y-2 bg-[url('/whatsapp-paper.png')] bg-repeat"
    >
      {items.map((m) => {
        const outgoing = Number(m.sender_id) === Number(myId);
        const ticks =
          m.status === "read"
            ? "✔✔"
            : m.status === "delivered"
            ? "✔✔"
            : "✔";
        const tickClass =
          m.status === "read" ? "text-blue-500" : "text-slate-400";
        return (
          <div
            key={m.id}
            className={"flex " + (outgoing ? "justify-end" : "justify-start")}
          >
            <div
              className={
                "max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow " +
                (outgoing
                  ? "bg-green-100 text-slate-900 rounded-br-sm"
                  : "bg-white text-slate-900 rounded-bl-sm border border-slate-200")
              }
            >
              <span>{m.content}</span>
              <div className="text-[10px] text-slate-500 mt-1 text-right flex items-center gap-1">
                <span>
                  {new Date(m.sent_at || m.created_at || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {outgoing && <span className={tickClass}>{ticks}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatModal({ onClose }) {
  const socket = useSocket();
  const { user } = useAuth();
  const myId = Number(user?.sub || user?.id);
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());

  async function loadConvos() {
    try {
      const res = await api.get("/chat/conversations");
      setConvos(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setConvos([]);
    }
  }
  async function openConversation(c) {
    setActive(c);
    try {
      const res = await api.get(`/chat/conversations/${c.id}/messages`);
      setMessages(Array.isArray(res.data?.items) ? res.data.items : []);
      await api.post(`/chat/conversations/${c.id}/read`);
    } catch {
      setMessages([]);
    }
    if (socket) {
      socket.emit("join_conversation", c.id);
    }
  }
  useEffect(() => {
    loadConvos();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const onRecv = (m) => {
      if (active && Number(m.conversation_id) === Number(active.id)) {
        setMessages((prev) => prev.concat(m));
      }
      loadConvos();
    };
    const onTypingStart = ({ conversation_id, user_id }) => {
      if (!active || Number(conversation_id) !== Number(active.id)) return;
      if (Number(user_id) === myId) return;
      setTypingUsers((prev) => new Set(prev).add(user_id));
    };
    const onTypingStop = ({ conversation_id, user_id }) => {
      if (!active || Number(conversation_id) !== Number(active.id)) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(user_id);
        return next;
      });
    };
    socket.on("receive_message", onRecv);
    socket.on("typing_start", onTypingStart);
    socket.on("typing_stop", onTypingStop);
    return () => {
      socket.off("receive_message", onRecv);
      socket.off("typing_start", onTypingStart);
      socket.off("typing_stop", onTypingStop);
    };
  }, [socket, active, myId]);

  async function sendText() {
    if (!active || !text.trim()) return;
    const content = text.trim();
    const optimistic = {
      id: `tmp-${Date.now()}`,
      conversation_id: active.id,
      sender_id: myId,
      message_type: "text",
      content,
      status: "sent",
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => prev.concat(optimistic));
    setText("");
    try {
      await api.post("/chat/messages", {
        conversation_id: active.id,
        content,
      });
    } catch {}
  }
  function onTyping() {
    if (!socket || !active) return;
    socket.emit("typing_start", { conversation_id: active.id });
    const t = setTimeout(() => {
      socket.emit("typing_stop", { conversation_id: active.id });
    }, 1200);
    return () => clearTimeout(t);
  }

  const typing = useMemo(() => typingUsers.size > 0, [typingUsers]);

  return (
    <div className="fixed right-4 bottom-20 md:right-6 md:bottom-20 z-50">
      <div className="w-[880px] max-w-[95vw] h-[520px] rounded-xl shadow-erp-lg bg-white border border-slate-200 overflow-hidden flex">
        <ConversationList
          items={convos}
          activeId={active?.id}
          onOpen={openConversation}
        />
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-slate-800">
              {active ? active.title || `Conversation #${active.id}` : "Chat"}
            </div>
            <div className="text-[11px] text-slate-500">
              {typing ? "typing…" : ""}
            </div>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-sm hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          <MessageList items={messages} myId={myId} />
          <div className="p-2 border-t border-slate-200 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendText();
                else onTyping();
              }}
              placeholder="Type a message"
              className="input flex-1"
            />
            <button className="btn" onClick={sendText}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

