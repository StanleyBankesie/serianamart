
import { query } from "../db/pool.js";

async function check() {
  try {
    const cols = await query("SHOW COLUMNS FROM inv_items");
    console.log("Columns in inv_items:");
    console.table(cols);

    const warehouseCols = await query("SHOW COLUMNS FROM inv_item_warehouses").catch(() => []);
    if (warehouseCols.length) {
      console.log("Columns in inv_item_warehouses:");
      console.table(warehouseCols);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
