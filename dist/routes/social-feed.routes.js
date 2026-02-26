import { Router } from "express";
import {
  getPosts,
  createPost,
  likePost,
  unlikePost,
  addComment,
  getPostById,
  getPostComments,
  getPostLikes,
} from "../controllers/social-feed.controller.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// All routes require authentication and scope
router.use(requireAuth, requireCompanyScope, requireBranchScope);

// ============================================
// 📌 POSTS
// ============================================

// Get posts with visibility filtering
router.get("/", getPosts);

// Get single post by id (with all comments)
router.get("/:postId", getPostById);

router.get("/:postId/comments", getPostComments);
router.get("/:postId/likes", getPostLikes);

// Create post
router.post("/", createPost);

// ============================================
// ❤️ LIKES
// ============================================

// Like post
router.post("/:postId/like", likePost);

// Unlike post
router.delete("/:postId/like", unlikePost);

// ============================================
// 💬 COMMENTS
// ============================================

// Add comment to post
router.post("/:postId/comments", addComment);

export default router;
