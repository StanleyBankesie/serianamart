import { httpError } from "../utils/httpError.js";
import { verifyAccessToken } from "../services/token.service.js";
import { query } from "../db/pool.js";
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
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export function requireAuth(req, res, next) {
  try {
    // Extract Bearer token from authorization headers
    const authHeader =
      req.headers.authorization || req.headers.Authorization || "";
    const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) {
      // Verify token and attach user payload to the request
      const payload = verifyAccessToken(m[1]);
      req.user = {
        ...(req.user || {}),
        ...payload,
      };
      req.scope = req.scope || {};
      req.scope.userId = Number(payload.sub || payload.id) || null;
      return next();
    }

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
    return next(httpError(401, "INVALID_TOKEN", "Invalid or expired token"));
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
    const companyId = Number(req.headers["x-company-id"] || req.query.companyId || 1);
    req.scope = req.scope || {};
    req.scope.companyId = companyId;
    return next();
  }

  // Determine company ID from headers, query, or user's allowed companies
  const companyId = Number(
    req.headers["x-company-id"] ||
      req.query.companyId ||
      req.user?.companyIds?.[0] ||
      1
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
      const [b] = await query("SELECT is_superbranch FROM adm_branches WHERE id = :branchId", { branchId });
      if (b?.is_superbranch) {
         const childBranches = await query("SELECT id FROM adm_branches WHERE parent_branch_id = :branchId", { branchId });
         const allRelated = [branchId, ...childBranches.map(x => x.id)];
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
    const [b] = await query("SELECT is_superbranch FROM adm_branches WHERE id = :branchId", { branchId });
    if (b?.is_superbranch) {
       const childBranches = await query("SELECT id FROM adm_branches WHERE parent_branch_id = :branchId", { branchId });
       const childIds = childBranches.map(x => Number(x.id));
       // Intersection: user's allowed branches that are either the superbranch or its children
       const validIds = [branchId, ...childIds].filter(id => allowedBranches.includes(id));
       req.scope.branchIdsStr = validIds.join(",");
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
