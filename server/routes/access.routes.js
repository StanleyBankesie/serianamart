import express from "express";
import { query } from "../db/pool.js";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { toNumber } from "../utils/dbUtils.js";
import { ensurePagesTable, ensurePagesSeed } from "../utils/dbUtils.js";
import { getAllFeatures } from "../data/featuresRegistry.js";

const router = express.Router();

function listDefaultModules() {
  return [
    "administration",
    "sales",
    "inventory",
    "purchase",
    "finance",
    "human-resources",
    "maintenance",
    "project-management",
    "production",
    "pos",
    "business-intelligence",
    "service-management",
  ];
}

async function ensureAccessTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(100) NOT NULL UNIQUE,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_modules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module (role_id, module_key),
      INDEX idx_role_id (role_id),
      INDEX idx_module_key (module_key),
      CONSTRAINT fk_rm_role FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      can_view TINYINT(1) DEFAULT 0,
      can_create TINYINT(1) DEFAULT 0,
      can_edit TINYINT(1) DEFAULT 0,
      can_delete TINYINT(1) DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module_perm (role_id, module_key),
      INDEX idx_role_id (role_id),
      INDEX idx_module_key (module_key),
      CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Feature-level permissions (strict RBAC)
  // Deprecated tables intentionally removed:
  // - adm_role_feature_permissions
  // - adm_user_permission_overrides
  // - adm_user_feature_overrides
  // - adm_role_disabled_features
}

router.get(
  "/context",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureAccessTables();
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const roleRows = await query(
        "SELECT role_id FROM adm_users WHERE id = :id LIMIT 1",
        { id: userId },
      );
      const roleId = toNumber(roleRows?.[0]?.role_id);
      if (!roleId)
        return res.json({
          roleId: null,
          roleModules: [],
          rolePermissions: [],
          userOverrides: [],
        });
      const roleModules = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :roleId",
        { roleId },
      );
      const rolePermissions = await query(
        "SELECT module_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = :roleId",
        { roleId },
      );
      res.json({
        roleId,
        roleModules,
        rolePermissions,
        userOverrides: [],
      });
    } catch (err) {
      next(err);
    }
  },
);

// Role feature allowlist
async function ensureRoleFeaturesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_features (
      role_id BIGINT UNSIGNED NOT NULL,
      feature_key VARCHAR(150) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, feature_key),
      INDEX idx_role_id (role_id),
      INDEX idx_feature_key (feature_key),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

router.get(
  "/roles/:id/features",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureRoleFeaturesTable();
      const id = toNumber(req.params.id);
      const rows = await query(
        "SELECT feature_key FROM adm_role_features WHERE role_id = :id",
        { id },
      );
      res.json({ features: rows.map((r) => String(r.feature_key)) });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/features",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureRoleFeaturesTable();
      const id = toNumber(req.params.id);
      const { features } = req.body || {};
      if (!Array.isArray(features))
        return res.status(400).json({ message: "features must be array" });

      // In neutralized RBAC environment, allow all features without module assignment check
      const valid = features.filter((fk) => String(fk || ""));

      // Original validation logic (commented out for neutralized RBAC)
      // const assigned = await query(
      //   "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
      //   { id },
      // );
      // const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      // const valid = [];
      // for (const fkRaw of features) {
      //   const fk = String(fkRaw || "");
      //   if (!fk) continue;
      //   const mk = fk.includes(":") ? fk.split(":")[0] : "";
      //   if (!assignedSet.has(mk))
      //     return res
      //       .status(400)
      //       .json({ message: `module not assigned for feature: ${fk}` });
      //   valid.push(fk);
      // }
      await query("DELETE FROM adm_role_features WHERE role_id = :id", { id });
      for (const fk of valid) {
        await query(
          "INSERT INTO adm_role_features (role_id, feature_key) VALUES (:id, :fk)",
          { id, fk },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Modules enumeration
router.get(
  "/modules",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const modules = [
        "administration",
        "sales",
        "inventory",
        "purchase",
        "finance",
        "human-resources",
        "maintenance",
        "project-management",
        "production",
        "pos",
        "business-intelligence",
        "service-management",
      ];
      res.json({ modules });
    } catch (err) {
      next(err);
    }
  },
);

function normalizeModuleName(name) {
  const s = String(name || "")
    .toLowerCase()
    .trim();
  return s.replace(/\s+/g, "-");
}
function featureKeyFromPath(path, moduleKey) {
  const p = String(path || "").replace(/^\/+/, "");
  const parts = p.split("/").filter(Boolean);
  if (!parts.length) return `${moduleKey}:${p || "root"}`;
  const withoutModule = parts[0] === moduleKey ? parts.slice(1) : parts;
  const slug = withoutModule.join("-");
  return `${moduleKey}:${slug || "root"}`;
}
router.get(
  "/features",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const features = getAllFeatures();
      res.json({ features });
    } catch (err) {
      next(err);
    }
  },
);

async function requireSuperAdmin(req, res, next) {
  try {
    const userId = toNumber(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const rows = await query(
      "SELECT role_id FROM adm_users WHERE id = :id LIMIT 1",
      { id: userId },
    );
    const roleId = toNumber(rows?.[0]?.role_id);
    if (roleId === 1) return next();
    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    next(err);
  }
}

// Roles CRUD (hybrid)
router.get(
  "/roles",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const items = await query(
        "SELECT id, company_id, name, code, is_active FROM adm_roles ORDER BY name ASC",
        {},
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/roles",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const companyId = toNumber(req.scope?.companyId) || 1;
      const { name, code, is_active } = req.body || {};
      if (!name || !code)
        return res.status(400).json({ message: "name and code required" });
      const r = await query(
        "INSERT INTO adm_roles (company_id, name, code, is_active) VALUES (:companyId, :name, :code, :is_active)",
        {
          companyId,
          name,
          code,
          is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        },
      );
      res.status(201).json({ id: r.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const { name, code, is_active } = req.body || {};
      if (!id || !name || !code)
        return res.status(400).json({ message: "invalid payload" });
      await query(
        "UPDATE adm_roles SET name = :name, code = :code, is_active = :is_active WHERE id = :id",
        {
          id,
          name,
          code,
          is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      return res.status(405).json({ message: "Roles cannot be deleted" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      return res.status(405).json({ message: "Roles cannot be deleted" });
    } catch (err) {
      next(err);
    }
  },
);

// Role modules
router.get(
  "/roles/:id/modules",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const rows = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      res.json({ modules: rows.map((r) => r.module_key) });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/modules",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const { modules } = req.body || {};
      if (!Array.isArray(modules))
        return res.status(400).json({ message: "modules must be array" });
      await query("DELETE FROM adm_role_modules WHERE role_id = :id", { id });
      for (const mk of modules) {
        await query(
          "INSERT INTO adm_role_modules (role_id, module_key) VALUES (:id, :mk)",
          { id, mk: String(mk) },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Role permissions
router.get(
  "/roles/:id/permissions",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const assigned = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      const perms = await query(
        "SELECT module_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = :id",
        { id },
      );
      const filtered = perms.filter((p) =>
        assignedSet.has(String(p.module_key)),
      );
      res.json({ permissions: filtered });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/permissions",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const { permissions } = req.body || {};
      if (!Array.isArray(permissions))
        return res.status(400).json({ message: "permissions must be array" });
      const assigned = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      for (const p of permissions) {
        const mk = String(p.module_key || "");
        if (!assignedSet.has(mk))
          return res
            .status(400)
            .json({ message: `module not assigned: ${mk}` });
        const payload = {
          can_view: Number(Boolean(p.can_view)),
          can_create: Number(Boolean(p.can_create)),
          can_edit: Number(Boolean(p.can_edit)),
          can_delete: Number(Boolean(p.can_delete)),
        };
        await query(
          `INSERT INTO adm_role_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
         VALUES (:id, :mk, :can_view, :can_create, :can_edit, :can_delete)
         ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit), can_delete=VALUES(can_delete)`,
          { id, mk, ...payload },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Get module configuration (for frontend reference)
 */
router.get(
  "/modules/config",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      // This would typically come from a configuration file
      // For now, return a basic structure that matches our client-side config
      const modules = [
        {
          key: "purchase",
          name: "Purchase",
          icon: "🛒",
          path: "/purchase",
          features: [
            {
              key: "purchase-order",
              name: "Purchase Order",
              path: "/purchase/purchase-orders",
            },
            { key: "grn", name: "GRN", path: "/purchase/grn" },
            {
              key: "purchase-bill",
              name: "Purchase Bill",
              path: "/purchase/purchase-bills",
            },
            {
              key: "direct-purchase",
              name: "Direct Purchase",
              path: "/purchase/direct-purchase",
            },
            {
              key: "purchase-return",
              name: "Purchase Return",
              path: "/purchase/purchase-returns",
            },
            { key: "rfq", name: "RFQ", path: "/purchase/rfq" },
          ],
          dashboards: [
            {
              key: "purchase-dashboard",
              name: "Purchase Dashboard",
              path: "/purchase/dashboard",
            },
          ],
        },
        {
          key: "sales",
          name: "Sales",
          icon: "💰",
          path: "/sales",
          features: [
            {
              key: "sales-order",
              name: "Sales Order",
              path: "/sales/sales-orders",
            },
            {
              key: "sales-invoice",
              name: "Sales Invoice",
              path: "/sales/sales-invoices",
            },
            {
              key: "sales-return",
              name: "Sales Return",
              path: "/sales/sales-returns",
            },
            { key: "quotation", name: "Quotation", path: "/sales/quotations" },
            {
              key: "customer-payment",
              name: "Customer Payment",
              path: "/sales/customer-payments",
            },
          ],
          dashboards: [
            {
              key: "sales-dashboard",
              name: "Sales Dashboard",
              path: "/sales/dashboard",
            },
          ],
        },
        {
          key: "inventory",
          name: "Inventory",
          icon: "📦",
          path: "/inventory",
          features: [
            {
              key: "stock-management",
              name: "Stock Management",
              path: "/inventory/stock",
            },
            {
              key: "stock-transfer",
              name: "Stock Transfer",
              path: "/inventory/stock-transfer",
            },
            {
              key: "stock-adjustment",
              name: "Stock Adjustment",
              path: "/inventory/stock-adjustment",
            },
            {
              key: "item-master",
              name: "Item Master",
              path: "/inventory/items",
            },
          ],
          dashboards: [
            {
              key: "inventory-dashboard",
              name: "Inventory Dashboard",
              path: "/inventory/dashboard",
            },
          ],
        },
        {
          key: "accounts",
          name: "Accounts",
          icon: "📊",
          path: "/accounts",
          features: [
            {
              key: "chart-of-accounts",
              name: "Chart of Accounts",
              path: "/accounts/chart-of-accounts",
            },
            {
              key: "journal-entry",
              name: "Journal Entry",
              path: "/accounts/journal-entries",
            },
            { key: "ledger", name: "Ledger", path: "/accounts/ledger" },
            {
              key: "trial-balance",
              name: "Trial Balance",
              path: "/accounts/trial-balance",
            },
            {
              key: "balance-sheet",
              name: "Balance Sheet",
              path: "/accounts/balance-sheet",
            },
            {
              key: "profit-loss",
              name: "Profit & Loss",
              path: "/accounts/profit-loss",
            },
          ],
          dashboards: [
            {
              key: "accounts-dashboard",
              name: "Accounts Dashboard",
              path: "/accounts/dashboard",
            },
          ],
        },
        {
          key: "admin",
          name: "Admin",
          icon: "⚙️",
          path: "/admin",
          features: [
            {
              key: "user-management",
              name: "User Management",
              path: "/admin/users",
            },
            {
              key: "role-management",
              name: "Role Management",
              path: "/admin/roles",
            },
            {
              key: "company-settings",
              name: "Company Settings",
              path: "/admin/company",
            },
            {
              key: "system-settings",
              name: "System Settings",
              path: "/admin/settings",
            },
          ],
          dashboards: [
            {
              key: "admin-dashboard",
              name: "Admin Dashboard",
              path: "/admin/dashboard",
            },
          ],
        },
      ];

      res.json({ modules });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
