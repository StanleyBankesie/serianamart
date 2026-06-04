import express from "express";
import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getCurrentUser,
  updateCurrentUserPhoto,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", (req, res, next) => login(req, res, next));
router.post("/auth/refresh", (req, res, next) => refreshAccessToken(req, res, next));
router.post("/auth/logout", (req, res, next) => logout(req, res, next));
router.get("/auth/me", requireAuth, (req, res, next) => getCurrentUser(req, res, next));
router.put("/auth/me/photo", requireAuth, (req, res, next) => updateCurrentUserPhoto(req, res, next));

// Request Password Reset OTP
router.post("/forgot-password/request-otp", (req, res, next) =>
  requestPasswordResetOtp(req, res, next),
);

// Reset Password using OTP
router.post("/forgot-password/reset", (req, res, next) =>
  resetPasswordWithOtp(req, res, next),
);

export default router;
