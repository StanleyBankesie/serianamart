import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { query } from "./db/pool.js";

async function run() {
  try {
    const compCols = await query("SHOW COLUMNS FROM fin_tax_components");
    console.log("fin_tax_components cols:", compCols[0]);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
