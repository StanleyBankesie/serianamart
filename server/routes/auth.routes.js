import express from "express";
import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import {
  login,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from "../controllers/auth.controller.js";

dotenv.config();

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  password: Joi.string().min(1).required(),
}).required();

const forgotRequestSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
}).required();

const resetPasswordSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  otp: Joi.string().length(6).required(),
  new_password: Joi.string().min(6).max(100).required(),
}).required();

router.post("/login", (req, res, next) => login(req, res, next));

// Request Password Reset OTP
router.post("/forgot-password/request-otp", (req, res, next) =>
  requestPasswordResetOtp(req, res, next),
);

// Reset Password using OTP
router.post("/forgot-password/reset", (req, res, next) =>
  resetPasswordWithOtp(req, res, next),
);

export default router;
