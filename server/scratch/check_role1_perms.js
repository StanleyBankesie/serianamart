import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const rolePerms = await query("SELECT * FROM adm_role_permissions WHERE role_id = 1");
    console.log("Role 1 Permissions:");
    console.table(rolePerms);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
