import { query } from '../db/pool.js';
async function run() {
  const r = await query("SELECT nature FROM fin_account_groups WHERE code = '4000.SALESACCOUNT'");
  console.log(JSON.stringify(r));
  process.exit(0);
}
run();
