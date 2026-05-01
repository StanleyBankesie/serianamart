import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";
import { getUserPermissions } from "../services/token.service.js";

async function run() {
  try {
    const users = await query("SELECT id, username, role_id FROM adm_users WHERE id > 1 LIMIT 5");
    console.log("Sample users:", users);
    
    for (const user of users) {
      const perms = await getUserPermissions(user.id);
      console.log(`Permissions for ${user.username} (ID: ${user.id}, Role: ${user.role_id}):`, perms);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
