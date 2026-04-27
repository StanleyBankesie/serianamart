import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const roleModules = await query("SELECT * FROM adm_role_modules WHERE role_id = 5");
    console.log("Role 5 Modules:");
    console.table(roleModules);

    const roleFeatures = await query("SELECT * FROM adm_role_features WHERE role_id = 5");
    console.log("Role 5 Features:");
    console.table(roleFeatures);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
