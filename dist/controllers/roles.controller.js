import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  toNumber,
  ensurePagesTable,
  ensurePagesSeed,
  ensureRolePagesTable,
  ensureUserPermissionsTable,
} from "../utils/dbUtils.js";
export const getUserRole = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    let items = [];
    try {
      items = await query(
        `
        SELECT r.id, r.company_id, r.name, r.code, r.is_active
        FROM adm_user_roles ur
        JOIN adm_roles r ON r.id = ur.role_id
        WHERE ur.user_id = :id AND r.is_active = 1
        ORDER BY r.name ASC
        `,
        { id },
      );
    } catch (err) {
      items = await query(
        `
        SELECT r.id, r.company_id, r.name, r.code, r.is_active
        FROM adm_users u
        JOIN adm_roles r ON r.id = u.role_id
        WHERE u.id = :id
        LIMIT 1
        `,
        { id },
      );
    }
    res.json({ success: true, message: "User roles fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

export const listRoles = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || req.scope?.companyId;
    let queryStr =
      "SELECT id, company_id, name, code, is_active, created_at FROM adm_roles";
    const params = {};
    if (companyId) {
      queryStr += " WHERE company_id = :companyId";
      params.companyId = companyId;
    }
    queryStr += " ORDER BY name ASC";
    const items = await query(queryStr, params);
    res.json({ success: true, message: "Roles fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getRoleById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();
    const items = await query(
      "SELECT id, company_id, name, code, is_active FROM adm_roles WHERE id = :id AND company_id = :companyId LIMIT 1",
      { id, companyId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Role not found");
    const role = items[0];
    const pages = await query(
      "SELECT page_id FROM adm_role_pages WHERE role_id = :id",
      { id },
    );
    role.pages = pages.map((p) => p.page_id);
    res.json({ success: true, message: "Role fetched", data: { item: role } });
  } catch (err) {
    next(err);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const scope = req.scope || {};
    const companyId = scope.companyId || 1;
    const { name, code, is_active, pages } = req.body || {};
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");
    const result = await query(
      "INSERT INTO adm_roles (company_id, name, code, is_active) VALUES (:companyId, :name, :code, :is_active)",
      {
        companyId,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    const roleId = result.insertId;
    if (Array.isArray(pages) && pages.length > 0) {
      for (const pageId of pages) {
        await query(
          "INSERT INTO adm_role_pages (role_id, page_id) VALUES (:roleId, :pageId)",
          { roleId, pageId },
        );
      }
    }
    res.status(201).json({
      success: true,
      message: "Role created",
      data: { id: roleId },
    });
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const scope = req.scope || {};
    const companyId = scope.companyId || 1;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();

    const { name, code, is_active, pages } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      "UPDATE adm_roles SET name = :name, code = :code, is_active = :is_active WHERE id = :id AND company_id = :companyId",
      {
        id,
        companyId,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );

    // Update pages: Delete all and re-insert
    if (Array.isArray(pages)) {
      await query("DELETE FROM adm_role_pages WHERE role_id = :id", { id });
      for (const pageId of pages) {
        await query(
          "INSERT INTO adm_role_pages (role_id, page_id) VALUES (:roleId, :pageId)",
          { roleId: id, pageId },
        );
      }
    }

    res.json({
      success: true,
      message: "Role updated",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    next(err);
  }
};
