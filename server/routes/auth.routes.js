import express from "express";
import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", (req, res, next) => login(req, res, next));
router.post("/auth/refresh", (req, res, next) => refreshAccessToken(req, res, next));
router.post("/auth/logout", (req, res, next) => logout(req, res, next));

// Request Password Reset OTP
router.post("/forgot-password/request-otp", (req, res, next) =>
  requestPasswordResetOtp(req, res, next),
);

// Reset Password using OTP
router.post("/forgot-password/reset", (req, res, next) =>
  resetPasswordWithOtp(req, res, next),
);

export default router;
