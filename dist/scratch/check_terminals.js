
import { query } from "../db/pool.js";

async function check() {
  try {
    const columns = await query("SHOW COLUMNS FROM pos_terminals");
    console.log("Columns in pos_terminals:");
    console.table(columns);

    const rows = await query("SELECT id, code, name, warehouse, warehouse_id FROM pos_terminals");
    console.log("Rows in pos_terminals:");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
