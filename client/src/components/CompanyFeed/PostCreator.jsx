import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import "./PostCreator.css";
import { toast } from "react-toastify";

export default function PostCreator({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [visibilityType, setVisibilityType] = useState("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfilePic, setUserProfilePic] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch user profile picture from adm_users table
  useEffect(() => {
    if (!user?.id && !user?.sub) return;
    const fetchUserProfile = async () => {
      try {
        const userId = Number(user?.sub || user?.id) || 0;
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const resMe = await fetch(`/api/admin/me`, { headers });
        if (resMe.ok) {
          const data = await resMe.json();
          const ctx = data?.data || data || null;
          const url =
            ctx?.user?.profile_picture_url || ctx?.profile_picture_url || null;
          if (url) {
            setUserProfilePic(url);
            return;
          }
        }
        if (userId > 0) {
          const resUser = await fetch(`/api/admin/users/${userId}`, {
            headers,
          });
          if (resUser.ok) {
            const data2 = await resUser.json();
            const item =
              data2?.data?.item || data2?.item || data2?.data || data2 || null;
            const url2 = item?.profile_picture_url || null;
            setUserProfilePic(url2 || "/default-avatar.png");
            return;
          }
        }
        setUserProfilePic("/default-avatar.png");
      } catch {
        setUserProfilePic("/default-avatar.png");
      }
    };
    fetchUserProfile();
  }, [user?.id, user?.sub]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed");
      return;
    }

    if (file.size > maxSize) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Local preview immediately
    try {
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
    } catch {}

    // Upload image
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    fetch("/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then(async (res) => {
        let payload = null;
        try {
          payload = await res.json();
        } catch {}
        if (!res.ok) {
          const msg =
            (payload && (payload.message || payload.error)) || "Upload failed";
          setError(msg);
          return;
        }
        const url =
          payload?.url ||
          payload?.data?.url ||
          payload?.path || // fallback relative path
          null;
        if (!url) {
          setError("Upload failed");
          return;
        }
        setImageUrl(url);
        // Move preview to final URL if absolute arrives
        if (typeof url === "string" && /^(data:|https?:)/i.test(url)) {
          setPreviewUrl(url);
        }
        setError(null);
      })
      .catch((err) => {
        setError("Upload error: " + err.message);
      })
      .finally(() => setLoading(false));
  };

  // Revoke object URL when preview changes or on cleanup
  useEffect(() => {
    return () => {
      try {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch {}
    };
  }, [previewUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("Please enter some content");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uid = Number(user?.sub || user?.id) || "";
      const response = await fetch("/api/social-feed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-user-id": String(uid),
        },
        body: JSON.stringify({
          content,
          image_url: imageUrl,
          visibility_type: visibilityType,
        }),
      });

      if (!response.ok) {
        let message = "Failed to create post";
        try {
          const text = await response.text();
          try {
            const parsed = JSON.parse(text);
            message = parsed.message || message;
          } catch {
            message = text || message;
          }
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      onPostCreated(data.data);
      try {
        toast.success("Post created successfully");
      } catch {}

      // Reset form
      setContent("");
      setImageUrl(null);
      try {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch {}
      setPreviewUrl(null);
      setVisibilityType("company");
      setError(null);
    } catch (err) {
      console.error("Error creating post:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-creator-card">
      <div className="post-creator-header">
        <img
          src={userProfilePic || "/default-avatar.png"}
          alt={user?.name || user?.username || "User"}
          className="avatar"
        />
        <form onSubmit={handleSubmit} className="post-form">
          <textarea
            className="post-input"
            placeholder="Start chat"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="3"
          />

          {imageUrl && (
            <div className="image-preview">
              <img src={previewUrl || imageUrl} alt="Preview" />
              <button
                type="button"
                onClick={() => {
                  setImageUrl(null);
                  try {
                    if (previewUrl && previewUrl.startsWith("blob:")) {
                      URL.revokeObjectURL(previewUrl);
                    }
                  } catch {}
                  setPreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="btn-remove-image"
              >
                ✕
              </button>
            </div>
          )}

          <div className="post-actions">
            <div className="left-actions">
              <button
                type="button"
                className="btn-icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                📷 Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />

              <select
                value={visibilityType}
                onChange={(e) => setVisibilityType(e.target.value)}
                className="visibility-select"
              >
                <option value="company">🌍 Company</option>
                <option value="warehouse">🏬 My Warehouse</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-post"
              disabled={loading || !content.trim()}
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      {/* Selected users visibility removed */}
    </div>
  );
}
