import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { token, initialized, user, scope, setScope, hasAccess } = useAuth();
  const location = useLocation();
  if (!initialized) return null;
  if (!token) return <Navigate to="/login" replace />;
  const allowedBranches = Array.isArray(user?.branchIds) ? user.branchIds.map(Number).filter((n) => Number.isFinite(n)) : [];
  const currentBranch = Number(scope?.branchId);
  if (allowedBranches.length <= 1) {
    const single = allowedBranches[0];
    if (Number.isFinite(single) && currentBranch !== single) {
      const companies = Array.isArray(user?.companyIds) ? user.companyIds.map(Number).filter((n) => Number.isFinite(n)) : [];
      const companyId = companies.length === 1 ? companies[0] : scope?.companyId || 1;
      setScope((prev) => ({ ...prev, companyId, branchId: single }));
    }
    if (location.pathname === "/select-branch") return <Navigate to="/" replace />;
  } else {
    if (location.pathname === "/select-branch") return children;
    if (!allowedBranches.includes(currentBranch)) {
      return <Navigate to="/select-branch" replace />;
    }
  }
  const path = location.pathname;
  if (path === "/" || path === "/dashboard") return children;
  const isCreate = /(\/new|\/create)$/.test(path);
  const isEdit = /\/edit$/.test(path);
  const action = isCreate ? "create" : isEdit ? "edit" : "view";
  if (!hasAccess(path, action)) return <Navigate to="/" replace />;
  return children;
}
