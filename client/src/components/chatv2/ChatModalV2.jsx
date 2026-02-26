import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";

function ConversationList({ users, onSearch, onPickUser }) {
  return (
    <div className="w-64 border-r border-slate-200 dark:border-slate-800 p-2 overflow-auto">
      <div className="mb-2 space-y-2">
        <input
          className="input w-full"
          placeholder="Search users or chats"
          onChange={(e) => onSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-auto border border-slate-200 rounded">
          {(Array.isArray(users) ? users : []).map((u) => (
            <button
              key={u.id}
              className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between"
              onClick={() => onPickUser(u)}
              title={`Start chat with ${u.username}`}
            >
              <span className="font-medium text-sm">{u.username}</span>
              <span
                className={
                  "ml-2 w-2 h-2 rounded-full " +
                  (u.is_online ? "bg-green-500" : "bg-slate-400")
                }
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageList({ items }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [items]);
  return (
    <div ref={ref} className="flex-1 overflow-auto p-3 space-y-2 bg-slate-50">
      {items.map((m) => (
        <div key={m.id} className="flex">
          <div className="px-3 py-2 rounded-lg bg-white shadow border border-slate-200 text-sm">
            {m.content_type === "text" ? (
              <span>{m.content}</span>
            ) : (
              <span className="italic text-slate-500">
                {m.content_type.toUpperCase()} message
              </span>
            )}
            <div className="text-[10px] text-slate-400 mt-1">
              {new Date(m.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatModalV2({ onClose }) {
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [recipient, setRecipient] = useState(null); // {id, username, is_online}
  const fileRef = useRef(null);
  const socket = useSocket();

  useEffect(() => {
    async function loadConvos() {
      try {
        const res = await api.get("/chat2/conversations");
        const items = res?.data?.items || [];
        setConvos(items);
        if (items.length && !active) {
          setActive(items[0]);
        }
      } catch {
        setConvos([]);
      }
    }
    loadConvos();
  }, []);

  // Load initial user list for the left panel
  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const res = await api.get(`/chat2/users`);
        if (!cancelled) {
          setAllUsers(Array.isArray(res?.data?.items) ? res.data.items : []);
        }
      } catch {
        if (!cancelled) setAllUsers([]);
      }
    }
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    async function loadMsgs() {
      try {
        const res = await api.get(`/chat2/conversations/${active.id}/messages`);
        setMessages(res?.data?.items || []);
      } catch {
        setMessages([]);
      }
    }
    loadMsgs();
  }, [active?.id]);

  useEffect(() => {
    if (!socket || !active?.id) return;
    socket.emit("chat2:join", active.id);
    const onPresence = (p) => {
      if (recipient && Number(p?.user_id) === Number(recipient.id)) {
        setRecipient((r) => (r ? { ...r, is_online: !!p.is_online } : r));
      }
    };
    const onMsg = async (payload) => {
      if (Number(payload?.conversation_id) !== Number(active.id)) return;
      try {
        const res = await api.get(
          `/chat2/conversations/${active.id}/messages?limit=1`,
        );
        const items = res?.data?.items || [];
        if (items.length) setMessages((prev) => [...prev, ...items]);
      } catch {}
    };
    socket.on("chat2:message", onMsg);
    socket.on("chat2:presence", onPresence);
    return () => {
      socket.emit("chat2:leave", active.id);
      socket.off("chat2:message", onMsg);
      socket.off("chat2:presence", onPresence);
    };
  }, [socket, active?.id, recipient?.id]);

  // Load recipient presence for header when active changes (heuristic by title)
  useEffect(() => {
    let cancelled = false;
    async function loadRecipient() {
      try {
        if (!active || !active.title) {
          setRecipient(null);
          return;
        }
        const res = await api.get(
          `/chat2/users?search=${encodeURIComponent(active.title)}`,
        );
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const exact = items.find(
          (u) =>
            String(u.username).toLowerCase() ===
            String(active.title).toLowerCase(),
        );
        if (!cancelled) setRecipient(exact || null);
      } catch {
        if (!cancelled) setRecipient(null);
      }
    }
    loadRecipient();
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.title]);

  async function sendText() {
    if (!text.trim() || !active) return;
    const value = text.trim();
    const optimistic = {
      id: `tmp-${Date.now()}`,
      conversation_id: active.id,
      content_type: "text",
      content: value,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    try {
      await api.post("/chat2/messages", {
        conversation_id: active.id,
        content_type: "text",
        content: value,
      });
      // Real message arrives via socket (chat2:message)
    } catch {
      // Optional: rollback optimistic append if needed
    }
  }

  // Send attachments (images, videos, documents)
  async function sendFiles(files) {
    if (!active || !files || files.length === 0) return;
    const fd = new FormData();
    fd.append("conversation_id", String(active.id));
    fd.append("content_type", "document");
    for (const f of files) fd.append("files", f);
    try {
      await api.post("/chat2/messages", fd);
    } catch {}
  }

  // Share contact (share recipient or prompt later)
  async function shareContact() {
    if (!active) return;
    const payload = recipient
      ? { username: recipient.username, id: recipient.id }
      : active.title
        ? { username: active.title }
        : { username: "" };
    try {
      await api.post("/chat2/messages", {
        conversation_id: active.id,
        content_type: "contact",
        content: JSON.stringify(payload),
      });
    } catch {}
  }

  // User search for starting new conversation
  useEffect(() => {
    let t = null;
    if (!userQuery || userQuery.length < 1) {
      setUserResults([]);
      return;
    }
    t = setTimeout(async () => {
      try {
        const res = await api.get(
          `/chat2/users?search=${encodeURIComponent(userQuery)}`,
        );
        setUserResults(Array.isArray(res?.data?.items) ? res.data.items : []);
      } catch {
        setUserResults([]);
      }
    }, 250);
    return () => t && clearTimeout(t);
  }, [userQuery]);

  async function startChatWithUser(u) {
    try {
      const existing = convos.find(
        (c) =>
          String(c.title || "").toLowerCase() ===
          String(u.username || "").toLowerCase(),
      );
      if (existing) {
        setActive(existing);
        setMessages([]);
        setUserQuery("");
        setUserResults([]);
        return;
      }
      const res = await api.post("/chat2/conversations", {
        user_ids: [u.id],
        title: u.username,
      });
      const id = Number(res?.data?.id);
      const conv = {
        id,
        title: u.username,
        is_group: 0,
        last_time: new Date().toISOString(),
      };
      setConvos((prev) => [conv, ...prev.filter((c) => c.id !== id)]);
      setActive(conv);
      setMessages([]);
      setUserQuery("");
      setUserResults([]);
    } catch {}
  }

  return (
    <div className="fixed right-4 bottom-20 md:right-6 md:bottom-20 z-50">
      <div className="w-[880px] max-w-[95vw] h-[520px] rounded-xl shadow-erp-lg bg-white border border-slate-200 overflow-hidden flex">
        <ConversationList
          users={userResults.length > 0 ? userResults : allUsers}
          onSearch={setUserQuery}
          onPickUser={startChatWithUser}
        />
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2">
              <span>
                {active?.title || (active ? `Chat #${active.id}` : "Chat")}
              </span>
              {recipient && (
                <span
                  title={recipient.is_online ? "Online" : "Offline"}
                  className={
                    "inline-block w-2 h-2 rounded-full " +
                    (recipient.is_online ? "bg-green-500" : "bg-slate-400")
                  }
                />
              )}
            </div>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700 text-xl"
              onClick={onClose}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          <MessageList items={messages} />
          <div className="p-2 border-t border-slate-200 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length) sendFiles(files);
                e.target.value = "";
              }}
              accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              title="Attach files"
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              📎
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              title="Share contact"
              onClick={shareContact}
            >
              👤+
            </button>
            <input
              className="input flex-1"
              placeholder="Type a message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
            />
            <button type="button" className="btn-primary" onClick={sendText}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
