import crypto from "crypto";
import jwt from "jsonwebtoken";

import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import "../utils/loadServerEnv.js";

const REFRESH_COOKIE_NAME =
  String(process.env.REFRESH_TOKEN_COOKIE_NAME || "").trim() ||
  "omnisuite_refresh_token";
const ACCESS_TOKEN_EXPIRES_IN =
  String(process.env.ACCESS_TOKEN_EXPIRES_IN || "").trim() || "15m";
const SESSION_REFRESH_DAYS = Math.max(
  1,
  Number(process.env.REFRESH_TOKEN_SESSION_DAYS || 1),
);
const REMEMBER_REFRESH_DAYS = Math.max(
  SESSION_REFRESH_DAYS,
  Number(process.env.REFRESH_TOKEN_REMEMBER_DAYS || 30),
);
const LOGIN_FAILURE_LIMIT = Math.max(
  1,
  Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5),
);
const LOGIN_FAILURE_COOLDOWN_MINUTES = Math.max(
  1,
  Number(process.env.FAILED_LOGIN_COOLDOWN_MINUTES || 15),
);

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw httpError(500, "SERVER_ERROR", "JWT_SECRET is not configured");
  }
  return secret;
}

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

export function getRefreshTokenCookieName() {
  return REFRESH_COOKIE_NAME;
}

export function parseCookieHeader(cookieHeader = "") {
  const cookies = {};
  const parts = String(cookieHeader || "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function readRefreshTokenFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie || "");
  return cookies[REFRESH_COOKIE_NAME] || null;
}

function buildRefreshCookieOptions({ rememberMe = false, expiresAt = null } = {}) {
  const options = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/api",
  };
  if (rememberMe && expiresAt instanceof Date) {
    options.expires = expiresAt;
    options.maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  }
  return options;
}

export function setRefreshTokenCookie(res, refreshToken, options = {}) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    buildRefreshCookieOptions(options),
  );
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    buildRefreshCookieOptions({ rememberMe: false }),
  );
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(String(token || ""), getJwtSecret());
  if (!payload || typeof payload !== "object" || payload.token_type !== "access") {
    throw httpError(401, "INVALID_TOKEN", "Invalid access token");
  }
  return payload;
}

export function signAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      token_type: "access",
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function ensureAuthTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      refresh_token VARCHAR(255) NOT NULL,
      expiry_date DATETIME NOT NULL,
      remember_me TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_refresh_token_hash (refresh_token),
      KEY idx_refresh_user (user_id),
      KEY idx_refresh_expiry (expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (!(await hasColumn("adm_users", "failed_attempts"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0`,
    );
  }
  if (!(await hasColumn("adm_users", "last_failed_attempt"))) {
    await query(
      `ALTER TABLE adm_users
        ADD COLUMN last_failed_attempt DATETIME NULL`,
    );
  }
}

export async function getUserPermissions(userId) {
  const userRows = await query(
    "SELECT role_id FROM adm_users WHERE id = :userId LIMIT 1",
    { userId },
  ).catch(() => []);
  let roleId = Number(userRows?.[0]?.role_id || 0) || 0;
  if (!roleId) {
    const mappedRoles = await query(
      `SELECT ur.role_id
         FROM adm_user_roles ur
         JOIN adm_roles r ON r.id = ur.role_id
        WHERE ur.user_id = :userId
          AND COALESCE(r.is_active, 1) = 1
        ORDER BY ur.created_at DESC, ur.role_id DESC
        LIMIT 1`,
      { userId },
    ).catch(() => []);
    roleId = Number(mappedRoles?.[0]?.role_id || 0) || 0;
  }

  if (!roleId) return [];

  const permRows = await query(
    `
    SELECT DISTINCT feature_key as code
    FROM adm_role_permissions rp
    WHERE rp.role_id = :roleId AND rp.can_view = 1
    `,
    { roleId },
  ).catch(() => []);

  // Also include any legacy permissions if needed
  const legacyRows = await query(
    `
    SELECT DISTINCT p.code
    FROM adm_users u
    JOIN adm_user_permissions up ON up.user_id = u.id
    JOIN adm_pages p ON p.id = up.page_id
    WHERE u.id = :userId AND up.can_view = 1
    `,
    { userId },
  ).catch(() => []);

  const allPerms = [
    ...permRows.map((row) => row.code),
    ...legacyRows.map((row) => row.code)
  ];

  return Array.from(new Set(allPerms.filter(Boolean)));
}

export async function getUserForAuth(userId) {
  const rows = await query(
    `
    SELECT
      id,
      company_id,
      branch_id,
      username,
      email,
      full_name,
      is_active,
      failed_attempts,
      last_failed_attempt
    FROM adm_users
    WHERE id = :userId
    LIMIT 1
    `,
    { userId },
  );
  return rows[0] || null;
}

export function buildAuthUserPayload(user, permissions = []) {
  const payload = {
    sub: Number(user.id),
    id: Number(user.id),
    username: user.username,
    email: user.email,
    full_name: user.full_name || "",
    permissions: Array.isArray(permissions) ? permissions : [],
    companyIds: user.company_id ? [Number(user.company_id)] : [],
    branchIds: user.branch_id ? [Number(user.branch_id)] : [],
  };

  if (Number(user.id) === 1) {
    payload.permissions = ["*"];
  }

  return payload;
}

export async function createSessionTokens({ user, rememberMe = false, permissions = [] }) {
  await ensureAuthTables();
  const authUser = buildAuthUserPayload(user, permissions);
  const accessToken = signAccessToken(authUser);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = addDays(rememberMe ? REMEMBER_REFRESH_DAYS : SESSION_REFRESH_DAYS);

  await query(
    `
    INSERT INTO refresh_tokens (user_id, refresh_token, expiry_date, remember_me)
    VALUES (:userId, :refreshToken, :expiryDate, :rememberMe)
    `,
    {
      userId: Number(user.id),
      refreshToken: refreshTokenHash,
      expiryDate: expiresAt,
      rememberMe: rememberMe ? 1 : 0,
    },
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    rememberMe: Boolean(rememberMe),
    user: authUser,
  };
}

export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  await query(`DELETE FROM refresh_tokens WHERE refresh_token = :tokenHash`, {
    tokenHash,
  });
}

export async function revokeUserRefreshTokens(userId) {
  await query(`DELETE FROM refresh_tokens WHERE user_id = :userId`, {
    userId: Number(userId),
  });
}

export async function consumeRefreshToken(rawToken) {
  await ensureAuthTables();
  const tokenHash = hashRefreshToken(rawToken);
  const rows = await query(
    `
    SELECT id, user_id, refresh_token, expiry_date, remember_me, created_at
    FROM refresh_tokens
    WHERE refresh_token = :tokenHash
    LIMIT 1
    `,
    { tokenHash },
  );
  const record = rows[0] || null;
  if (!record) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  }
  if (new Date(record.expiry_date).getTime() <= Date.now()) {
    await revokeRefreshToken(rawToken);
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token has expired");
  }
  return {
    id: Number(record.id),
    user_id: Number(record.user_id),
    remember_me: Number(record.remember_me) === 1,
  };
}

export async function rotateRefreshSession(rawToken) {
  const refreshRecord = await consumeRefreshToken(rawToken);
  const user = await getUserForAuth(refreshRecord.user_id);
  if (!user || !Number(user.is_active)) {
    await revokeRefreshToken(rawToken);
    throw httpError(401, "USER_INACTIVE", "User is inactive");
  }

  const permissions = await getUserPermissions(user.id);
  await revokeRefreshToken(rawToken);

  return createSessionTokens({
    user,
    rememberMe: refreshRecord.remember_me,
    permissions,
  });
}

export async function resetFailedLoginAttempts(userId) {
  await ensureAuthTables();
  await query(
    `
    UPDATE adm_users
    SET failed_attempts = 0,
        last_failed_attempt = NULL
    WHERE id = :userId
    `,
    { userId: Number(userId) },
  );
}

export async function registerFailedLoginAttempt(userId) {
  await ensureAuthTables();
  await query(
    `
    UPDATE adm_users
    SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        last_failed_attempt = NOW()
    WHERE id = :userId
    `,
    { userId: Number(userId) },
  );

  const user = await getUserForAuth(userId);
  return Number(user?.failed_attempts || 0);
}

export function requiresPasswordReset(user) {
  const attempts = Number(user?.failed_attempts || 0);
  if (attempts < LOGIN_FAILURE_LIMIT) return false;

  const lastFailed = user?.last_failed_attempt
    ? new Date(user.last_failed_attempt).getTime()
    : 0;
  if (!lastFailed) return true;

  return Date.now() - lastFailed <= LOGIN_FAILURE_COOLDOWN_MINUTES * 60 * 1000;
}
