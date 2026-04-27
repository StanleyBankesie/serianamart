import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

async function run() {
  try {
    const role = await query("SELECT * FROM adm_roles WHERE id = 5");
    console.log("Role 5:", role);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
