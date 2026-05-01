import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const perms = await query("SELECT * FROM adm_role_permissions WHERE role_id = 5");
    console.log("Role 5 permissions:", perms);
    
    const modules = await query("SELECT * FROM adm_role_modules WHERE role_id = 5");
    console.log("Role 5 modules:", modules);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
