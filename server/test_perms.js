import { pool } from './db/pool.js';
async function run() {
  try {
    const userId = 2; // sales girl
    const roleResult = await pool.query(`SELECT role_id, company_id FROM adm_users WHERE id = ?`, [userId]);
    let roleId = Number(roleResult[0]?.[0]?.role_id || 0) || 0;
    
    const modules = await pool.query(`SELECT module_key FROM adm_role_modules WHERE role_id = ?`, [roleId]);
    console.log('RoleID:', roleId);
    console.log('Modules:', modules[0]);
  } catch(e) { console.error(e) }
  process.exit(0);
}
run();
