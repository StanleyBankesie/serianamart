import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import "./PostCard.css";
import api from "../../api/client";

const avatarCache = new Map();

export default function PostCard({
  post,
  setPosts,
  defaultShowComments = false,
  forceOpenComments = false,
}) {
  const [newComment, setNewComment] = useState("");
  const [newCommentFile, setNewCommentFile] = useState(null);
  const [newCommentPreview, setNewCommentPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authorAvatar, setAuthorAvatar] = useState(null);
  const [commenterAvatars, setCommenterAvatars] = useState({});
  const [showComments, setShowComments] = useState(!!defaultShowComments);
  const token = localStorage.getItem("token");
  const { user } = useAuth();
  const navigate = useNavigate();
  const commentFileRef = useRef(null);
  const resolveImageUrl = (u) => {
    if (!u) return null;
    if (/^(data:|https?:)/i.test(u)) return u;
    if (u.startsWith("/uploads")) {
      const base = String(api.defaults.baseURL || "");
      let origin = "";
      if (/^https?:\/\//i.test(base)) {
        try {
          const url = new URL(base);
          origin = `${url.protocol}//${url.host}`;
        } catch {}
      } else if (typeof window !== "undefined" && window.location) {
        origin = window.location.origin;
      }
      return origin ? origin + u : u;
    }
    return u;
  };
  const [imageSrc, setImageSrc] = useState(resolveImageUrl(post.image_url));
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    setImageSrc(resolveImageUrl(post.image_url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.image_url]);
  useEffect(() => {
    return () => {
      try {
        if (blobUrl && blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrl);
        }
      } catch {}
    };
  }, [blobUrl]);
  const tryFallback = async () => {
    const raw = String(post.image_url || "");
    try {
      const currentOrigin =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "";
      const apiBase = String(api.defaults.baseURL || "");
      let apiOrigin = "";
      if (/^https?:\/\//i.test(apiBase)) {
        try {
          const u = new URL(apiBase);
          apiOrigin = `${u.protocol}//${u.host}`;
        } catch {}
      }
      // candidates
      const candidates = [];
      // if absolute localhost:5173/5174, normalize to current origin
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            candidates.push(`${currentOrigin}${u.pathname}`);
            if (apiOrigin) candidates.push(`${apiOrigin}${u.pathname}`);
          }
        }
      } catch {}
      // if relative uploads
      if (raw.startsWith("/uploads")) {
        candidates.push(`${currentOrigin}${raw}`);
        if (apiOrigin) candidates.push(`${apiOrigin}${raw}`);
      } else if (raw.startsWith("uploads")) {
        candidates.push(`${currentOrigin}/${raw}`);
        if (apiOrigin) candidates.push(`${apiOrigin}/${raw}`);
      }
      // last resort: as-is
      candidates.push(raw);
      // try to fetch candidates until one succeeds, then use blob URL
      for (const candidate of candidates) {
        if (!candidate || candidate === imageSrc) continue;
        try {
          const resp = await fetch(candidate, { mode: "cors" });
          if (resp && resp.ok) {
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            // revoke previous blob
            try {
              if (blobUrl && blobUrl.startsWith("blob:")) {
                URL.revokeObjectURL(blobUrl);
              }
            } catch {}
            setBlobUrl(url);
            setImageSrc(url);
            return;
          }
        } catch {}
      }
      setImageSrc("/OMNISUITE_ICON_CLEAR.png");
    } catch {
      setImageSrc("/OMNISUITE_ICON_CLEAR.png");
    }
  };

  const handleLike = async () => {
    const uid = Number(user?.sub || user?.id) || "";
    if (post.user_liked) {
      // Unlike
      await api.delete(`/social-feed/${post.id}/like`, {
        headers: { "x-user-id": String(uid) },
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, like_count: p.like_count - 1, user_liked: false }
            : p,
        ),
      );
    } else {
      // Like
      await api.post(
        `/social-feed/${post.id}/like`,
        {},
        { headers: { "x-user-id": String(uid) } },
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, like_count: p.like_count + 1, user_liked: true }
            : p,
        ),
      );
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const uid = Number(user?.sub || user?.id) || "";
      const response = await api.post(
        `/social-feed/${post.id}/comments`,
        { comment_text: newComment },
        { headers: { "x-user-id": String(uid) } },
      );
      const data = response?.data || {};
      const createdComment = data.data;
      // If an attachment is selected, upload and attach
      if (newCommentFile && createdComment?.id) {
        try {
          const fd = new FormData();
          fd.append("file", newCommentFile);
          const up = await api.post(`/upload`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const url =
            up?.data?.url || up?.data?.data?.url || up?.data?.path || null;
          if (url) {
            await api.post(
              `/documents/social-comment/${createdComment.id}/attachments`,
              {
                url,
                name: newCommentFile.name,
                title: newCommentFile.name,
                mime_type: newCommentFile.type || null,
                file_size: newCommentFile.size || null,
              },
            );
            // Attach a minimal attachment object to the new comment for UI
            createdComment.attachments = [
              {
                id: Math.random(),
                file_url: url,
                file_name: newCommentFile.name,
                mime_type: newCommentFile.type || "",
              },
            ];
          }
        } catch {}
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                comments: [...p.comments, createdComment],
                comment_count: p.comment_count + 1,
              }
            : p,
        ),
      );
      setNewComment("");
      if (commentFileRef.current) commentFileRef.current.value = "";
      try {
        if (newCommentPreview && newCommentPreview.startsWith("blob:")) {
          URL.revokeObjectURL(newCommentPreview);
        }
      } catch {}
      setNewCommentPreview(null);
      setNewCommentFile(null);
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAllComments = async () => {
    try {
      const uid = Number(user?.sub || user?.id) || "";
      const already = Array.isArray(post.comments) ? post.comments.length : 0;
      const total = Number(post.comment_count || already);
      const remaining = Math.max(total - already, 0);
      if (remaining <= 0) {
        setShowComments(true);
        return;
      }
      setLoading(true);
      const res = await api.get(`/social-feed/${post.id}/comments`, {
        params: { offset: already, limit: remaining },
        headers: { "x-user-id": String(uid) },
      });
      const data = res?.data || {};
      const more = Array.isArray(data.data) ? data.data : [];
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          const seen = new Set((p.comments || []).map((c) => c.id));
          const merged = [
            ...(p.comments || []),
            ...more.filter((c) => !seen.has(c.id)),
          ];
          return { ...p, comments: merged, comment_count: p.comment_count };
        }),
      );
      setShowComments(true);
    } catch (err) {
      console.error("Error loading all comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const uidHeader = Number(user?.sub || user?.id) || "";
    async function fetchAvatar(userId) {
      const key = Number(userId);
      if (!Number.isFinite(key) || key <= 0) return null;
      if (avatarCache.has(key)) return avatarCache.get(key);
      try {
        const res = await api.get(`/admin/users/${key}`);
        if (res?.status !== 200) return null;
        const item =
          res.data?.data?.item ||
          res.data?.item ||
          res.data?.data ||
          res.data ||
          null;
        const url = item?.profile_picture_url || null;
        if (url) avatarCache.set(key, url);
        return url;
      } catch {
        return null;
      }
    }
    const authorId =
      post.user_id ||
      post.userId ||
      post.author_user_id ||
      post.authorId ||
      null;
    let mounted = true;
    (async () => {
      const a = await fetchAvatar(authorId);
      if (mounted && a) setAuthorAvatar(a);
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const ids = comments
        .map(
          (c) =>
            c.user_id || c.userId || c.author_user_id || c.authorId || null,
        )
        .filter((x) => Number.isFinite(Number(x)) && Number(x) > 0);
      const unique = Array.from(new Set(ids));
      const results = {};
      for (const id of unique) {
        const url = await fetchAvatar(id);
        if (url) results[Number(id)] = url;
      }
      if (mounted) setCommenterAvatars(results);
    })();
    return () => {
      mounted = false;
    };
  }, [post, token, user?.sub, user?.id]);
  useEffect(() => {
    if (forceOpenComments) setShowComments(true);
  }, [forceOpenComments]);

  return (
    <div
      className="post-card"
      onClick={() => navigate(`/social-feed/${post.id}`)}
      role="button"
      tabIndex={0}
    >
      <div className="post-header">
        <div className="author-info">
          <img
            src={authorAvatar || post.profile_picture_url || ""}
            alt={post.full_name}
            className="avatar"
          />
          <div className="author-details">
            <h4>{post.full_name}</h4>
            <span className="post-time">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        <div className="visibility-badge">
          {post.visibility_type === "company" && "🌍 Company"}
          {post.visibility_type === "warehouse" && "🏬 Warehouse"}
        </div>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        {post.image_url && (
          <img
            src={imageSrc}
            alt="Post"
            className="post-image"
            onError={tryFallback}
            crossOrigin="anonymous"
          />
        )}
      </div>

      <div className="post-stats">
        <span>👍 {post.like_count} Likes</span>
        <span>💬 {post.comment_count} Comments</span>
      </div>

      <div className="post-actions">
        <button
          className={`btn-action ${post.user_liked ? "liked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
        >
          👍 Like
        </button>
        <button
          className="btn-action"
          onClick={(e) => {
            e.stopPropagation();
            if (showComments) {
              setShowComments(false);
            } else {
              handleShowAllComments();
            }
          }}
          disabled={
            loading ||
            ((post.comment_count ?? 0) > 0 &&
              Array.isArray(post.comments) &&
              post.comments.length >= (post.comment_count ?? 0))
          }
        >
          {(() => {
            const total = Number(post.comment_count ?? 0);
            const current = Array.isArray(post.comments)
              ? post.comments.length
              : 0;
            if (showComments && total > 0 && current >= total)
              return "All Comments Shown";
            return showComments ? "Hide Comments" : "Show Comments";
          })()}
        </button>
        <button
          className="btn-action"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/social-feed/${post.id}`);
          }}
        >
          🔎 View
        </button>
      </div>

      {showComments && (
        <div className="comments-section-inline">
          <div className="comments-list">
            {post.comments &&
              post.comments.length > 0 &&
              post.comments.map((comment) => (
                <div key={comment.id} className="comment">
                  <img
                    src={
                      commenterAvatars[
                        Number(
                          comment.user_id ||
                            comment.userId ||
                            comment.author_user_id ||
                            comment.authorId ||
                            0,
                        )
                      ] ||
                      comment.profile_picture_url ||
                      "/default-avatar.png"
                    }
                    alt={comment.full_name}
                    className="avatar-small"
                  />
                  <div className="comment-content">
                    <h5>{comment.full_name}</h5>
                    <p>{comment.comment_text}</p>
                    <span className="comment-time">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {Array.isArray(comment.attachments) &&
                    comment.attachments.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        {comment.attachments.map((att) => {
                          const mt = String(att.mime_type || "");
                          if (mt.startsWith("image/")) {
                            return (
                              <img
                                key={att.id}
                                src={att.file_url}
                                alt={att.file_name || "attachment"}
                                style={{
                                  width: 120,
                                  height: 120,
                                  objectFit: "contain",
                                  border: "1px solid #eee",
                                  borderRadius: 4,
                                  marginRight: 8,
                                }}
                              />
                            );
                          }
                          if (mt.startsWith("video/")) {
                            return (
                              <video
                                key={att.id}
                                src={att.file_url}
                                style={{
                                  width: 180,
                                  height: 120,
                                  objectFit: "contain",
                                  border: "1px solid #eee",
                                  borderRadius: 4,
                                  marginRight: 8,
                                }}
                                controls
                              />
                            );
                          }
                          return (
                            <a
                              key={att.id}
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-block",
                                marginRight: 8,
                              }}
                            >
                              {att.file_name || "Download"}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>

          <form
            onSubmit={handleComment}
            className="p-2 border-t border-slate-200 flex items-center gap-2 flex-wrap md:flex-nowrap w-full"
          >
            <div className="relative">
              <button
                type="button"
                className="w-10 h-10 rounded-full flex items-center justify-center shadow bg-white border border-slate-300 hover:bg-slate-100"
                title="Attach"
                onClick={() => commentFileRef.current?.click()}
                disabled={loading}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.2a2 2 0 1 1-2.83-2.83l8.49-8.49" />
                </svg>
              </button>
              <input
                ref={commentFileRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setNewCommentFile(f);
                  try {
                    if (
                      newCommentPreview &&
                      newCommentPreview.startsWith("blob:")
                    ) {
                      URL.revokeObjectURL(newCommentPreview);
                    }
                  } catch {}
                  if (f && (f.type || "").startsWith("image/")) {
                    try {
                      const u = URL.createObjectURL(f);
                      setNewCommentPreview(u);
                    } catch {
                      setNewCommentPreview(null);
                    }
                  } else if (f && (f.type || "").startsWith("video/")) {
                    try {
                      const u = URL.createObjectURL(f);
                      setNewCommentPreview(u);
                    } catch {
                      setNewCommentPreview(null);
                    }
                  } else {
                    setNewCommentPreview(null);
                  }
                }}
                disabled={loading}
              />
            </div>
            <input
              type="text"
              placeholder="Type a message"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={loading}
              className="input flex-1 w-full min-w-0"
            />
            {newCommentPreview ? (
              (newCommentFile?.type || "").startsWith("image/") ? (
                <img
                  src={newCommentPreview}
                  alt="preview"
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                />
              ) : (newCommentFile?.type || "").startsWith("video/") ? (
                <video
                  src={newCommentPreview}
                  style={{
                    width: 60,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                  muted
                  autoPlay
                  loop
                />
              ) : null
            ) : null}
            <button
              type="submit"
              className="btn"
              disabled={loading || !newComment.trim()}
            >
              {loading ? "..." : "Post"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
