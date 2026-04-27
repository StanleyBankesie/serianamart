import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const roleFeatures = await query("SELECT * FROM adm_role_features WHERE role_id = 1");
    console.log("Role 1 Features:");
    console.table(roleFeatures);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
