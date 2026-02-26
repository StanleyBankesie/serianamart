import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CompanyFeed from "../../components/CompanyFeed/CompanyFeed";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/client";

export default function SocialFeedPage() {
  const params = useParams();
  const focusId = params?.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [post, setPost] = useState(null);
  const [likes, setLikes] = useState([]);
  const [imageSrc, setImageSrc] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const isFocus = Number.isFinite(focusId) && focusId > 0;
    if (!isFocus || !user) {
      setModalOpen(false);
      setPost(null);
      setLikes([]);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }
    (async () => {
      try {
        setModalOpen(true);
        setDetailsLoading(true);
        setDetailsError(null);
        const uid = Number(user?.sub || user?.id) || "";
        const headers = {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-user-id": String(uid),
        };
        const res = await fetch(`/api/social-feed/${focusId}`, { headers });
        if (!res.ok) throw new Error("Failed to load post");
        const data = await res.json();
        const item = data?.data || null;
        setPost(item);
        try {
          const raw = String(item?.image_url || "");
          if (raw) {
            // initial resolve similar to PostCard
            let src = raw;
            if (!/^(data:|https?:)/i.test(src)) {
              if (src.startsWith("/uploads")) {
                const base = String(api.defaults.baseURL || "");
                let origin = "";
                if (/^https?:\/\//i.test(base)) {
                  try {
                    const u = new URL(base);
                    origin = `${u.protocol}//${u.host}`;
                  } catch {}
                } else if (typeof window !== "undefined" && window.location) {
                  origin = window.location.origin;
                }
                src = origin ? origin + src : src;
              }
            }
            setImageSrc(src);
          } else {
            setImageSrc(null);
          }
        } catch {
          setImageSrc(item?.image_url || null);
        }
        const res2 = await fetch(`/api/social-feed/${focusId}/likes`, {
          headers,
        });
        if (res2.ok) {
          const data2 = await res2.json();
          setLikes(Array.isArray(data2.data) ? data2.data : []);
        } else {
          setLikes([]);
        }
      } catch (e) {
        setDetailsError(e.message || "Failed to load post");
        setPost(null);
        setLikes([]);
      } finally {
        setDetailsLoading(false);
      }
    })();
  }, [focusId, user]);

  const closeModal = () => {
    setModalOpen(false);
    navigate("/social-feed");
  };
  useEffect(() => {
    return () => {
      try {
        if (blobUrl && blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrl);
        }
      } catch {}
    };
  }, [blobUrl]);
  const tryImageFallback = async () => {
    try {
      const raw = String(post?.image_url || "");
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
      const candidates = [];
      // absolute localhost rewrite
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            candidates.push(`${currentOrigin}${u.pathname}`);
            if (apiOrigin) candidates.push(`${apiOrigin}${u.pathname}`);
          }
        }
      } catch {}
      if (raw.startsWith("/uploads")) {
        candidates.push(`${currentOrigin}${raw}`);
        if (apiOrigin) candidates.push(`${apiOrigin}${raw}`);
      } else if (raw.startsWith("uploads")) {
        candidates.push(`${currentOrigin}/${raw}`);
        if (apiOrigin) candidates.push(`${apiOrigin}/${raw}`);
      }
      candidates.push(raw);
      for (const candidate of candidates) {
        if (!candidate || candidate === imageSrc) continue;
        try {
          const resp = await fetch(candidate, { mode: "cors" });
          if (resp && resp.ok) {
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
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
    } catch {}
  };
  return (
    <div className="bg-white rounded-xl shadow-erp p-6 border border-slate-100 relative">
      <CompanyFeed focusId={focusId} hideCreator />
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-erp-lg w-full max-w-6xl overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {post?.full_name || "Post"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {detailsLoading ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : detailsError ? (
                <div className="text-sm text-red-600">{detailsError}</div>
              ) : post ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <img
                        src={post.profile_picture_url || "/default-avatar.png"}
                        alt={post.full_name}
                        className="w-10 h-10 rounded-full border border-slate-200"
                      />
                      <div>
                        <div className="text-sm font-semibold">
                          {post.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {post.created_at
                            ? new Date(post.created_at).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    </div>
                    {post.image_url && (
                      <img
                        src={imageSrc || post.image_url}
                        alt="Post"
                        className="w-full max-h-[60vh] object-contain rounded-md border border-slate-200 mt-3"
                        onError={tryImageFallback}
                        crossOrigin="anonymous"
                      />
                    )}
                    <div className="mt-3 text-sm text-slate-700">
                      {post.content}
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      👍 {Number(post.like_count || 0)} Likes • 💬{" "}
                      {Number(post.comment_count || 0)} Comments
                    </div>
                    <div className="mt-4">
                      <div className="text-sm font-semibold mb-2">
                        Users who liked this post
                      </div>
                      {likes.length === 0 ? (
                        <div className="text-xs text-slate-500">No likes yet.</div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {likes.map((u) => (
                            <div
                              key={u.user_id}
                              className="flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200"
                            >
                              <img
                                src={u.profile_picture_url || "/default-avatar.png"}
                                alt={u.full_name}
                                className="w-6 h-6 rounded-full border border-slate-200"
                              />
                              <div className="text-xs">{u.full_name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">
                      Comments
                    </div>
                    <div className="space-y-3">
                      {Array.isArray(post.comments) && post.comments.length > 0 ? (
                        post.comments.map((c) => (
                          <div key={c.id} className="flex items-start gap-2">
                            <img
                              src={c.profile_picture_url || "/default-avatar.png"}
                              alt={c.full_name}
                              className="w-7 h-7 rounded-full border border-slate-200"
                            />
                            <div className="flex-1">
                              <div className="text-xs font-semibold">
                                {c.full_name}
                              </div>
                              <div className="text-sm">{c.comment_text}</div>
                              <div className="text-[11px] text-slate-500">
                                {new Date(c.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500">
                          No comments yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
