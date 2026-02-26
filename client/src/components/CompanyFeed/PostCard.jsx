import React, { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [authorAvatar, setAuthorAvatar] = useState(null);
  const [commenterAvatars, setCommenterAvatars] = useState({});
  const [showComments, setShowComments] = useState(!!defaultShowComments);
  const token = localStorage.getItem("token");
  const { user } = useAuth();
  const navigate = useNavigate();
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
      await fetch(`/api/social-feed/${post.id}/like`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "x-user-id": String(uid) },
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
      await fetch(`/api/social-feed/${post.id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-user-id": String(uid) },
      });
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
      const response = await fetch(`/api/social-feed/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-user-id": String(uid),
        },
        body: JSON.stringify({ comment_text: newComment }),
      });

      if (response.ok) {
        const data = await response.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  comments: [...p.comments, data.data],
                  comment_count: p.comment_count + 1,
                }
              : p,
          ),
        );
        setNewComment("");
      }
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
      const res = await fetch(
        `/api/social-feed/${post.id}/comments?offset=${already}&limit=${remaining}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-user-id": String(uid),
          },
        },
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
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
        const res = await fetch(`/api/admin/users/${key}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const item =
          data?.data?.item || data?.item || data?.data || data || null;
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
            c.user_id ||
            c.userId ||
            c.author_user_id ||
            c.authorId ||
            null,
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
                    ] || comment.profile_picture_url || "/default-avatar.png"
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
                </div>
              </div>
            ))}
        </div>

        <form onSubmit={handleComment} className="comment-form">
          <input
            type="text"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !newComment.trim()}>
            {loading ? "..." : "Post"}
          </button>
        </form>
        </div>
      )}
    </div>
  );
}
