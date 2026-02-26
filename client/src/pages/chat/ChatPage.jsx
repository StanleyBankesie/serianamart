import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/client";
import useSocket from "../../hooks/useSocket";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ChatPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const listRef = useRef(null);

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
    async function loadUnread() {
      try {
        const res = await api.get("/chat/unread-count");
        setUnreadTotal(Number(res.data?.total || 0));
      } catch {
        setUnreadTotal(0);
      }
    }
    loadUsers();
    loadUnread();
    const t1 = setInterval(loadUsers, 30000);
    const t2 = setInterval(loadUnread, 15000);
    return () => {
      mounted = false;
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      if (Number(msg?.thread_id) === Number(activeThreadId)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottomSmooth();
        markReadDeferred(msg.id);
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

  const meId = useMemo(
    () => Number(user?.sub || user?.id) || null,
    [user?.sub, user?.id],
  );

  const pickContentType = (fileObj) => {
    if (!fileObj) return "text";
    const t = String(fileObj.type || "").toLowerCase();
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    return "document";
  };

  const openChatWith = async (u) => {
    setActiveUser(u);
    setMessages([]);
    setActiveThreadId(null);
    try {
      const res = await api.post("/chat/threads", { peer_user_id: u.id });
      const id = Number(res.data?.id || 0);
      setActiveThreadId(id || null);
    } catch {
      // ignore
    }
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
        if (items.length) {
          markReadDeferred(items[items.length - 1].id);
        }
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

  const [readTimeout, setReadTimeout] = useState(null);
  function markReadDeferred(lastId) {
    if (!activeThreadId || !lastId) return;
    if (readTimeout) clearTimeout(readTimeout);
    const t = setTimeout(async () => {
      try {
        await api.post(`/chat/threads/${activeThreadId}/read`, {
          last_message_id: lastId,
        });
        const res = await api.get("/chat/unread-count");
        setUnreadTotal(Number(res.data?.total || 0));
      } catch {}
    }, 500);
    setReadTimeout(t);
  }

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!activeThreadId) return;
    if (!text && !file) return;
    try {
      let payload;
      if (file) {
        payload = new FormData();
        payload.append("thread_id", String(activeThreadId));
        payload.append("content_type", pickContentType(file));
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
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to send");
    }
  };

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-erp overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-brand text-white">
          <div className="text-lg font-bold">Chat</div>
          <div className="text-xs bg-red-600 rounded-full px-2 py-0.5">
            {unreadTotal} unread
          </div>
        </div>
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-12 md:col-span-4 border-r min-h-[70vh]">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold">Contacts</div>
              <button
                className="text-xs text-slate-600 hover:text-slate-900"
                onClick={() => navigate("/")}
              >
                Home
              </button>
            </div>
            <div className="divide-y">
              {loadingUsers ? (
                <div className="p-3 text-sm text-slate-600">Loading…</div>
              ) : users.length === 0 ? (
                <div className="p-3 text-sm text-slate-600">No users</div>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    className={classNames(
                      "w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-slate-50",
                      activeUser && activeUser.id === u.id ? "bg-slate-50" : "",
                    )}
                    onClick={() => openChatWith(u)}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
                        {(u.full_name || u.username || "U").charAt(0)}
                      </div>
                      <span
                        className={classNames(
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
          <div className="col-span-12 md:col-span-8 flex flex-col">
            <div className="p-3 border-b">
              {activeUser ? (
                <div className="flex items-center gap-3">
                  <div className={classNames("w-2 h-2 rounded-full", activeUser.online ? "bg-green-500" : "bg-slate-400")} />
                  <div className="font-semibold">
                    {activeUser.full_name || activeUser.username}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  Select a user to start chatting
                </div>
              )}
            </div>
            <div
              ref={listRef}
              className="flex-1 overflow-auto p-3 space-y-2 bg-slate-50"
            >
              {loadingMessages ? (
                <div className="text-sm text-slate-600">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-slate-600">
                  {activeUser ? "No messages yet" : "Choose a contact"}
                </div>
              ) : (
                messages.map((m) => {
                  const mine = Number(m.sender_user_id) === meId;
                  const ct = String(m.content_type || "text");
                  return (
                    <div
                      key={m.id}
                      className={classNames(
                        "max-w-[85%] p-2 rounded-lg shadow text-sm",
                        mine
                          ? "ml-auto bg-brand text-white"
                          : "mr-auto bg-white border",
                      )}
                    >
                      {ct !== "text" && m.attachment_url && (
                        <div className="mb-1">
                          {ct === "image" ? (
                            <img
                              src={m.attachment_url}
                              alt="attachment"
                              className="max-h-60 rounded"
                            />
                          ) : ct === "video" ? (
                            <video
                              src={m.attachment_url}
                              className="max-h-60 rounded"
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
            <form onSubmit={sendMessage} className="p-3 border-t">
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
                  className="px-4 py-2 bg-brand text-white rounded disabled:opacity-50"
                  disabled={!activeThreadId || (!text && !file)}
                  title={!activeThreadId ? "Select a user" : "Send"}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

