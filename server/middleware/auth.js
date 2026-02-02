import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import { httpError } from "../utils/httpError.js";

dotenv.config();

function ensureDevUser(req) {
  if (req.user) return;
  req.user = {
    sub: 0,
    email: "dev@local",
    permissions: ["*"],
    companyIds: [],
    branchIds: [],
  };
}

export function requireAuth(req, res, next) {
  ensureDevUser(req);
  const headerUserId =
    req.headers["x-user-id"] !== undefined
      ? Number(req.headers["x-user-id"])
      : req.query.userId !== undefined
      ? Number(req.query.userId)
      : null;
  if (headerUserId && Number.isFinite(headerUserId)) {
    req.user.sub = headerUserId;
  }
  return next();
}

export function requireCompanyScope(req, res, next) {
  ensureDevUser(req);

  const companyId = Number(
    req.headers["x-company-id"] || req.query.companyId || 1
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
  ensureDevUser(req);

  const branchId = Number(
    req.headers["x-branch-id"] || req.query.branchId || 1
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
