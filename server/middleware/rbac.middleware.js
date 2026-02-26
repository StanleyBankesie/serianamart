import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// Get user role ID
async function getUserRoleId(userId) {
  const result = await query(
    `SELECT role_id FROM adm_users WHERE id = :userId`,
    { userId }
  );
  return result.length > 0 ? result[0].role_id : null;
}

// Check module access
export async function checkModuleAccess(moduleKey) {
  return async function (req, res, next) {
    try {
      const userId = Number(req.user?.sub || req.user?.id);
      if (!userId) {
        return next(httpError(401, "Authentication required"));
      }

      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "No role assigned to user"));
      }

      // Check if user has access to this module
      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId AND module_key = :moduleKey 
         LIMIT 1`,
        { roleId, moduleKey }
      );

      if (moduleAccess.length === 0) {
        return next(httpError(403, `Access denied to module: ${moduleKey}`));
      }

      // Attach role info to request for later use
      req.userRole = { id: roleId, moduleKey };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Check feature access with action
export async function checkFeatureAccess(featureKey, action = "view") {
  return async function (req, res, next) {
    try {
      const userId = Number(req.user?.sub || req.user?.id);
      if (!userId) {
        return next(httpError(401, "Authentication required"));
      }

      const roleId = await getUserRoleId(userId);
      if (!roleId) {
        return next(httpError(403, "No role assigned to user"));
      }

      // Extract module key from feature key
      const [moduleKey] = String(featureKey || "").split(":");
      if (!moduleKey) {
        return next(httpError(400, "Invalid feature key format"));
      }

      // Check module access first
      const moduleAccess = await query(
        `SELECT 1 FROM adm_role_modules 
         WHERE role_id = :roleId AND module_key = :moduleKey 
         LIMIT 1`,
        { roleId, moduleKey }
      );

      if (moduleAccess.length === 0) {
        return next(httpError(403, `Access denied to module: ${moduleKey}`));
      }

      // Check feature permission
      const permission = await query(
        `SELECT can_view, can_create, can_edit, can_delete 
         FROM adm_role_permissions 
         WHERE role_id = :roleId AND feature_key = :featureKey 
         LIMIT 1`,
        { roleId, featureKey }
      );

      if (permission.length === 0) {
        return next(httpError(403, `Feature not assigned: ${featureKey}`));
      }

      // Check specific action
      const actionColumn = action === "create" ? "can_create" : 
                          action === "edit" ? "can_edit" : 
                          action === "delete" ? "can_delete" : "can_view";

      if (!permission[0][actionColumn]) {
        return next(httpError(403, `Action '${action}' not allowed for feature: ${featureKey}`));
      }

      // Attach permission info to request
      req.userPermissions = permission[0];
      req.featureKey = featureKey;
      req.moduleKey = moduleKey;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Helper middleware to get user permissions for frontend
export async function getUserPermissions(req, res, next) {
  try {
    const userId = Number(req.user?.sub || req.user?.id);
    if (!userId) {
      return next(httpError(401, "Authentication required"));
    }

    const roleId = await getUserRoleId(userId);
    if (!roleId) {
      return res.json({ modules: [], permissions: [] });
    }

    // Get user's modules
    const modules = await query(
      `SELECT module_key FROM adm_role_modules WHERE role_id = :roleId`,
      { roleId }
    );

    // Get user's permissions
    const permissions = await query(
      `SELECT module_key, feature_key, can_view, can_create, can_edit, can_delete 
       FROM adm_role_permissions WHERE role_id = :roleId`,
      { roleId }
    );

    res.json({
      modules: modules.map(m => m.module_key),
      permissions: permissions
    });
  } catch (err) {
    next(err);
  }
}
