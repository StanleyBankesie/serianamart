import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client";
import useSocket from "../hooks/useSocket";
import { useAuth } from "../auth/AuthContext";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ChatWidget({ onClose }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [view, setView] = useState("contacts"); // 'contacts' | 'chat'
  const listRef = useRef(null);

  const meId = useMemo(
    () => Number(user?.sub || user?.id) || null,
    [user?.sub, user?.id],
  );

  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const res = await api.get("/chat/users");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setUsers(items);
      } catch {
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    }
    loadUsers();
    const t = setInterval(loadUsers, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      if (Number(msg?.thread_id) === Number(activeThreadId)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottomSmooth();
      }
    };
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket, activeThreadId]);

  function scrollToBottomSmooth() {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight + 200,
      behavior: "smooth",
    });
  }

  const openChatWith = async (u) => {
    setActiveUser(u);
    setMessages([]);
    setActiveThreadId(null);
    setView("chat");
    try {
      const res = await api.post("/chat/threads", { peer_user_id: u.id });
      const id = Number(res.data?.id || 0);
      setActiveThreadId(id || null);
    } catch {}
  };

  useEffect(() => {
    if (!activeThreadId) return;
    let cancelled = false;
    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const res = await api.get(`/chat/threads/${activeThreadId}/messages`);
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        if (!cancelled) setMessages(items);
        setTimeout(scrollToBottomSmooth, 0);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!activeThreadId) return;
    if (!text && !file) return;
    try {
      let payload;
      if (file) {
        const t = String(file.type || "");
        const ct = t.startsWith("image/")
          ? "image"
          : t.startsWith("video/")
            ? "video"
            : "document";
        payload = new FormData();
        payload.append("thread_id", String(activeThreadId));
        payload.append("content_type", ct);
        if (text) payload.append("content", text);
        payload.append("file", file);
        await api.post("/chat/messages", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/chat/messages", {
          thread_id: activeThreadId,
          content: text,
          content_type: "text",
        });
      }
      setText("");
      setFile(null);
    } catch {}
  };

  return (
    <div className="fixed right-4 bottom-24 md:right-6 md:bottom-24 z-50">
      <div className="w-[360px] max-w-[90vw] h-[520px] rounded-xl shadow-erp-lg bg-white border border-slate-200 overflow-hidden">
        <div
          className="px-3 py-2 text-white flex items-center justify-between"
          style={{ backgroundColor: "#1E7E34", color: "#FFFFFF" }}
        >
          <div className="font-semibold text-sm flex items-center gap-2">
            <span className="text-lg">💬</span> Chat
          </div>
          <button
            type="button"
            className="text-white/90 hover:text-white text-xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {view === "contacts" ? (
          <div className="flex flex-col h-[calc(520px-40px)]">
            <div className="p-2 border-b text-sm font-semibold">Contacts</div>
            <div className="flex-1 overflow-auto divide-y">
              {loadingUsers ? (
                <div className="p-3 text-sm text-slate-600">Loading…</div>
              ) : users.length === 0 ? (
                <div className="p-3 text-sm text-slate-600">No users</div>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-slate-50"
                    onClick={() => openChatWith(u)}
                  >
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
                        {(u.full_name || u.username || "U").charAt(0)}
                      </div>
                      <span
                        className={cx(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                          u.online ? "bg-green-500" : "bg-slate-400",
                        )}
                        title={u.online ? "Online" : "Offline"}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        {u.full_name || u.username}
                      </div>
                      <div className="text-xs text-slate-500">
                        {u.online ? "Online" : "Offline"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(520px-40px)]">
            <div className="p-2 border-b flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setView("contacts");
                  setActiveUser(null);
                  setActiveThreadId(null);
                  setMessages([]);
                }}
                className="text-sm px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                ← Back
              </button>
              <div className="font-semibold text-sm">
                {activeUser?.full_name || activeUser?.username || "Chat"}
              </div>
              <span
                className={cx(
                  "ml-2 w-2 h-2 rounded-full",
                  activeUser?.online ? "bg-green-500" : "bg-slate-400",
                )}
              />
            </div>
            <div
              ref={listRef}
              className="flex-1 overflow-auto p-2 space-y-2 bg-slate-50"
            >
              {loadingMessages ? (
                <div className="text-sm text-slate-600">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-slate-600">No messages yet</div>
              ) : (
                messages.map((m) => {
                  const mine = Number(m.sender_user_id) === meId;
                  const ct = String(m.content_type || "text");
                  return (
                    <div
                      key={m.id}
                      className={cx(
                        "max-w-[85%] p-2 rounded-lg shadow text-sm",
                        mine ? "ml-auto text-white" : "mr-auto bg-white border",
                      )}
                      style={mine ? { backgroundColor: "#1E7E34" } : undefined}
                    >
                      {ct !== "text" && m.attachment_url && (
                        <div className="mb-1">
                          {ct === "image" ? (
                            <img
                              src={m.attachment_url}
                              alt="attachment"
                              className="max-h-48 rounded"
                            />
                          ) : ct === "video" ? (
                            <video
                              src={m.attachment_url}
                              className="max-h-48 rounded"
                              controls
                            />
                          ) : (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Download {ct}
                            </a>
                          )}
                        </div>
                      )}
                      {m.content && <div>{m.content}</div>}
                      <div className="text-[10px] opacity-70 mt-1">
                        {m.created_at
                          ? new Date(m.created_at).toLocaleString()
                          : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={sendMessage} className="p-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
                <input
                  type="text"
                  className="flex-1 input"
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded text-white"
                  style={{ backgroundColor: "#1E7E34" }}
                  disabled={!activeThreadId || (!text && !file)}
                  title={!activeThreadId ? "Select a user" : "Send"}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
