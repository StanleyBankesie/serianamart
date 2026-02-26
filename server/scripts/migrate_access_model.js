import { query } from "../db/pool.js";

async function dropOldRbac() {
  const tablesInOrder = [
    "adm_role_pages",
    "adm_role_permissions",
    "adm_user_permissions",
    "adm_exceptional_permissions",
    "adm_user_roles",
    "adm_pages",
  ];
  for (const t of tablesInOrder) {
    try {
      await query(`DROP TABLE IF EXISTS ${t}`);
      console.log(`Dropped ${t}`);
    } catch (err) {
      console.log(`Skip drop ${t}: ${err.message}`);
    }
  }
}

async function createNewAccessTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_user_permission_overrides (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      can_view TINYINT(1) NULL,
      can_create TINYINT(1) NULL,
      can_edit TINYINT(1) NULL,
      can_delete TINYINT(1) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_module_override (user_id, module_key),
      INDEX idx_user_id (user_id),
      INDEX idx_module_key (module_key),
      CONSTRAINT fk_upo_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  try {
    await query(
      "ALTER TABLE adm_users ADD COLUMN role_id BIGINT UNSIGNED NULL",
    );
    console.log("Added role_id column to adm_users");
  } catch (err) {
    console.log("Skipping add role_id column:", err.message);
  }
  try {
    await query(
      "ALTER TABLE adm_users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES adm_roles(id)",
    );
    console.log("Added fk_user_role");
  } catch (err) {
    console.log("Skipping fk_user_role:", err.message);
  }
}

async function seedDefaultRoles() {
  const roles = [
    "Super Admin",
    "Finance Manager",
    "Accountant",
    "Sales Officer",
    "Inventory Officer",
    "HR Manager",
  ];
  for (const name of roles) {
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    await query(
      "INSERT IGNORE INTO adm_roles (company_id, name, code, is_active) VALUES (1, :name, :code, 1)",
      { name, code },
    );
  }
  const moduleKeys = [
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
  const [{ id: superAdminId }] =
    (await query(
      "SELECT id FROM adm_roles WHERE name = 'Super Admin' LIMIT 1",
    )) || [];
  if (superAdminId) {
    for (const mk of moduleKeys) {
      await query(
        "INSERT IGNORE INTO adm_role_modules (role_id, module_key) VALUES (:roleId, :moduleKey)",
        { roleId: superAdminId, moduleKey: mk },
      );
      await query(
        `INSERT IGNORE INTO adm_role_permissions 
         (role_id, module_key, can_view, can_create, can_edit, can_delete)
         VALUES (:roleId, :moduleKey, 1, 1, 1, 1)`,
        { roleId: superAdminId, moduleKey: mk },
      );
    }
  }
}

async function run() {
  try {
    await dropOldRbac();
    await createNewAccessTables();
    await seedDefaultRoles();
    console.log("Access model migration completed");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
