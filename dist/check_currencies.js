import { query } from "./db/pool.js";

async function check() {
  try {
    console.log("Columns for fin_currencies:");
    const cols = await query("SHOW COLUMNS FROM fin_currencies");
    cols.forEach(r => console.log(`${r.Field}: ${r.Type}`));
    
    console.log("\nSample data from fin_currencies:");
    const rows = await query("SELECT * FROM fin_currencies LIMIT 10");
    console.table(rows);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}

check();
