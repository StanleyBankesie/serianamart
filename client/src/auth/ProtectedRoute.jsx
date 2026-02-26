import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext.jsx";
import { usePermission } from "./PermissionContext.jsx";

export default function ProtectedRoute({ children }) {
  const { token, initialized, user, scope, setScope } = useAuth();
  const { loading, canAccessPath } = usePermission();
  const location = useLocation();
  if (!initialized) return null;
  if (typeof loading !== "undefined" && loading) return null;
  if (!token)
    return <Navigate to="/login" replace state={{ from: location }} />;
  const allowedBranches = Array.isArray(user?.branchIds)
    ? user.branchIds.map(Number).filter((n) => Number.isFinite(n))
    : [];
  const currentBranch = Number(scope?.branchId);
  if (allowedBranches.length <= 1) {
    const single = allowedBranches[0];
    if (Number.isFinite(single) && currentBranch !== single) {
      const companies = Array.isArray(user?.companyIds)
        ? user.companyIds.map(Number).filter((n) => Number.isFinite(n))
        : [];
      const companyId =
        companies.length === 1 ? companies[0] : scope?.companyId || 1;
      setScope((prev) => ({ ...prev, companyId, branchId: single }));
    }
    if (location.pathname === "/select-branch") {
      const last =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("last_path")
          : null;
      const target = last && last !== "/login" ? last : "/";
      return <Navigate to={target} replace />;
    }
  } else {
    if (location.pathname === "/select-branch") return children;
    if (!allowedBranches.includes(currentBranch)) {
      return <Navigate to="/select-branch" replace />;
    }
  }
  const path = location.pathname;
  if (path === "/" || path === "/dashboard") return children;
  if (!canAccessPath(path)) return children;
  return children;
}
