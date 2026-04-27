import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const rows = await query("DESCRIBE adm_role_permissions");
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
