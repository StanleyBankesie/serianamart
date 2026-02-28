import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";
import { useAuth } from "../../auth/AuthContext";

function ConversationList({ items, activeId, onOpen, users, onStart }) {
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
      <div className="p-2 font-semibold text-slate-700 border-t border-slate-200">
        Users
      </div>
      {Array.isArray(users) &&
        users.map((u) => (
          <button
            key={u.id}
            onClick={() => onStart(u)}
            className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-white"
          >
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800">
                {u.full_name || u.username}
              </div>
              <div className="text-[11px] text-slate-500">
                {u.username} {u.is_online ? "• online" : ""}
              </div>
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
          m.status === "read" ? "✔✔" : m.status === "delivered" ? "✔✔" : "✔";
        const tickClass =
          m.status === "read" ? "text-blue-500" : "text-slate-400";
        const type = String(m.message_type || "text").toLowerCase();
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
              {type === "text" && <span>{m.content}</span>}
              {type === "image" && (
                <img
                  src={m.content}
                  alt={m.file_name || "image"}
                  className="max-w-full rounded"
                  loading="lazy"
                />
              )}
              {type === "video" && (
                <video
                  src={m.content}
                  className="max-w-full rounded"
                  controls
                  preload="metadata"
                />
              )}
              {type === "document" && (
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <a
                    href={m.content}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {m.file_name || "Document"}
                  </a>
                  {m.file_size != null && (
                    <span className="text-[10px] text-slate-500">
                      ({Math.round(Number(m.file_size) / 1024)} KB)
                    </span>
                  )}
                </div>
              )}
              {type === "contact" && <ContactCard content={m.content} />}
              <div className="text-[10px] text-slate-500 mt-1 text-right flex items-center gap-1">
                <span>
                  {new Date(
                    m.sent_at || m.created_at || Date.now(),
                  ).toLocaleTimeString([], {
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

function ContactCard({ content }) {
  let data = null;
  try {
    data = typeof content === "string" ? JSON.parse(content) : content;
  } catch {}
  if (!data) return <div className="text-sm">Contact</div>;
  return (
    <div className="border rounded-lg p-2 bg-white">
      <div className="font-semibold text-sm">{data.name || data.username}</div>
      <div className="text-[11px] text-slate-600">{data.email || ""}</div>
      <div className="text-[11px] text-slate-600">{data.phone || ""}</div>
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [allUsers, setAllUsers] = useState([]);

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
      try {
        localStorage.setItem("omni.chat.lastConversationId", String(c.id));
      } catch {}
    } catch {
      setMessages([]);
    }
    if (socket) {
      socket.emit("join_conversation", c.id);
    }
  }
  useEffect(() => {
    (async () => {
      await loadConvos();
      try {
        const res = await api.get("/chat/users");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setAllUsers(items);
      } catch {
        setAllUsers([]);
      }
      try {
        const raw = localStorage.getItem("omni.chat.lastConversationId");
        const lastId = raw ? Number(raw) : null;
        if (lastId) {
          const res2 = await api.get("/chat/conversations");
          const list = Array.isArray(res2.data?.items) ? res2.data.items : [];
          setConvos(list);
          const found = list.find((c) => Number(c.id) === Number(lastId));
          if (found) openConversation(found);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadUsers() {
    try {
      const res = await api.get(
        `/chat/users?q=${encodeURIComponent(userSearch || "")}`,
      );
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setUserOptions(items);
    } catch {
      setUserOptions([]);
    }
  }
  useEffect(() => {
    if (pickerOpen) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, userSearch]);

  async function startDirectChat(u) {
    try {
      const res = await api.post("/chat/conversations/direct", {
        user_id: u.id,
      });
      const id = Number(res.data?.id || 0) || null;
      if (id) {
        setPickerOpen(false);
        await loadConvos();
        const c = { id, title: u.username };
        await openConversation(c);
      }
    } catch {}
  }

  async function sendMedia(file) {
    if (!file || !active) return;
    const mime = file.type || "";
    const type = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("video/")
        ? "video"
        : "document";
    setUploading(true);
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/chat/upload", form, {
        onUploadProgress: (e) => {
          if (!e || !e.total) return;
          const pct = Math.round((e.loaded * 100) / e.total);
          setUploadProgress(pct);
        },
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url || res.data?.path;
      const file_name = res.data?.file_name || file.name;
      const file_size = res.data?.file_size || file.size;
      // optimistic bubble
      setMessages((prev) =>
        prev.concat({
          id: `tmp-${Date.now()}`,
          conversation_id: active.id,
          sender_id: myId,
          message_type: type,
          content: url,
          file_name,
          file_size,
          status: "sent",
          sent_at: new Date().toISOString(),
        }),
      );
      await api.post("/chat/messages", {
        conversation_id: active.id,
        content: url,
        message_type: type,
        file_name,
        file_size,
      });
      await loadConvos();
    } catch {
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="fixed right-4 bottom-20 md:right-6 md:bottom-20 z-50">
      <div className="w-[880px] max-w-[95vw] h-[520px] rounded-xl shadow-erp-lg bg-white border border-slate-200 overflow-hidden flex">
        <ConversationList
          items={convos}
          activeId={active?.id}
          onOpen={openConversation}
          users={allUsers}
          onStart={startDirectChat}
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
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <button className="btn" onClick={() => setPickerOpen(true)}>
                New Chat
              </button>
            </div>
          ) : (
            <MessageList items={messages} myId={myId} />
          )}
          <div className="p-2 border-t border-slate-200 flex items-center gap-2">
            {active ? (
              <>
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendMedia(f);
                    e.target.value = "";
                  }}
                />
                {uploading && (
                  <div className="text-xs text-slate-500">
                    {uploadProgress}%
                  </div>
                )}
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
              </>
            ) : (
              <button className="btn" onClick={() => setPickerOpen(true)}>
                Start Chat
              </button>
            )}
          </div>
        </div>
      </div>
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <div className="bg-white w-[520px] max-w-[95vw] rounded-lg shadow-erp-lg border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <div className="font-semibold">Select Recipient</div>
              <button
                className="px-2 py-1 rounded hover:bg-slate-100"
                onClick={() => setPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="p-3">
              <input
                className="input w-full"
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[360px] overflow-auto">
              {userOptions.map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                  onClick={() => startDirectChat(u)}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-xs">
                      {u.username?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold">{u.username}</div>
                    <div className="text-[11px] text-slate-500">
                      {u.full_name || ""}
                    </div>
                  </div>
                  <div
                    className={
                      "w-2 h-2 rounded-full " +
                      (u.is_online ? "bg-green-500" : "bg-slate-400")
                    }
                    title={u.is_online ? "Online" : "Offline"}
                  />
                </button>
              ))}
              {!userOptions.length && (
                <div className="p-4 text-sm text-slate-500">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
