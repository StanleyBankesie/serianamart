import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  toNumber,
  ensureUserColumns,
  ensureUserBranchMapping,
  ensurePagesTable,
  ensurePagesSeed,
  ensureRolePagesTable,
  ensureUserPermissionsTable,
  ensureRolePermissionsTable,
  ensureRoleFeaturesTable,
} from "../utils/dbUtils.js";
import { getAllFeatures } from "../data/featuresRegistry.js";

export const getUsers = async (req, res, next) => {
  try {
    await ensureUserColumns();
    const { q, company_id, branch_id, active, limit } = req.query || {};
    const clauses = [];
    const params = {};
    if (company_id) {
      clauses.push("u.company_id = :company_id");
      params.company_id = Number(company_id);
    }
    if (branch_id) {
      clauses.push("u.branch_id = :branch_id");
      params.branch_id = Number(branch_id);
    }
    if (typeof active !== "undefined" && active !== "") {
      clauses.push("u.is_active = :is_active");
      const raw = String(active).trim().toLowerCase();
      if (raw === "1" || raw === "true") {
        params.is_active = 1;
      } else if (raw === "0" || raw === "false") {
        params.is_active = 0;
      } else {
        const n = Number(active);
        params.is_active = Number.isFinite(n) ? (n ? 1 : 0) : 1;
      }
    }
    if (q && String(q).trim().length > 0) {
      params.q = `%${String(q).trim()}%`;
      clauses.push(
        "(u.username LIKE :q OR u.full_name LIKE :q OR u.email LIKE :q)",
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const lim = Math.min(100, Math.max(1, parseInt(limit || "50", 10)));
    const sql = `
      SELECT u.id, u.company_id, u.branch_id, u.username, u.email, u.full_name, u.is_active, u.created_at,
             c.name as company_name, b.name as branch_name
      FROM adm_users u
      LEFT JOIN adm_companies c ON u.company_id = c.id
      LEFT JOIN adm_branches b ON u.branch_id = b.id
      ${where}
      ORDER BY u.username ASC
      LIMIT ${lim}
    `;
    const items = await query(sql, params);
    res.json({ success: true, message: "Users fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      `
      SELECT 
        u.*,
        IF(u.profile_picture IS NULL, NULL, CONCAT('data:image/jpeg;base64,', TO_BASE64(u.profile_picture))) AS profile_picture_url
      FROM adm_users u
      WHERE u.id = :id
      LIMIT 1
      `,
      { id },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "User not found");
    res.json({
      success: true,
      message: "User fetched",
      data: { item: items[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserBranches = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureUserBranchMapping();
    const items = await query(
      `
      SELECT b.id, b.company_id, b.name, b.code, c.name AS company_name
      FROM adm_user_branches ub
      JOIN adm_branches b ON b.id = ub.branch_id
      JOIN adm_companies c ON c.id = b.company_id
      WHERE ub.user_id = :id
      ORDER BY c.name ASC, b.name ASC
      `,
      { id },
    );
    res.json({
      success: true,
      message: "User branches fetched",
      data: { items },
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserBranches = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const { company_id, branch_ids } = req.body || {};
    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!Array.isArray(branch_ids))
      throw httpError(400, "VALIDATION_ERROR", "branch_ids must be an array");

    const cleanIds = branch_ids
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
    await ensureUserBranchMapping();

    const validBranches = await query(
      `SELECT id FROM adm_branches WHERE company_id = :company_id`,
      { company_id },
    );
    const validSet = new Set(validBranches.map((r) => Number(r.id)));
    for (const bid of cleanIds) {
      if (!validSet.has(bid)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid branch for company");
      }
    }

    await query(
      `DELETE FROM adm_user_branches WHERE user_id = :id AND company_id = :company_id`,
      { id, company_id },
    );
    for (const bid of cleanIds) {
      await query(
        `INSERT INTO adm_user_branches (user_id, company_id, branch_id) VALUES (:id, :company_id, :bid)`,
        { id, company_id, bid },
      );
    }

    const primaryBranch = cleanIds[0] || null;
    if (primaryBranch) {
      await query(
        `UPDATE adm_users SET company_id = :company_id, branch_id = :branch_id WHERE id = :id`,
        { id, company_id, branch_id: primaryBranch },
      );
    }
    res.json({
      success: true,
      message: "User branches updated",
      data: { affectedRows: cleanIds.length },
    });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    await ensureUserColumns();
    const {
      company_id,
      branch_id,
      username,
      email,
      full_name,
      password_hash,
      is_active,
      profile_picture,
      is_employee,
      user_type,
      valid_from,
      valid_to,
      role_id,
      branch_ids,
    } = req.body || {};

    if (!company_id || !branch_id || !username || !email)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "company_id, branch_id, username, and email are required",
      );

    const result = await query(
      `INSERT INTO adm_users (
        company_id, branch_id, username, email, full_name, password_hash, is_active,
        profile_picture, is_employee, user_type, valid_from, valid_to, role_id
      ) VALUES (
        :company_id, :branch_id, :username, :email, :full_name, :password_hash, :is_active,
        :profile_picture, :is_employee, :user_type, :valid_from, :valid_to, :role_id
      )`,
      {
        company_id,
        branch_id,
        username,
        email,
        full_name: full_name || null,
        password_hash: password_hash || "$2b$10$EpRnTzVlqHNP0.fKbX99ij...",
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        profile_picture:
          typeof profile_picture === "string"
            ? Buffer.from(
                String(profile_picture).replace(
                  /^data:[^;]+;base64,/,
                  "",
                ),
                "base64",
              )
            : profile_picture || null,
        is_employee: is_employee ? 1 : 0,
        user_type: user_type || "Internal",
        valid_from: valid_from || null,
        valid_to: valid_to || null,
        role_id: role_id || null,
      },
    );

    const newUserId = result.insertId;
    await ensureUserBranchMapping();
    const branchesToAssign = Array.isArray(branch_ids)
      ? branch_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [Number(branch_id)].filter((n) => Number.isFinite(n));
    for (const bid of branchesToAssign) {
      await query(
        `INSERT INTO adm_user_branches (user_id, company_id, branch_id) VALUES (:user_id, :company_id, :branch_id)`,
        { user_id: newUserId, company_id, branch_id: bid },
      );
    }

    res.status(201).json({
      success: true,
      message: "User created",
      data: { id: newUserId },
    });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    await ensureUserColumns();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const {
      company_id,
      branch_id,
      username,
      email,
      full_name,
      is_active,
      profile_picture,
      is_employee,
      user_type,
      valid_from,
      valid_to,
      role_id,
      password_hash,
      branch_ids,
    } = req.body || {};

    if (!company_id || !branch_id || !username || !email)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "company_id, branch_id, username, and email are required",
      );

    let queryStr = `UPDATE adm_users SET
      company_id = :company_id,
      branch_id = :branch_id,
      username = :username,
      email = :email,
      full_name = :full_name,
      is_active = :is_active,
      profile_picture = :profile_picture,
      is_employee = :is_employee,
      user_type = :user_type,
      valid_from = :valid_from,
      valid_to = :valid_to,
      role_id = :role_id`;

    const params = {
      id,
      company_id,
      branch_id,
      username,
      email,
      full_name: full_name || null,
      is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      profile_picture:
        typeof profile_picture === "string"
          ? Buffer.from(
              String(profile_picture).replace(/^data:[^;]+;base64,/, ""),
              "base64",
            )
          : profile_picture || null,
      is_employee: is_employee ? 1 : 0,
      user_type: user_type || "Internal",
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      role_id: role_id || null,
    };

    if (password_hash) {
      queryStr += `, password_hash = :password_hash`;
      params.password_hash = password_hash;
    }

    queryStr += ` WHERE id = :id`;

    const result = await query(queryStr, params);

    if (Array.isArray(branch_ids)) {
      await ensureUserBranchMapping();
      const cleanIds = branch_ids
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n));
      await query(
        `DELETE FROM adm_user_branches WHERE user_id = :id AND company_id = :company_id`,
        { id, company_id },
      );
      for (const bid of cleanIds) {
        await query(
          `INSERT INTO adm_user_branches (user_id, company_id, branch_id) VALUES (:user_id, :company_id, :branch_id)`,
          { user_id: id, company_id, branch_id: bid },
        );
      }
    }

    res.json({
      success: true,
      message: "User updated",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

export const patchUser = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const fields = req.body;
    const validFields = [
      "branch_id",
      "company_id",
      "is_active",
      "profile_picture",
      "is_employee",
      "user_type",
      "valid_from",
      "valid_to",
      "role_id",
    ];
    const updates = [];
    const params = { id };

    for (const key of Object.keys(fields)) {
      if (validFields.includes(key)) {
        updates.push(`${key} = :${key}`);
        params[key] = fields[key];
      }
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        message: "No valid fields to update",
        data: null,
      });
    }

    const queryStr = `UPDATE adm_users SET ${updates.join(", ")} WHERE id = :id`;
    const result = await query(queryStr, params);

    res.json({
      success: true,
      message: "User patched",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserPermissionsContext = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();

    const users = await query("SELECT * FROM adm_users WHERE id = :id", {
      id,
    });
    if (!users.length) throw httpError(404, "NOT_FOUND", "User not found");
    const user = users[0];

    let role = null;
    let pages = [];

    if (user.role_id) {
      const roles = await query("SELECT * FROM adm_roles WHERE id = :id", {
        id: user.role_id,
      });
      if (roles.length) role = roles[0];

      pages = await query(
        `
        SELECT p.* 
        FROM adm_role_pages rp
        JOIN adm_pages p ON rp.page_id = p.id
        WHERE rp.role_id = :roleId
        ORDER BY p.module, p.name
      `,
        { roleId: user.role_id },
      );
    }

    const permissions = await query(
      `
      SELECT * FROM adm_user_permissions WHERE user_id = :userId
    `,
      { userId: id },
    );

    res.json({
      success: true,
      message: "User permissions context fetched",
      data: {
        user: { id: user.id, username: user.username, email: user.email },
        role,
        pages,
        permissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const saveUserPermissions = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();

    const { permissions } = req.body || {};
    if (!Array.isArray(permissions))
      throw httpError(400, "VALIDATION_ERROR", "permissions array required");

    for (const p of permissions) {
      if (!p.page_id) continue;
      try {
        await query(
          `INSERT INTO adm_user_permissions (user_id, page_id, can_view, can_create, can_edit, can_delete)
           VALUES (:userId, :pageId, :canView, :canCreate, :canEdit, :canDelete)
           ON DUPLICATE KEY UPDATE
             can_view = :canView,
             can_create = :canCreate,
             can_edit = :canEdit,
             can_delete = :canDelete
          `,
          {
            userId: id,
            pageId: p.page_id,
            canView: p.can_view ? 1 : 0,
            canCreate: p.can_create ? 1 : 0,
            canEdit: p.can_edit ? 1 : 0,
            canDelete: p.can_delete ? 1 : 0,
          },
        );
      } catch (innerErr) {
        console.error(
          `Failed to save permission for user ${id}, page ${p.page_id}:`,
          innerErr,
        );
      }
    }

    res.json({ success: true, message: "Permissions saved", data: null });
  } catch (err) {
    next(err);
  }
};

export const saveUserFeaturePermissions = async (req, res, next) => {
  try {
    const userId = toNumber(req.params.id);
    if (!userId) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureUserPermissionsTable();

    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) {
      throw httpError(400, "VALIDATION_ERROR", "permissions array required");
    }

    for (const p of permissions) {
      const pageId = toNumber(p.page_id);
      if (!pageId) continue;

      const canView = p.can_view ? 1 : 0;
      const canCreate = p.can_create ? 1 : 0;
      const canEdit = p.can_edit ? 1 : 0;
      const canDelete = p.can_delete ? 1 : 0;

      await query(
        `INSERT INTO adm_user_permissions (user_id, page_id, can_view, can_create, can_edit, can_delete)
         VALUES (:userId, :pageId, :canView, :canCreate, :canEdit, :canDelete)
         ON DUPLICATE KEY UPDATE
           can_view = VALUES(can_view),
           can_create = VALUES(can_create),
           can_edit = VALUES(can_edit),
           can_delete = VALUES(can_delete)`,
        {
          userId,
          pageId,
          canView,
          canCreate,
          canEdit,
          canDelete,
        },
      );
    }

    res.json({ success: true, message: "Feature permissions saved", data: null });
  } catch (err) {
    next(err);
  }
};

export const getUserFeaturePermissionsContext = async (req, res, next) => {
  try {
    const userId = toNumber(req.params.id);
    if (!userId) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRoleFeaturesTable();
    await ensureRolePermissionsTable();

    const users = await query(
      `SELECT id, username, email, role_id FROM adm_users WHERE id = :id LIMIT 1`,
      { id: userId },
    );
    if (!users.length) throw httpError(404, "NOT_FOUND", "User not found");
    const user = users[0];
    const roleId = toNumber(user.role_id);

    if (!roleId) {
      return res.json({
        success: true,
        message: "No role assigned to user",
        data: { user: { id: user.id, username: user.username, email: user.email }, items: [] },
      });
    }

    const roleFeatureRows = await query(
      `SELECT feature_key FROM adm_role_features WHERE role_id = :roleId ORDER BY feature_key`,
      { roleId },
    );
    const roleFeatureKeys = roleFeatureRows
      .map((r) => String(r.feature_key || "").trim())
      .filter(Boolean);

    const pages = await query(
      `SELECT id AS page_id, path, module, name, feature_key
       FROM adm_pages
       WHERE is_active = 1 AND path IS NOT NULL AND path <> ''
       ORDER BY path`,
      {},
    );

    const pagesByFeatureKey = new Map();
    for (const p of pages) {
      const fk = String(p.feature_key || "").trim();
      if (!fk) continue;
      if (!pagesByFeatureKey.has(fk)) pagesByFeatureKey.set(fk, []);
      pagesByFeatureKey.get(fk).push({
        page_id: p.page_id,
        path: p.path,
        module: p.module,
        name: p.name,
      });
    }

    const allFeatures = getAllFeatures();
    const featureMetaByKey = new Map(allFeatures.map((f) => [String(f.feature_key), f]));

    const items = [];
    for (const fk of roleFeatureKeys) {
      const meta = featureMetaByKey.get(fk);
      const [mkRaw] = fk.split(":");
      const module_key = String(meta?.module_key || mkRaw || "").trim();
      const type = meta?.type || "feature";
      const label = meta?.label || fk;

      let featurePages = pagesByFeatureKey.get(fk) || [];
      if (!featurePages.length) {
        const parts = fk.split(":").map((s) => String(s || "").trim()).filter(Boolean);
        if (parts.length >= 2) {
          const basePath = `/${parts[0]}/${parts[1]}`;
          featurePages = pages
            .filter((p) => {
              const pp = String(p.path || "").trim();
              return pp === basePath || pp.startsWith(basePath + "/");
            })
            .map((p) => ({
              page_id: p.page_id,
              path: p.path,
              module: p.module,
              name: p.name,
            }));
        }
      }

      items.push({
        module_key,
        feature_key: fk,
        label,
        type,
        default_can_view: 1,
        default_can_create: 0,
        default_can_edit: 0,
        default_can_delete: 0,
        pages: featurePages,
      });
    }

    res.json({
      success: true,
      message: "Feature permissions context fetched",
      data: {
        user: { id: user.id, username: user.username, email: user.email },
        role_id: roleId,
        items,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserFeaturePermissionsList = async (req, res, next) => {
  try {
    const userId = toNumber(req.params.id);
    if (!userId) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensureUserPermissionsTable();

    const rows = await query(
      `
      SELECT 
        p.feature_key,
        MAX(up.can_view) AS can_view,
        MAX(up.can_create) AS can_create,
        MAX(up.can_edit) AS can_edit,
        MAX(up.can_delete) AS can_delete
      FROM adm_user_permissions up
      JOIN adm_pages p ON p.id = up.page_id
      WHERE up.user_id = :userId
      GROUP BY p.feature_key
      ORDER BY p.feature_key
      `,
      { userId },
    );

    res.json({
      success: true,
      message: "User feature permissions fetched",
      data: { items: rows },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserAssignments = async (req, res, next) => {
  try {
    const items = await query(
      `SELECT 
         u.id, 
         u.username, 
         u.email, 
         r.name as role_name,
         COUNT(up.page_id) as custom_count
       FROM adm_users u
       JOIN adm_user_permissions up ON u.id = up.user_id
       LEFT JOIN adm_roles r ON u.role_id = r.id
       GROUP BY u.id, u.username, u.email, r.name
       ORDER BY u.username`,
    );
    res.json({
      success: true,
      message: "User assignments fetched",
      data: { items },
    });
  } catch (err) {
    next(err);
  }
};
