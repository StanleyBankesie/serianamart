
import { query } from "../db/pool.js";

async function check() {
  try {
    const columns = await query("SHOW COLUMNS FROM pos_sale_lines");
    console.log("Columns in pos_sale_lines:");
    console.table(columns);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
