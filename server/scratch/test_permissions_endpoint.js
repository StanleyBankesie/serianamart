import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const userId = 4; // Agnes (Role 1)
    
    const roleResult = await query(
      `SELECT role_id FROM adm_users WHERE id = :userId`,
      { userId },
    );
    const roleId = roleResult[0].role_id;
    
    const modules = await query(
      `SELECT module_key FROM adm_role_modules WHERE role_id = :roleId`,
      { roleId },
    );
    
    const permissions = await query(
      `SELECT module_key, feature_key, can_view FROM adm_role_permissions WHERE role_id = :roleId`,
      { roleId },
    );
    
    console.log(`Modules for user ${userId}:`, modules.length);
    console.log(`Permissions for user ${userId}:`, permissions.length);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
