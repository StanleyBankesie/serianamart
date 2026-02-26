import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { toNumber } from "../utils/dbUtils.js";

export async function getUserRoleId(userId) {
  const rows = await query(
    "SELECT role_id FROM adm_users WHERE id = :id LIMIT 1",
    { id: userId },
  );
  const roleId = toNumber(rows?.[0]?.role_id);
  return roleId || null;
}

export function checkModuleAccess(moduleKey) {
  return async function (req, res, next) {
    try {
      const url = String(req.baseUrl || req.originalUrl || "");
      if (
        req.method === "GET" &&
        (url.includes("/api/sales") ||
          url.includes("/api/purchase") ||
          url.includes("/api/finance"))
      ) {
        return next();
      }
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId)
        return next(httpError(401, "UNAUTHORIZED", "Login required"));
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        return next();
      }
      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "FORBIDDEN", "No role assigned"));
      }
      const rows = await query(
        `SELECT 1 
         FROM adm_role_modules 
         WHERE role_id = :roleId AND LOWER(module_key) = LOWER(:moduleKey) 
         LIMIT 1`,
        { roleId, moduleKey },
      );
      if (!rows.length) {
        const permRows = await query(
          `SELECT 1
           FROM adm_role_permissions
           WHERE role_id = :roleId
             AND LOWER(module_key) = LOWER(:moduleKey)
             AND can_view = 1
           LIMIT 1`,
          { roleId, moduleKey },
        );
        if (permRows.length) {
          return next();
        }
        const featureRows = await query(
          `SELECT 1
           FROM adm_role_features
           WHERE role_id = :roleId
             AND LOWER(feature_key) LIKE CONCAT(LOWER(:moduleKey), ':%')
           LIMIT 1`,
          { roleId, moduleKey },
        ).catch(() => []);
        if (featureRows && featureRows.length) {
          return next();
        }
        console.warn(
          "[RBAC] 403 Module access denied",
          JSON.stringify({ userId, roleId, moduleKey, path: req.originalUrl }),
        );
        return next(httpError(403, "FORBIDDEN", "Module access denied"));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function checkFeatureAccess(featureKey) {
  return async function (req, res, next) {
    try {
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId)
        return next(httpError(401, "UNAUTHORIZED", "Login required"));
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        req.userPermissions = null;
        const [moduleKey] = String(featureKey || "").split(":");
        req.featureKey = featureKey;
        req.moduleKey = moduleKey;
        return next();
      }

      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "FORBIDDEN", "No role assigned"));
      }

      // Check if user has module access
      const [moduleKey] = String(featureKey || "").split(":");
      if (!moduleKey) {
        return next(httpError(403, "FORBIDDEN", "Invalid feature key"));
      }

      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId AND module_key = :moduleKey 
         LIMIT 1`,
        { roleId, moduleKey },
      );

      if (!moduleAccess.length) {
        return next(httpError(403, "FORBIDDEN", "Module access denied"));
      }

      // Deprecated: feature-level permission and user feature overrides

      // Feature allowlist removed: any feature under an enabled module is allowed

      // Attach basic info to request for later use
      req.userPermissions = null;
      req.featureKey = featureKey;
      req.moduleKey = moduleKey;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function checkFeatureAction(featureKey, action) {
  return async function (req, res, next) {
    try {
      // First check basic feature access
      const basicCheck = checkFeatureAccess(featureKey);
      await basicCheck(req, res, async (err) => {
        if (err) return next(err);

        // Then check specific action at module level
        const userId = toNumber(req.user?.sub || req.user?.id);
        const roleId = await getUserRoleId(userId);
        const moduleKey = req.moduleKey;
        const actionKey = String(action || "view").toLowerCase();
        const row = await query(
          `SELECT can_view, can_create, can_edit, can_delete 
           FROM adm_role_permissions 
           WHERE role_id = :roleId AND module_key = :moduleKey 
           LIMIT 1`,
          { roleId, moduleKey },
        );
        const col =
          actionKey === "create"
            ? "can_create"
            : actionKey === "edit"
              ? "can_edit"
              : actionKey === "delete"
                ? "can_delete"
                : "can_view";
        const allowed = !!row?.[0]?.[col];
        if (!allowed) {
          return next(httpError(403, "FORBIDDEN", "Action not allowed"));
        }

        return next();
      });
    } catch (err) {
      return next(err);
    }
  };
}

export function checkModuleAction(moduleKey, action) {
  return async function (req, res, next) {
    try {
      if (
        Array.isArray(req.user?.permissions) &&
        req.user.permissions.includes("*")
      ) {
        return next();
      }
      const m1 = checkModuleAccess(moduleKey);
      await m1(req, res, async (err) => {
        if (err) return next(err);
        const userId = toNumber(req.user?.sub || req.user?.id);
        const roleId = await getUserRoleId(userId);
        const actionKey = String(action || "view").toLowerCase();
        const row = await query(
          `SELECT can_view, can_create, can_edit, can_delete 
           FROM adm_role_permissions 
           WHERE role_id = :roleId AND module_key = :moduleKey 
           LIMIT 1`,
          { roleId, moduleKey },
        );
        const col =
          actionKey === "create"
            ? "can_create"
            : actionKey === "edit"
              ? "can_edit"
              : actionKey === "delete"
                ? "can_delete"
                : "can_view";
        const allowed = !!row?.[0]?.[col];
        if (!allowed) {
          return next(httpError(403, "FORBIDDEN", "Action not allowed"));
        }
        return next();
      });
    } catch (err) {
      return next(err);
    }
  };
}
