import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import useSocket from "../../hooks/useSocket";
import { useAuth } from "../../auth/AuthContext.jsx";

function ConversationList({
  mode,
  convos,
  users,
  onSearch,
  onPickUser,
  onPickConvo,
  setMode,
}) {
  return (
    <div className="w-64 border-r border-slate-200 dark:border-slate-800 p-2 overflow-auto">
      <div className="mb-2 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            className={
              "flex-1 px-2 py-1 rounded text-sm " +
              (mode === "chats"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200")
            }
            onClick={() => setMode("chats")}
          >
            Chats
          </button>
          <button
            type="button"
            className={
              "flex-1 px-2 py-1 rounded text-sm " +
              (mode === "contacts"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200")
            }
            onClick={() => setMode("contacts")}
          >
            Contacts
          </button>
        </div>
        {mode === "contacts" ? (
          <>
            <input
              className="input w-full"
              placeholder="Search contacts"
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
          </>
        ) : (
          <div className="max-h-72 overflow-auto border border-slate-200 rounded">
            {(Array.isArray(convos) ? convos : []).map((c) => (
              <button
                key={c.id}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between"
                onClick={() => onPickConvo(c)}
                title={`Open chat with ${c.title || `#${c.id}`}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                    {(c.title || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">
                      {c.title || `Chat #${c.id}`}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {c.last_preview || ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">
                    {c.last_time
                      ? new Date(c.last_time).toLocaleTimeString()
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
        )}
      </div>
    </div>
  );
}

function MessageList({
  items,
  myId,
  onReply,
  onStar,
  onDeleteMe,
  onDeleteAll,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [items]);
  return (
    <div
      ref={ref}
      className="flex-1 overflow-auto p-4 space-y-2 bg-[url('/whatsapp-paper.png')] bg-repeat"
    >
      {items.map((m, idx) => {
        const atts = Array.isArray(m.attachments)
          ? m.attachments
          : typeof m.attachments === "string" && m.attachments
            ? (() => {
                try {
                  const a = JSON.parse(m.attachments);
                  return Array.isArray(a) ? a.filter(Boolean) : [];
                } catch {
                  return [];
                }
              })()
            : [];
        const outgoing = Number(m.sender_user_id) === Number(myId);
        const curDate = new Date(m.created_at);
        const prev = items[idx - 1];
        const prevDate = prev ? new Date(prev.created_at) : null;
        const showSep =
          !prev || curDate.toDateString() !== prevDate.toDateString();
        const dayLabel = (() => {
          const today = new Date();
          const yest = new Date();
          yest.setDate(today.getDate() - 1);
          if (curDate.toDateString() === today.toDateString()) return "Today";
          if (curDate.toDateString() === yest.toDateString())
            return "Yesterday";
          return curDate.toLocaleDateString();
        })();
        return (
          <React.Fragment key={m.id}>
            {showSep && (
              <div className="flex justify-center my-2">
                <span className="text-[11px] bg-slate-200 text-slate-700 rounded-full px-2 py-0.5">
                  {dayLabel}
                </span>
              </div>
            )}
            <div
              className={"flex " + (outgoing ? "justify-end" : "justify-start")}
            >
              <div
                className={
                  "max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow relative " +
                  (outgoing
                    ? "bg-green-100 text-slate-900 rounded-br-sm"
                    : "bg-white text-slate-900 rounded-bl-sm border border-slate-200")
                }
              >
                {m.reply_to ? (
                  <div className="mb-1 pl-2 border-l-4 border-slate-300 text-[11px] text-slate-600">
                    Replying to #{m.reply_to}
                  </div>
                ) : null}
                {m.is_deleted ? (
                  <em className="text-slate-500">This message was deleted</em>
                ) : m.content_type === "text" ? (
                  <span>{m.content}</span>
                ) : atts.length ? (
                  <div className="space-y-2">
                    {atts.map((a) => {
                      const url = a.file_path?.startsWith("/")
                        ? a.file_path
                        : `/${a.file_path || ""}`;
                      const mt = String(a.mime_type || "");
                      if (mt.startsWith("image/")) {
                        return (
                          <img
                            key={a.id}
                            src={url}
                            alt="image"
                            className="max-w-full rounded"
                          />
                        );
                      }
                      if (mt.startsWith("video/")) {
                        return (
                          <video
                            key={a.id}
                            src={url}
                            controls
                            className="w-full rounded"
                          />
                        );
                      }
                      if (mt.startsWith("audio/")) {
                        return <audio key={a.id} src={url} controls />;
                      }
                      return (
                        <a
                          key={a.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {url.split("/").pop()}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <span className="italic text-slate-500">
                    {String(m.content_type || "").toUpperCase()} message
                  </span>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex gap-2 text-[12px] text-slate-500">
                    <button
                      type="button"
                      title="Reply"
                      onClick={() => onReply && onReply(m)}
                    >
                      ↩
                    </button>
                    <button
                      type="button"
                      title="Star"
                      onClick={() => onStar && onStar(m, true)}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      title="Delete for me"
                      onClick={() => onDeleteMe && onDeleteMe(m)}
                    >
                      🗑
                    </button>
                    {outgoing && (
                      <button
                        type="button"
                        title="Delete for everyone"
                        onClick={() => onDeleteAll && onDeleteAll(m)}
                      >
                        🗑🕒
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 text-right flex items-center gap-1">
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {outgoing && (
                      <span
                        className={
                          m.other_status === "read"
                            ? "text-blue-500"
                            : "text-slate-400"
                        }
                        title={
                          m.other_status === "read"
                            ? "Read"
                            : m.other_status === "delivered"
                              ? "Delivered"
                              : "Sent"
                        }
                      >
                        {m.other_status === "read"
                          ? "✔✔"
                          : m.other_status === "delivered"
                            ? "✔✔"
                            : "✔"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ChatModalV2({ onClose }) {
  const { user } = useAuth();
  const myId = Number(user?.id || user?.sub || 0) || null;
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
  const [mode, setMode] = useState("chats");
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const filteredConvos = useMemo(() => {
    const q = String(userQuery || "").toLowerCase();
    if (!q) return convos;
    return convos.filter((c) =>
      String(c.title || `#${c.id}`)
        .toLowerCase()
        .includes(q),
    );
  }, [convos, userQuery]);

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
        // mark as read
        await api.post(`/chat2/conversations/${active.id}/read`);
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
      const cid = Number(payload?.conversation_id);
      if (cid === Number(active.id)) {
        try {
          const res = await api.get(
            `/chat2/conversations/${active.id}/messages?limit=1`,
          );
          const items = res?.data?.items || [];
          if (items.length) setMessages((prev) => [...prev, ...items]);
          await api.post(`/chat2/conversations/${active.id}/read`);
        } catch {}
      }
      // Reorder chat list and bump unread for other convos
      setConvos((prev) => {
        const list = [...prev];
        const idx = list.findIndex((c) => Number(c.id) === cid);
        if (idx >= 0) {
          const item = { ...list[idx], last_time: new Date().toISOString() };
          if (cid !== Number(active.id)) {
            item.unread_count = Number(item.unread_count || 0) + 1;
          }
          list.splice(idx, 1);
          list.unshift(item);
        }
        return list;
      });
    };
    socket.on("chat2:message", onMsg);
    socket.on("chat2:presence", onPresence);
    const onTyping = (payload) => {
      if (Number(payload?.conversation_id) !== Number(active.id)) return;
      if (Number(payload?.user_id) === Number(myId)) return;
      setIsTyping(!!payload?.typing);
      if (payload?.typing) {
        clearTimeout(onTyping._t);
        onTyping._t = setTimeout(() => setIsTyping(false), 4000);
      }
    };
    socket.on("chat2:typing", onTyping);
    return () => {
      socket.emit("chat2:leave", active.id);
      socket.off("chat2:message", onMsg);
      socket.off("chat2:presence", onPresence);
      socket.off("chat2:typing", onTyping);
    };
  }, [socket, active?.id, recipient?.id, myId]);

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
      reply_to: replyTo?.id || null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    try {
      await api.post("/chat2/messages", {
        conversation_id: active.id,
        content_type: "text",
        content: value,
        reply_to: replyTo?.id || null,
      });
      setReplyTo(null);
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
        setMode("chats");
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
      setMode("chats");
    } catch {}
  }
  function openConversation(c) {
    setActive(c);
    setMessages([]);
    setMode("chats");
  }

  async function starMessage(m, star) {
    try {
      await api.post(`/chat2/messages/${m.id}/star`, { star: !!star });
    } catch {}
  }
  async function deleteMe(m) {
    try {
      await api.post(`/chat2/messages/${m.id}/delete`, { scope: "me" });
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch {}
  }
  async function deleteAll(m) {
    try {
      await api.post(`/chat2/messages/${m.id}/delete`, { scope: "everyone" });
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, is_deleted: 1, content: "" } : x,
        ),
      );
    } catch {}
  }

  return (
    <div className="fixed right-4 bottom-20 md:right-6 md:bottom-20 z-50">
      <div className="w-[880px] max-w-[95vw] h-[520px] rounded-xl shadow-erp-lg bg-white border border-slate-200 overflow-hidden flex">
        <ConversationList
          mode={mode}
          convos={filteredConvos}
          users={userResults.length > 0 ? userResults : allUsers}
          onSearch={setUserQuery}
          onPickUser={startChatWithUser}
          onPickConvo={openConversation}
          setMode={setMode}
        />
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                {(active?.title || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="font-semibold text-sm">
                <div>
                  {active?.title || (active ? `Chat #${active.id}` : "Chat")}
                  {recipient && (
                    <span
                      title={recipient.is_online ? "Online" : "Offline"}
                      className={
                        "inline-block w-2 h-2 rounded-full ml-2 " +
                        (recipient.is_online ? "bg-green-500" : "bg-slate-400")
                      }
                    />
                  )}
                </div>
                <div className="text-xs font-normal text-slate-500">
                  {isTyping
                    ? "typing…"
                    : recipient?.is_online
                      ? "Online"
                      : recipient?.last_seen
                        ? `Last seen ${new Date(
                            recipient.last_seen,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                </div>
              </div>
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
          <MessageList
            items={messages}
            myId={myId}
            onReply={(m) => setReplyTo(m)}
            onStar={starMessage}
            onDeleteMe={deleteMe}
            onDeleteAll={deleteAll}
          />
          <div className="p-2 border-t border-slate-200 flex items-center gap-2">
            {replyTo && (
              <div className="absolute -mt-14 left-2 right-2 bg-slate-100 rounded p-2 text-xs flex items-center justify-between">
                <div>
                  Replying to: {replyTo.content || replyTo.content_type}
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-slate-600 hover:text-slate-800"
                  title="Cancel reply"
                >
                  ✕
                </button>
              </div>
            )}
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
              onChange={(e) => {
                setText(e.target.value);
                try {
                  if (socket && active?.id) {
                    socket.emit("chat2:typing", {
                      conversation_id: active.id,
                      typing: true,
                    });
                  }
                } catch {}
              }}
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
