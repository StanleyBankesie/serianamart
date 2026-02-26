import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import PostCreator from "./PostCreator";
import PostList from "./PostList";
import { useSocket } from "../../hooks/useSocket";
import "./CompanyFeed.css";

export default function CompanyFeed({
  compact = false,
  focusId = null,
  hideCreator = false,
}) {
  const { user } = useAuth();
  const socket = useSocket();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const [forceOpenComments, setForceOpenComments] = useState(false);
  const autoLoadedRef = useRef(false);

  const fetchPosts = useCallback(
    async (pageOffset = 0) => {
      if (!user) return;

      try {
        setLoading(true);
        const uid = Number(user?.sub || user?.id) || "";
        const isFocus = Number.isFinite(focusId) && focusId > 0;
        const url = isFocus
          ? `/api/social-feed/${focusId}`
          : `/api/social-feed?offset=${pageOffset}&limit=20`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "x-user-id": String(uid),
          },
        });

        if (!response.ok) throw new Error("Failed to fetch posts");

        const data = await response.json();
        if (isFocus) {
          const post = data?.data ? data.data : null;
          setPosts(post ? [post] : []);
        } else {
          const items = Array.isArray(data.data) ? data.data : [];
          if (pageOffset === 0) {
            setPosts(items);
          } else {
            setPosts((prev) => [...prev, ...items]);
          }
        }
        setOffset(pageOffset);
      } catch (err) {
        console.error("Error fetching posts:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Initial load
  useEffect(() => {
    fetchPosts(0);
  }, [user, fetchPosts]);

  // Socket.io listeners for real-time updates (likes only)
  useEffect(() => {
    if (!socket) return;

    // Listen for likes
    socket.on("post_liked", (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.postId
            ? { ...post, like_count: post.like_count + 1 }
            : post,
        ),
      );
    });

    return () => {
      socket.off("post_liked");
    };
  }, [socket]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
    try {
      if (compact && Number.isFinite(Number(newPost?.id)) && newPost.id > 0) {
        navigate(`/social-feed/${newPost.id}`);
      }
    } catch {}
  };

  const handleLoadMore = async () => {
    const isFocus = Number.isFinite(focusId) && focusId > 0;
    if (isFocus) {
      try {
        const current = posts[0];
        if (!current) return;
        const already = Array.isArray(current.comments)
          ? current.comments.length
          : 0;
        const total = Number(current.comment_count || already);
        const remaining = Math.max(total - already, 0);
        setLoading(true);
        const uid = Number(user?.sub || user?.id) || "";
        const res = await fetch(
          `/api/social-feed/${focusId}/comments?offset=${already}&limit=${remaining || 20}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "x-user-id": String(uid),
            },
          },
        );
        if (!res.ok) throw new Error("Failed to load comments");
        const data = await res.json();
        const more = Array.isArray(data.data) ? data.data : [];
        setPosts((prev) => {
          if (!prev.length) return prev;
          const p = prev[0];
          const seen = new Set((p.comments || []).map((c) => c.id));
          const merged = [
            ...(p.comments || []),
            ...more.filter((c) => !seen.has(c.id)),
          ];
          const np = { ...p, comments: merged, comment_count: p.comment_count };
          return [np, ...prev.slice(1)];
        });
        setForceOpenComments(true);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    fetchPosts(offset + 20);
  };

  // Auto-load all comments when viewing a single post
  useEffect(() => {
    const isFocus = Number.isFinite(focusId) && focusId > 0;
    const current = posts[0];
    if (!isFocus || !current) return;
    const already = Array.isArray(current.comments) ? current.comments.length : 0;
    const total = Number(current.comment_count || already);
    if (autoLoadedRef.current) return;
    if (total > already) {
      autoLoadedRef.current = true;
      // load remaining comments once
      (async () => {
        try {
          await handleLoadMore();
        } catch {}
      })();
    }
  }, [focusId, posts]);

  if (!user) {
    return (
      <div className="company-feed-container">
        <p>Please log in to view the company feed.</p>
      </div>
    );
  }

  // For compact mode, show PostCreator only (badge now separate)
  if (compact) {
    return (
      <div className="company-feed-container">
        <PostCreator onPostCreated={handlePostCreated} />
      </div>
    );
  }

  // Full social feed view
  return (
    <div className="company-feed-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Social Feed</h2>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      {!hideCreator && !(Number.isFinite(focusId) && focusId > 0) && (
        <PostCreator onPostCreated={handlePostCreated} />
      )}

      {loading && posts.length === 0 ? (
        <div className="loading-spinner">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <>
          <PostList
            posts={posts}
            setPosts={setPosts}
            defaultShowComments={false}
            forceOpenComments={forceOpenComments}
          />
          <button
            className="btn-load-more"
            onClick={handleLoadMore}
            disabled={
              loading ||
              (Number.isFinite(focusId) &&
                focusId > 0 &&
                (posts[0]?.comment_count ?? 0) > 0 &&
                (posts[0]?.comments?.length ?? 0) >=
                  (posts[0]?.comment_count ?? 0))
            }
          >
            {loading
              ? "Loading..."
              : Number.isFinite(focusId) &&
                  focusId > 0 &&
                  (posts[0]?.comment_count ?? 0) > 0 &&
                  (posts[0]?.comments?.length ?? 0) >=
                    (posts[0]?.comment_count ?? 0)
                ? "All comments loaded"
                : "Load More"}
          </button>
        </>
      )}
    </div>
  );
}
