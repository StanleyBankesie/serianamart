import { query } from "../db/pool.js";

async function check() {
  try {
    const tables = ["fin_accounts", "fin_cost_centers", "fin_account_groups", "fin_currency_rates"];
    for (const t of tables) {
      console.log(`--- ${t} ---`);
      try {
        const rows = await query(`DESCRIBE ${t}`);
        console.table(rows);
      } catch (e) {
        console.error(`Error describing ${t}:`, e.message);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
