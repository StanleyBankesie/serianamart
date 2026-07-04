import { httpError } from "../utils/httpError.js";
import {
  verifyAccessToken,
  lookupGraceToken,
} from "../services/token.service.js";
import { query } from "../db/pool.js";
import { parseCookieHeader } from "../services/token.service.js";
import { cacheGet, cacheSet } from "../utils/redis.js";
import "../utils/loadServerEnv.js";

// Utility function to check if authentication bypass is allowed in development environment
function allowDevBypass() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.AUTH_ALLOW_DEV_BYPASS || "").trim() === "1"
  );
}

// Utility function to attach a mock developer user to the request for development bypassing
function attachDevUser(req) {
  req.user = {
    sub: 1,
    id: 1,
    username: "dev",
    email: "dev@local",
    permissions: ["*"],
    companyIds: [1],
    branchIds: [1],
  };
}

/**
 * Middleware to require a valid access token.
 * Sets req.user and req.permissions if successful.
 * Uses Redis grace period to accept recently-refreshed tokens during transition.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const sessionId = cookies.omnisuite_session;
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    console.log(
      `[AUTH-MIDDLEWARE] Cookie header: ${req.headers.cookie ? req.headers.cookie.substring(0, 50) + "..." : "empty"}, sessionId: ${sessionId ? sessionId.substring(0, 8) + "..." : "none"}`,
    );

    if (sessionId) {
      const sessionData = await cacheGet(`omnisuite_session:${sessionId}`);
      console.log(
        `[AUTH-MIDDLEWARE] Looking up omnisuite_session:${sessionId.substring(0, 8)}... found: ${sessionData ? "YES" : "NO"}`,
      );

      if (sessionData && sessionData.user) {
        // Slide session TTL
        const ttlSeconds =
          Number(process.env.SESSION_REFRESH_HOURS || 7 * 24) * 60 * 60;
        await cacheSet(
          `omnisuite_session:${sessionId}`,
          sessionData,
          ttlSeconds,
        ).catch(() => {});
        console.log(
          `[AUTH-MIDDLEWARE] Session authenticated for user: ${sessionData.user.username}`,
        );

        req.user = {
          ...(req.user || {}),
          ...sessionData.user,
        };
        req.scope = req.scope || {};
        req.scope.userId =
          Number(sessionData.user.sub || sessionData.user.id) || null;
        return next();
      }
    }

    if (bearerToken) {
      try {
        const payload = verifyAccessToken(bearerToken);
        req.user = {
          ...(req.user || {}),
          ...payload,
        };
        req.scope = req.scope || {};
        req.scope.userId = Number(payload.sub || payload.id) || null;
        console.log(
          `[AUTH-MIDDLEWARE] Bearer token authenticated for user: ${payload.username || payload.sub || payload.id}`,
        );
        return next();
      } catch (tokenErr) {
        const gracePayload = await lookupGraceToken(bearerToken);
        if (gracePayload) {
          req.user = {
            ...(req.user || {}),
            ...gracePayload,
          };
          req.scope = req.scope || {};
          req.scope.userId =
            Number(gracePayload.sub || gracePayload.id) || null;
          console.log(
            `[AUTH-MIDDLEWARE] Grace token authenticated for user: ${gracePayload.username || gracePayload.sub || gracePayload.id}`,
          );
          return next();
        }
        console.warn(
          `[AUTH-MIDDLEWARE] Bearer token rejected: ${tokenErr?.message || tokenErr}`,
        );
      }
    }

    console.log(`[AUTH-MIDDLEWARE] No valid session found, returning 401`);

    // If token is missing but dev bypass is allowed, attach dev user
    if (allowDevBypass()) {
      attachDevUser(req);
      req.scope = req.scope || {};
      req.scope.userId = 1;
      return next();
    }

    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  } catch (err) {
    if (allowDevBypass()) {
      attachDevUser(req);
      req.scope = req.scope || {};
      req.scope.userId = 1;
      return next();
    }
    return next(httpError(401, "INVALID_TOKEN", "Invalid or expired session"));
  }
}

/**
 * Middleware to enforce company scope based on headers.
 * Ensures the user has a selected company.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  }

  // Check if user is an admin (ID 1) and bypass company restrictions
  if (Number(req.user.id) === 1) {
    const companyId = Number(
      req.headers["x-company-id"] || req.query.companyId || 1,
    );
    req.scope = req.scope || {};
    req.scope.companyId = companyId;
    return next();
  }

  // Determine company ID from headers, query, or user's allowed companies
  const companyId = Number(
    req.headers["x-company-id"] ||
      req.query.companyId ||
      req.user?.companyIds?.[0] ||
      1,
  );
  req.scope = req.scope || {};
  req.scope.companyId = companyId;
  const allowedCompanies = Array.isArray(req.user?.companyIds)
    ? req.user.companyIds.map(Number)
    : [];
  // Validate that the user's allowed companies include the requested company ID
  if (
    allowedCompanies.length &&
    !allowedCompanies.includes(Number(companyId))
  ) {
    return next(httpError(403, "FORBIDDEN", "Company access denied"));
  }
  return next();
}

export async function requireBranchScope(req, res, next) {
  try {
    if (!req.user) {
      return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
    }

    // Get branch ID from headers, query, or user's allowed branches
    const rawBranchId = req.headers["x-branch-id"] || req.query.branchId;
    req.scope = req.scope || {};

    const branchId = Number(rawBranchId || req.user?.branchIds?.[0] || 1);
    req.scope.branchId = branchId;

    // Admin bypass: allow 'all' branches or fetch superbranch hierarchy dynamically
    if (Number(req.user.id) === 1) {
      if (rawBranchId === "all") {
        req.scope.branchId = "all";
        req.scope.branchIdsStr = "";
        return next();
      }
      req.scope.branchIdsStr = String(branchId);

      // Let's also support superbranch for admin dynamically!
      const [b] = await query(
        "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
        { branchId },
      );
      if (b?.is_superbranch) {
        const childBranches = await query(
          "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
          { branchId },
        );
        const allRelated = [branchId, ...childBranches.map((x) => x.id)];
        req.scope.branchIdsStr = allRelated.join(",");
      }
      return next();
    }

    // Validate that the user's allowed branches include the requested branch ID
    const allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number)
      : [];

    if (allowedBranches.length && !allowedBranches.includes(Number(branchId))) {
      return next(httpError(403, "FORBIDDEN", "Branch access denied"));
    }

    req.scope.branchIdsStr = String(branchId);

    // Superbranch logic: if requested branch is a superbranch, allow access to its children
    const [b] = await query(
      "SELECT is_superbranch FROM adm_branches WHERE id = :branchId",
      { branchId },
    );
    if (b?.is_superbranch) {
      const childBranches = await query(
        "SELECT id FROM adm_branches WHERE parent_branch_id = :branchId",
        { branchId },
      );
      const childIds = childBranches.map((x) => Number(x.id));
      // Intersection: user's allowed branches that are either the superbranch or its children
      const validIds = [branchId, ...childIds].filter((id) =>
        allowedBranches.includes(id),
      );
      req.scope.branchIdsStr = validIds.join(",");
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
