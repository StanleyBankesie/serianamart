import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  toNumber,
  ensureExceptionalPermissionsTable,
  logError,
  ensurePagesTable,
  ensurePagesSeed,
} from "../utils/dbUtils.js";

export const logErrorController = async (req, res, next) => {
  try {
    const {
      module: moduleName,
      action,
      error_code,
      message,
      details,
    } = req.body ?? {};

    await logError({
      user_id: req.user?.id ?? null,
      module: moduleName ?? null,
      action: action ?? null,
      error_code: error_code ?? null,
      message: message ?? null,
      details: details ? JSON.stringify(details) : null,
    });

    return res.status(201).json({
      success: true,
      message: "Error logged successfully",
      data: null,
    });
  } catch (err) {
    return next(err);
  }
};

export const updateExceptionalPermissionController = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();

    const id = toNumber(req.params.id);
    if (!id) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }

    const {
      username,
      permissionCode,
      effect = "ALLOW",
      reason = null,
      is_active,
    } = req.body ?? {};

    if (!permissionCode) {
      throw httpError(400, "VALIDATION_ERROR", "Permission code is required");
    }

    let user_id;

    // Only resolve user if username is provided
    if (username) {
      const users = await query(
        "SELECT id FROM adm_users WHERE username = :username LIMIT 1",
        { username },
      );

      if (!users.length) {
        throw httpError(404, "NOT_FOUND", "User with this username not found");
      }

      user_id = users[0].id;
    }

    const result = await query(
      `
      UPDATE adm_exceptional_permissions
      SET
        user_id = COALESCE(:user_id, user_id),
        permission_code = :permissionCode,
        effect = :effect,
        reason = :reason,
        is_active = :is_active
      WHERE id = :id
      `,
      {
        id,
        user_id: user_id ?? null,
        permissionCode,
        effect,
        reason,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );

    if (!result.affectedRows) {
      throw httpError(404, "NOT_FOUND", "Exceptional permission not found");
    }

    return res.json({
      success: true,
      message: "Exceptional permission updated",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    return next(err);
  }
};

export const deleteExceptionalPermissionController = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const id = toNumber(req.params.id);
    if (!id) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }
    const result = await query(
      "DELETE FROM adm_exceptional_permissions WHERE id = :id",
      { id },
    );
    if (!result.affectedRows) {
      throw httpError(404, "NOT_FOUND", "Exceptional permission not found");
    }
    return res.json({
      success: true,
      message: "Exceptional permission deleted",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    return next(err);
  }
};

export const getMe = async (req, res) => {
  return res.json({
    success: true,
    message: "Context",
    data: { user: req.user, scope: req.scope },
  });
};

export const listPages = async (req, res, next) => {
  try {
    await ensurePagesTable();
    await ensurePagesSeed();
    const items = await query("SELECT * FROM adm_pages ORDER BY module, name");
    res.json({ success: true, message: "Pages fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [roles] = await query("SELECT COUNT(*) as count FROM adm_roles");
    const [pages] = await query("SELECT COUNT(*) as count FROM adm_pages");
    const [users] = await query("SELECT COUNT(*) as count FROM adm_users");
    const [assignments] = await query(
      "SELECT COUNT(*) as count FROM adm_users WHERE role_id IS NOT NULL",
    );
    const [activeExceptions] = await query(
      "SELECT COUNT(*) as count FROM adm_exceptional_permissions WHERE is_active = 1",
    );
    const [totalExceptions] = await query(
      "SELECT COUNT(*) as count FROM adm_exceptional_permissions",
    );
    res.json({
      success: true,
      message: "Dashboard stats",
      data: {
        rolesCount: roles.count,
        pagesCount: pages.count,
        usersCount: users.count,
        assignmentsCount: assignments.count,
        activeExceptionsCount: activeExceptions.count,
        totalExceptionsCount: totalExceptions.count,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listExceptionalPermissions = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const items = await query(
      `SELECT ep.*, u.username, u.email as user_email, u.full_name as user_name 
       FROM adm_exceptional_permissions ep
       JOIN adm_users u ON ep.user_id = u.id
       ORDER BY ep.created_at DESC`,
    );
    res.json({
      success: true,
      message: "Exceptional permissions fetched",
      data: { items },
    });
  } catch (err) {
    next(err);
  }
};

export const getExceptionalPermissionById = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      `SELECT ep.*, u.username, u.email as userEmail 
       FROM adm_exceptional_permissions ep
       JOIN adm_users u ON ep.user_id = u.id
       WHERE ep.id = :id LIMIT 1`,
      { id },
    );
    if (!items.length)
      throw httpError(404, "NOT_FOUND", "Permission not found");
    res.json({
      success: true,
      message: "Exceptional permission fetched",
      data: { item: items[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const createExceptionalPermission = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const {
      username,
      permissionCode,
      effect,
      reason,
      is_active,
      effective_from,
      effective_to,
      approved_by,
      exception_type,
    } = req.body || {};
    if (!username || !permissionCode)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Username and permission code are required",
      );
    const users = await query(
      "SELECT id FROM adm_users WHERE username = :username LIMIT 1",
      { username },
    );
    if (!users.length)
      throw httpError(404, "NOT_FOUND", "User with this username not found");
    const user_id = users[0].id;
    const result = await query(
      `INSERT INTO adm_exceptional_permissions (
         user_id, permission_code, effect, reason, is_active,
         effective_from, effective_to, approved_by, exception_type
       ) VALUES (
         :user_id, :permissionCode, :effect, :reason, :is_active,
         :effective_from, :effective_to, :approved_by, :exception_type
       )`,
      {
        user_id,
        permissionCode,
        effect: effect || "ALLOW",
        reason: reason || null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        effective_from: effective_from || null,
        effective_to: effective_to || null,
        approved_by: approved_by || req.user?.id || null,
        exception_type: exception_type || "TEMPORARY",
      },
    );
    res.status(201).json({
      success: true,
      message: "Exceptional permission created",
      data: { id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};
