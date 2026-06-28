import express from "express";
import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getCurrentUser,
  updateCurrentUserPhoto,
  changePassword,
  getMyBranches,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// User Login Endpoint
router.post("/login", (req, res, next) => login(req, res, next));
// Token Refresh Endpoint
router.post("/auth/refresh", (req, res, next) => refreshAccessToken(req, res, next));
// User Logout Endpoint
router.post("/auth/logout", (req, res, next) => logout(req, res, next));
// Get Current Authenticated User Information
router.get("/auth/me", requireAuth, (req, res, next) => getCurrentUser(req, res, next));
// Update Current User Profile Photo
router.put("/auth/me/photo", requireAuth, (req, res, next) => updateCurrentUserPhoto(req, res, next));

// Change User Password Endpoint
router.post("/auth/change-password", requireAuth, (req, res, next) =>
  changePassword(req, res, next),
);

// Fetch Branches Assigned to Current User
router.get("/auth/user-branches", requireAuth, (req, res, next) =>
  getMyBranches(req, res, next),
);

// Request Password Reset OTP Endpoint
router.post("/forgot-password/request-otp", (req, res, next) =>
  requestPasswordResetOtp(req, res, next),
);

// Reset Password using OTP Endpoint
router.post("/forgot-password/reset", (req, res, next) =>
  resetPasswordWithOtp(req, res, next),
);

export default router;
