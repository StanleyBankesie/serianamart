import { pool } from "../db/pool.js";
import { getIO } from "../utils/socket.js";
import { sendPushToUser } from "../routes/push.routes.js";

/**
 * Social Feed Controller
 * Handles posts, comments, likes with visibility filtering
 */

// ============================================
// 📌 GET POSTS WITH VISIBILITY FILTERING
// ============================================

export const getPosts = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const warehouseId =
      Number(req.user?.warehouse_id) ||
      Number(req.scope?.branchId) ||
      Number(req.query?.warehouseId) ||
      null;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const connection = await pool.getConnection();

    try {
      // Fetch posts visible to user with optimized query
      const [posts] = await connection.query(
        `
        SELECT DISTINCT 
          p.id,
          p.user_id,
          p.content,
          p.image_url,
          p.visibility_type,
          p.warehouse_id,
          p.like_count,
          p.comment_count,
          p.created_at,
          u.full_name,
          u.profile_picture AS profile_picture,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS user_liked
        FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        WHERE 
          (p.visibility_type = 'company')
          OR
          (p.visibility_type = 'warehouse' AND p.warehouse_id = ?)
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [userId, warehouseId, limit, offset],
      );

      // Get latest comments for each post
      const origin = `${req.protocol}://${req.get("host")}`;
      const toAbsoluteImageUrl = (s) => {
        try {
          if (!s) return null;
          const str = String(s);
          if (/^https?:\/\//i.test(str)) {
            try {
              const u = new URL(str);
              if (
                u.hostname === "localhost" &&
                (u.port === "5173" || u.port === "5174" || u.port === "")
              ) {
                return `${origin}${u.pathname}`;
              }
              return str;
            } catch {
              return str;
            }
          }
          if (str.startsWith("/uploads")) return `${origin}${str}`;
          if (str.startsWith("uploads")) return `${origin}/${str}`;
          return str;
        } catch {
          return s;
        }
      };
      const postsWithComments = await Promise.all(
        posts.map(async (post) => {
          const [comments] = await connection.query(
            `
            SELECT 
              pc.id,
              pc.user_id,
              pc.comment_text,
              pc.created_at,
              u.full_name,
              u.profile_picture AS profile_picture
            FROM post_comments pc
            JOIN adm_users u ON pc.user_id = u.id
            WHERE pc.post_id = ?
            ORDER BY pc.created_at DESC
            LIMIT 3
            `,
            [post.id],
          );

          const toUrl = (blob) => {
            if (!blob) return null;
            const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
            let mime = "image/jpeg";
            if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
              mime = "image/jpeg";
            } else if (
              b.length >= 8 &&
              b[0] === 0x89 &&
              b[1] === 0x50 &&
              b[2] === 0x4e &&
              b[3] === 0x47 &&
              b[4] === 0x0d &&
              b[5] === 0x0a &&
              b[6] === 0x1a &&
              b[7] === 0x0a
            ) {
              mime = "image/png";
            } else if (
              b.length >= 12 &&
              b[0] === 0x52 &&
              b[1] === 0x49 &&
              b[2] === 0x46 &&
              b[3] === 0x46 &&
              b[8] === 0x57 &&
              b[9] === 0x45 &&
              b[10] === 0x42 &&
              b[11] === 0x50
            ) {
              mime = "image/webp";
            }
            return `data:${mime};base64,${b.toString("base64")}`;
          };
          const mappedComments = comments
            .reverse()
            .map((c) => ({
              ...c,
              profile_picture_url: toUrl(c.profile_picture),
            }));
          return {
            ...post,
            image_url: toAbsoluteImageUrl(post.image_url),
            profile_picture_url: toUrl(post.profile_picture),
            comments: mappedComments,
            user_liked: post.user_liked === 1,
          };
        }),
      );

      res.json({
        success: true,
        data: postsWithComments,
        pagination: { offset, limit, total: postsWithComments.length },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 📌 GET SINGLE POST WITH ALL COMMENTS
// ============================================
export const getPostById = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `
        SELECT 
          p.id,
          p.user_id,
          p.content,
          p.image_url,
          p.visibility_type,
          p.warehouse_id,
          p.like_count,
          p.comment_count,
          p.created_at,
          u.full_name,
          u.profile_picture AS profile_picture,
          (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS user_liked
        FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        WHERE p.id = ?
        `,
        [userId, postId],
      );
      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }
      const post = rows[0];
      const [comments] = await connection.query(
        `
        SELECT 
          pc.id,
          pc.user_id,
          pc.comment_text,
          pc.created_at,
          u.full_name,
          u.profile_picture AS profile_picture
        FROM post_comments pc
        JOIN adm_users u ON pc.user_id = u.id
        WHERE pc.post_id = ?
        ORDER BY pc.created_at ASC
        `,
        [postId],
      );
      const toUrl = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const mappedComments = comments.map((c) => ({
        ...c,
        profile_picture_url: toUrl(c.profile_picture),
      }));
      const origin = `${req.protocol}://${req.get("host")}`;
      const toAbsoluteImageUrl = (s) => {
        try {
          if (!s) return null;
          const str = String(s);
          if (/^https?:\/\//i.test(str)) {
            try {
              const u = new URL(str);
              if (
                u.hostname === "localhost" &&
                (u.port === "5173" || u.port === "5174" || u.port === "")
              ) {
                return `${origin}${u.pathname}`;
              }
              return str;
            } catch {
              return str;
            }
          }
          if (str.startsWith("/uploads")) return `${origin}${str}`;
          if (str.startsWith("uploads")) return `${origin}/${str}`;
          return str;
        } catch {
          return s;
        }
      };
      res.json({
        success: true,
        data: {
          ...post,
          image_url: toAbsoluteImageUrl(post.image_url),
          profile_picture_url: toUrl(post.profile_picture),
          comments: mappedComments,
          user_liked: post.user_liked === 1,
        },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ============================================
// 📝 CREATE POST
// ============================================

export const createPost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const warehouseId =
      Number(req.user?.warehouse_id) ||
      Number(req.scope?.branchId) ||
      Number(req.body?.warehouse_id) ||
      null;
    const companyId = Number(req.scope?.companyId) || 1;
    const { content, image_url, visibility_type } = req.body;

    // Validation
    if (!content || content.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    if (!["company", "warehouse"].includes(visibility_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visibility type",
      });
    }
    if (visibility_type === "warehouse" && !Number.isFinite(warehouseId)) {
      return res.status(400).json({
        success: false,
        message: "Warehouse ID required for warehouse visibility",
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Create post
      const [postResult] = await connection.query(
        `
        INSERT INTO posts (user_id, content, image_url, visibility_type, warehouse_id)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          content,
          image_url || null,
          visibility_type,
          visibility_type === "warehouse" ? warehouseId : null,
        ],
      );

      const postId = postResult.insertId;

      await connection.commit();

      // Fetch created post with user info
      const [post] = await connection.query(
        `
        SELECT 
          p.*,
          u.full_name,
          u.profile_picture AS profile_picture
        FROM posts p
        JOIN adm_users u ON p.user_id = u.id
        WHERE p.id = ?
        `,
        [postId],
      );

      const toUrl = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const createdPost = {
        ...post[0],
        profile_picture_url: toUrl(post[0]?.profile_picture),
      };

      try {
        broadcastNewPost(createdPost, visibility_type, warehouseId);
      } catch {}

      try {
        await triggerPostNotifications(
          postId,
          userId,
          "post_created",
          visibility_type,
          warehouseId,
          companyId,
        );
      } catch {}

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: { ...createdPost, comments: [], user_liked: false },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const connection = await pool.getConnection();
    try {
      const [comments] = await connection.query(
        `
        SELECT 
          pc.id,
          pc.user_id,
          pc.comment_text,
          pc.created_at,
          u.full_name,
          u.profile_picture AS profile_picture
        FROM post_comments pc
        JOIN adm_users u ON pc.user_id = u.id
        WHERE pc.post_id = ?
        ORDER BY pc.created_at ASC
        LIMIT ? OFFSET ?
        `,
        [postId, limit, offset],
      );
      const toUrl2 = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const mapped = comments.map((c) => ({
        ...c,
        profile_picture_url: toUrl2(c.profile_picture),
      }));
      res.json({
        success: true,
        data: mapped,
        pagination: { offset, limit, total: mapped.length },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const connection = await pool.getConnection();
    try {
      const [likes] = await connection.query(
        `
        SELECT 
          pl.user_id,
          u.full_name,
          u.profile_picture AS profile_picture
        FROM post_likes pl
        JOIN adm_users u ON pl.user_id = u.id
        WHERE pl.post_id = ?
        ORDER BY u.full_name ASC
        LIMIT ? OFFSET ?
        `,
        [postId, limit, offset],
      );
      const toUrl = (blob) => {
        if (!blob) return null;
        const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
        let mime = "image/jpeg";
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          b.length >= 8 &&
          b[0] === 0x89 &&
          b[1] === 0x50 &&
          b[2] === 0x4e &&
          b[3] === 0x47 &&
          b[4] === 0x0d &&
          b[5] === 0x0a &&
          b[6] === 0x1a &&
          b[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x45 &&
          b[10] === 0x42 &&
          b[11] === 0x50
        ) {
          mime = "image/webp";
        }
        return `data:${mime};base64,${b.toString("base64")}`;
      };
      const mapped = likes.map((l) => ({
        user_id: l.user_id,
        full_name: l.full_name,
        profile_picture_url: toUrl(l.profile_picture),
      }));
      res.json({
        success: true,
        data: mapped,
        pagination: { offset, limit, total: mapped.length },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ============================================
// ❤️ LIKE POST
// ============================================

export const likePost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const companyId = Number(req.scope?.companyId) || 1;

    const connection = await pool.getConnection();

    try {
      // Check if user already liked
      const [existingLike] = await connection.query(
        `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );

      if (existingLike.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Already liked this post" });
      }

      // Add like
      await connection.query(
        `INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`,
        [postId, userId],
      );

      // Increment like count
      await connection.query(
        `UPDATE posts SET like_count = like_count + 1 WHERE id = ?`,
        [postId],
      );

      // Get post info for notifications
      const [postRows] = await connection.query(
        `SELECT user_id, visibility_type, warehouse_id FROM posts WHERE id = ?`,
        [postId],
      );

      const postOwnerId = postRows[0]?.user_id;

      // 🔔 BROADCAST LIKE VIA SOCKET.IO
      try {
        broadcastLike(postId, userId, postOwnerId);
      } catch {}

      // 📧 TRIGGER LIKE NOTIFICATION
      if (postOwnerId !== userId) {
        try {
          await triggerLikeNotification(postId, userId, postOwnerId, companyId);
        } catch {}
      }

      res.json({
        success: true,
        message: "Post liked",
        like_count: (
          await connection.query(`SELECT like_count FROM posts WHERE id = ?`, [
            postId,
          ])
        )[0][0].like_count,
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 💔 UNLIKE POST
// ============================================

export const unlikePost = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;

    const connection = await pool.getConnection();

    try {
      // Check if user liked
      const [existingLike] = await connection.query(
        `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );

      if (existingLike.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Haven't liked this post" });
      }

      // Remove like
      await connection.query(
        `DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`,
        [postId, userId],
      );

      // Decrement like count
      await connection.query(
        `UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?`,
        [postId],
      );

      res.json({
        success: true,
        message: "Post unliked",
        like_count: (
          await connection.query(`SELECT like_count FROM posts WHERE id = ?`, [
            postId,
          ])
        )[0][0].like_count,
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 💬 ADD COMMENT
// ============================================

export const addComment = async (req, res) => {
  try {
    const userId =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    const { postId } = req.params;
    const { comment_text } = req.body;
    const companyId = Number(req.scope?.companyId) || 1;

    if (!comment_text || comment_text.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Comment text is required" });
    }

    const connection = await pool.getConnection();

    try {
      // Add comment
      const [result] = await connection.query(
        `INSERT INTO post_comments (post_id, user_id, comment_text) VALUES (?, ?, ?)`,
        [postId, userId, comment_text],
      );

      // Increment comment count
      await connection.query(
        `UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`,
        [postId],
      );

      // Get comment with user info
      const [comment] = await connection.query(
        `
        SELECT 
          pc.*,
          u.full_name,
          u.profile_picture AS profile_picture
        FROM post_comments pc
        JOIN adm_users u ON pc.user_id = u.id
        WHERE pc.id = ?
        `,
        [result.insertId],
      );

      // Get post info for notifications
      const [postRows] = await connection.query(
        `SELECT user_id FROM posts WHERE id = ?`,
        [postId],
      );

      const postOwnerId = postRows[0]?.user_id;

      // 🔔 BROADCAST COMMENT VIA SOCKET.IO
      try {
        const c0 = comment[0] || {};
        const b = c0.profile_picture || null;
        let url = null;
        if (b) {
          const buf = Buffer.isBuffer(b) ? b : Buffer.from(b);
          let mime = "image/jpeg";
          if (
            buf.length >= 3 &&
            buf[0] === 0xff &&
            buf[1] === 0xd8 &&
            buf[2] === 0xff
          ) {
            mime = "image/jpeg";
          } else if (
            buf.length >= 8 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
          ) {
            mime = "image/png";
          } else if (
            buf.length >= 12 &&
            buf[0] === 0x52 &&
            buf[1] === 0x49 &&
            buf[2] === 0x46 &&
            buf[3] === 0x46 &&
            buf[8] === 0x57 &&
            buf[9] === 0x45 &&
            buf[10] === 0x42 &&
            buf[11] === 0x50
          ) {
            mime = "image/webp";
          }
          url = `data:${mime};base64,${buf.toString("base64")}`;
        }
        broadcastComment(postId, { ...c0, profile_picture_url: url });
      } catch {}

      // 📧 TRIGGER COMMENT NOTIFICATION
      if (postOwnerId !== userId) {
        try {
          await triggerCommentNotification(
            postId,
            userId,
            postOwnerId,
            companyId,
          );
        } catch {}
      }

      const c0 = comment[0] || {};
      let url = null;
      if (c0.profile_picture) {
        const buf = Buffer.isBuffer(c0.profile_picture)
          ? c0.profile_picture
          : Buffer.from(c0.profile_picture);
        let mime = "image/jpeg";
        if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
          mime = "image/jpeg";
        } else if (
          buf.length >= 8 &&
          buf[0] === 0x89 &&
          buf[1] === 0x50 &&
          buf[2] === 0x4e &&
          buf[3] === 0x47 &&
          buf[4] === 0x0d &&
          buf[5] === 0x0a &&
          buf[6] === 0x1a &&
          buf[7] === 0x0a
        ) {
          mime = "image/png";
        } else if (
          buf.length >= 12 &&
          buf[0] === 0x52 &&
          buf[1] === 0x49 &&
          buf[2] === 0x46 &&
          buf[3] === 0x46 &&
          buf[8] === 0x57 &&
          buf[9] === 0x45 &&
          buf[10] === 0x42 &&
          buf[11] === 0x50
        ) {
          mime = "image/webp";
        }
        url = `data:${mime};base64,${buf.toString("base64")}`;
      }
      res.status(201).json({
        success: true,
        message: "Comment added",
        data: { ...c0, profile_picture_url: url },
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 🔔 SOCKET.IO BROADCAST FUNCTIONS
// ============================================

const broadcastNewPost = (post, visibility_type, warehouseId) => {
  try {
    const io = getIO();

    if (visibility_type === "company") {
      io.to("company").emit("new_post", post);
    } else if (visibility_type === "warehouse") {
      io.to(`warehouse_${warehouseId}`).emit("new_post", post);
    }
  } catch (error) {
    console.error("Error broadcasting new post:", error);
  }
};

const broadcastLike = (postId, userId, postOwnerId) => {
  try {
    const io = getIO();
    io.to(`user_${postOwnerId}`).emit("post_liked", {
      postId,
      likedBy: userId,
    });
  } catch (error) {
    console.error("Error broadcasting like:", error);
  }
};

const broadcastComment = (postId, comment) => {
  try {
    const io = getIO();
    io.to(`post_${postId}`).emit("post_commented", {
      postId,
      comment,
    });
  } catch (error) {
    console.error("Error broadcasting comment:", error);
  }
};

// ============================================
// 📧 NOTIFICATION FUNCTIONS
// ============================================

const triggerPostNotifications = async (
  postId,
  userId,
  type,
  visibility_type,
  warehouseId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT full_name FROM adm_users WHERE id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    let targetUsers = [];

    if (visibility_type === "company") {
      // Notify all users except poster
      const [allUsers] = await connection.query(
        `SELECT id FROM adm_users WHERE id != ?`,
        [userId],
      );
      targetUsers = allUsers.map((u) => u.id);
    } else if (visibility_type === "warehouse") {
      // Notify warehouse users except poster
      const [warehouseUsers] = await connection.query(
        `SELECT id FROM adm_users WHERE warehouse_id = ? AND id != ?`,
        [warehouseId, userId],
      );
      targetUsers = warehouseUsers.map((u) => u.id);
    }

    // Insert notifications and send push notifications
    for (const targetUserId of targetUsers) {
      try {
        await connection.query(
          `
          INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
          VALUES (?, ?, ?, ?, ?, 0)
          `,
          [
            companyId,
            targetUserId,
            `New post from ${userName}`,
            `${userName} posted a new update`,
            `/social-feed/${postId}`,
          ],
        );
      } catch {}

      // Send push notification
      try {
        await sendPushToUser(targetUserId, {
          title: `New post from ${userName}`,
          body: `${userName} posted a new update`,
          icon: "/logo.png",
          badge: "/badge.png",
          tag: "social-post",
          data: {
            url: `/social-feed/${postId}`,
            type: "post",
            postId,
          },
        });
      } catch (pushError) {
        console.error(
          `Failed to send push notification to user ${targetUserId}:`,
          pushError,
        );
      }
    }
  } catch (error) {
    console.error("Error triggering post notifications:", error);
  } finally {
    await connection.release();
  }
};

const triggerLikeNotification = async (
  postId,
  userId,
  postOwnerId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT full_name FROM adm_users WHERE id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    try {
      await connection.query(
        `
        INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
        [
          companyId,
          postOwnerId,
          `${userName} liked your post`,
          `${userName} liked your post`,
          `/social-feed/${postId}`,
        ],
      );
    } catch {}

    // Send push notification to post owner
    try {
      await sendPushToUser(postOwnerId, {
        title: `${userName} liked your post`,
        body: "Your post received a like",
        icon: "/logo.png",
        badge: "/badge.png",
        tag: "post-like",
        data: {
          url: `/social-feed/${postId}`,
          type: "like",
          postId,
        },
      });
    } catch (pushError) {
      console.error(
        `Failed to send push notification to user ${postOwnerId}:`,
        pushError,
      );
    }
  } catch (error) {
    console.error("Error triggering like notification:", error);
  } finally {
    await connection.release();
  }
};

const triggerCommentNotification = async (
  postId,
  userId,
  postOwnerId,
  companyId = 1,
) => {
  const connection = await pool.getConnection();

  try {
    const [userRows] = await connection.query(
      `SELECT full_name FROM adm_users WHERE id = ?`,
      [userId],
    );
    const userName = userRows[0]?.full_name || "User";

    try {
      await connection.query(
        `
        INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
        VALUES (?, ?, ?, ?, ?, 0)
        `,
        [
          companyId,
          postOwnerId,
          `${userName} commented on your post`,
          `${userName} commented on your post`,
          `/social-feed/${postId}`,
        ],
      );
    } catch {}

    // Send push notification to post owner
    try {
      await sendPushToUser(postOwnerId, {
        title: `${userName} commented on your post`,
        body: "Your post received a new comment",
        icon: "/logo.png",
        badge: "/badge.png",
        tag: "post-comment",
        data: {
          url: `/social-feed/${postId}`,
          type: "comment",
          postId,
        },
      });
    } catch (pushError) {
      console.error(
        `Failed to send push notification to user ${postOwnerId}:`,
        pushError,
      );
    }
  } catch (error) {
    console.error("Error triggering comment notification:", error);
  } finally {
    await connection.release();
  }
};
