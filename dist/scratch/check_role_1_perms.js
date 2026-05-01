import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const perms = await query("SELECT * FROM adm_role_permissions WHERE role_id = 1");
    console.log("Role 1 permissions:", perms);
    
    const count = await query("SELECT COUNT(*) as c FROM adm_permissions");
    console.log("Total permissions in adm_permissions:", count);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
