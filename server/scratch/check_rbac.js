import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const roles = await query("SELECT * FROM adm_roles");
    console.log("Roles:");
    console.table(roles);

    const roleModules = await query("SELECT * FROM adm_role_modules");
    console.log("Role Modules:");
    console.table(roleModules);

    const users = await query("SELECT id, username, role_id FROM adm_users");
    console.log("Users:");
    console.table(users);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
