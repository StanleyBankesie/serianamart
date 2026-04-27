import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

const TABLES = ['sal_invoices', 'inv_items', 'pur_bills', 'fin_vouchers', 'adm_users'];

async function run() {
  try {
    for (const table of TABLES) {
      console.log(`--- Schema for ${table} ---`);
      try {
        const rows = await query(`DESCRIBE ${table}`);
        console.table(rows);
      } catch (e) {
        console.log(`Table ${table} might not exist or error: ${e.message}`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
