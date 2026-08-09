import { pool } from "./db/pool.js";

async function run() {
  try {
    const roles = await pool.query("SELECT id, name, company_id FROM adm_roles LIMIT 10");
    console.log("ROLES:", roles[0]);
    
    const modules = await pool.query("SELECT role_id, module_key FROM adm_role_modules LIMIT 20");
    console.log("ROLE MODULES:", modules[0]);
    
    const perms = await pool.query("SELECT role_id, module_key, feature_key FROM adm_role_permissions LIMIT 20");
    console.log("ROLE PERMS:", perms[0]);

    const users = await pool.query("SELECT id, username, role_id, company_id FROM adm_users LIMIT 5");
    console.log("USERS:", users[0]);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
