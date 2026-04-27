import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CompanyFeed from "../../components/CompanyFeed/CompanyFeed";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/client";
import { getStoredToken } from "../../auth/authStorage.js";

export default function SocialFeedPage() {
  const params = useParams();
  const focusId = params?.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [post, setPost] = useState(null);
  const [likes, setLikes] = useState([]);
  const [imageSrc, setImageSrc] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const isFocus = Number.isFinite(focusId) && focusId > 0;
    if (!isFocus || !user) {
      setPost(null);
      setLikes([]);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }
    (async () => {
      try {
        setDetailsLoading(true);
        setDetailsError(null);
        const uid = Number(user?.sub || user?.id) || "";
        const headers = {
          Authorization: `Bearer ${getStoredToken() || ""}`,
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
    </div>
  );
}
