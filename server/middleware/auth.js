import { httpError } from "../utils/httpError.js";
import { verifyAccessToken } from "../services/token.service.js";
import "../utils/loadServerEnv.js";

function allowDevBypass() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.AUTH_ALLOW_DEV_BYPASS || "").trim() === "1"
  );
}

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

export function requireAuth(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || req.headers.Authorization || "";
    const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) {
      const payload = verifyAccessToken(m[1]);
      req.user = {
        ...(req.user || {}),
        ...payload,
      };
      req.scope = req.scope || {};
      req.scope.userId = Number(payload.sub || payload.id) || null;
      return next();
    }

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

export function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  }

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
  if (
    allowedCompanies.length &&
    !allowedCompanies.includes(Number(companyId))
  ) {
    return next(httpError(403, "FORBIDDEN", "Company access denied"));
  }
  return next();
}

export function requireBranchScope(req, res, next) {
  if (!req.user) {
    return next(httpError(401, "UNAUTHORIZED", "Authentication required"));
  }

  const branchId = Number(
    req.headers["x-branch-id"] ||
      req.query.branchId ||
      req.user?.branchIds?.[0] ||
      1
  );
  req.scope = req.scope || {};
  req.scope.branchId = branchId;
  const allowedBranches = Array.isArray(req.user?.branchIds)
    ? req.user.branchIds.map(Number)
    : [];
  if (allowedBranches.length && !allowedBranches.includes(Number(branchId))) {
    return next(httpError(403, "FORBIDDEN", "Branch access denied"));
  }
  return next();
}
