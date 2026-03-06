import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureRoleFeaturesTable } from "../utils/dbUtils.js";

// ROLES CONTROLLER
export async function getRoles(req, res, next) {
  try {
    const roles = await query(
      `SELECT id, name, code, is_active, created_at, updated_at 
       FROM adm_roles 
       ORDER BY name`
    );
    res.json(roles);
  } catch (err) {
    next(err);
  }
}

export async function createRole(req, res, next) {
  try {
    const { name, code, is_active = true } = req.body;
    
    if (!name || !code) {
      return next(httpError(400, "Name and code are required"));
    }
    
    // Check if role code already exists
    const existing = await query(
      `SELECT id FROM adm_roles WHERE code = :code`,
      { code }
    );
    
    if (existing.length > 0) {
      return next(httpError(400, "Role code already exists"));
    }
    
    const result = await query(
      `INSERT INTO adm_roles (name, code, is_active) 
       VALUES (:name, :code, :is_active)`,
      { name, code, is_active: is_active ? 1 : 0 }
    );
    
    const newRole = await query(
      `SELECT id, name, code, is_active, created_at, updated_at 
       FROM adm_roles WHERE id = :id`,
      { id: result.insertId }
    );
    
    res.status(201).json(newRole[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, is_active } = req.body;
    
    if (!name || !code) {
      return next(httpError(400, "Name and code are required"));
    }
    
    // Check if role exists
    const existing = await query(
      `SELECT id FROM adm_roles WHERE id = :id`,
      { id }
    );
    
    if (existing.length === 0) {
      return next(httpError(404, "Role not found"));
    }
    
    // Check if role code already exists (excluding current role)
    const codeCheck = await query(
      `SELECT id FROM adm_roles WHERE code = :code AND id != :id`,
      { code, id }
    );
    
    if (codeCheck.length > 0) {
      return next(httpError(400, "Role code already exists"));
    }
    
    await query(
      `UPDATE adm_roles 
       SET name = :name, code = :code, is_active = :is_active, updated_at = NOW()
       WHERE id = :id`,
      { name, code, is_active: is_active ? 1 : 0, id }
    );
    
    const updatedRole = await query(
      `SELECT id, name, code, is_active, created_at, updated_at 
       FROM adm_roles WHERE id = :id`,
      { id }
    );
    
    res.json(updatedRole[0]);
  } catch (err) {
    next(err);
  }
}

// ROLE MODULES CONTROLLER
export async function getRoleModules(req, res, next) {
  try {
    const { roleId } = req.params;
    
    const modules = await query(
      `SELECT role_id, module_key 
       FROM adm_role_modules 
       WHERE role_id = :roleId`,
      { roleId }
    );
    
    res.json(modules);
  } catch (err) {
    next(err);
  }
}

export async function saveRoleModules(req, res, next) {
  try {
    const { role_id, modules } = req.body;
    
    if (!role_id || !Array.isArray(modules)) {
      return next(httpError(400, "Role ID and modules array are required"));
    }
    
    const roleId = Number(role_id);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid role_id is required"));
    }

    const moduleKeys = Array.from(
      new Set(
        (modules || [])
          .map((m) => String(m || "").trim())
          .filter(Boolean),
      ),
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Replace role modules with the newly submitted list
      await conn.query(`DELETE FROM adm_role_modules WHERE role_id = ?`, [roleId]);

      if (moduleKeys.length > 0) {
        const values = moduleKeys.map(() => "(?, ?)").join(",");
        const params = [];
        for (const mk of moduleKeys) {
          params.push(roleId, mk);
        }
        await conn.query(
          `INSERT INTO adm_role_modules (role_id, module_key) VALUES ${values}`,
          params,
        );
      }

      // IMPORTANT:
      // If a module is unchecked, its feature/dashboard permissions must be removed too.
      // This guarantees sidebar and backend checks reflect the unchecked state.
      if (moduleKeys.length === 0) {
        await conn.query(`DELETE FROM adm_role_permissions WHERE role_id = ?`, [roleId]);
      } else {
        const placeholders = moduleKeys.map(() => "?").join(",");
        await conn.query(
          `DELETE FROM adm_role_permissions
           WHERE role_id = ? AND module_key NOT IN (${placeholders})`,
          [roleId, ...moduleKeys],
        );
      }

      await conn.commit();
      res.json({ message: "Role modules saved successfully" });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

// ROLE PERMISSIONS CONTROLLER
export async function getRolePermissions(req, res, next) {
  try {
    const { roleId } = req.params;
    
    const permissions = await query(
      `SELECT role_id, module_key, feature_key, 
              can_view, can_create, can_edit, can_delete
       FROM adm_role_permissions 
       WHERE role_id = :roleId`,
      { roleId }
    );
    
    res.json(permissions);
  } catch (err) {
    next(err);
  }
}

export async function saveRolePermissions(req, res, next) {
  try {
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return next(httpError(400, "Permissions array is required"));
    }
    
    if (permissions.length === 0) {
      return next(httpError(400, "At least one permission is required"));
    }
    
    const roleId = permissions[0].role_id;
    
    // Delete existing permissions for this role
    await query(
      `DELETE FROM adm_role_permissions WHERE role_id = :roleId`,
      { roleId }
    );
    
    // Insert new permissions
    const values = permissions.map((_, index) => 
      `(:roleId, :module_${index}, :feature_${index}, :view_${index}, :create_${index}, :edit_${index}, :delete_${index})`
    ).join(',');
    
    const params = { roleId };
    
    permissions.forEach((perm, index) => {
      params[`module_${index}`] = perm.module_key;
      params[`feature_${index}`] = perm.feature_key;
      params[`view_${index}`] = perm.can_view ? 1 : 0;
      params[`create_${index}`] = perm.can_create ? 1 : 0;
      params[`edit_${index}`] = perm.can_edit ? 1 : 0;
      params[`delete_${index}`] = perm.can_delete ? 1 : 0;
    });
    
    await query(
      `INSERT INTO adm_role_permissions 
       (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete) 
       VALUES ${values}`,
      params
    );
    
    res.json({ message: "Role permissions saved successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getRoleFeatures(req, res, next) {
  try {
    await ensureRoleFeaturesTable();
    const roleId = Number(req.params.roleId);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid roleId is required"));
    }
    const rows = await query(
      `SELECT feature_key FROM adm_role_features WHERE role_id = :roleId`,
      { roleId },
    );
    res.json(rows.map((r) => String(r.feature_key)));
  } catch (err) {
    next(err);
  }
}

export async function saveRoleFeatures(req, res, next) {
  try {
    await ensureRoleFeaturesTable();
    const { role_id, features } = req.body || {};
    const roleId = Number(role_id);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid role_id is required"));
    }
    if (!Array.isArray(features)) {
      return next(httpError(400, "features array is required"));
    }

    const keys = Array.from(
      new Set(features.map((f) => String(f || "").trim()).filter(Boolean)),
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM adm_role_features WHERE role_id = ?`, [roleId]);
      if (keys.length > 0) {
        const values = keys.map(() => "(?, ?)").join(",");
        const params = [];
        for (const fk of keys) params.push(roleId, fk);
        await conn.query(
          `INSERT INTO adm_role_features (role_id, feature_key) VALUES ${values}`,
          params,
        );
      }
      await conn.commit();
      res.json({ message: "Role features saved successfully" });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}
