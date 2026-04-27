
import { query } from "../db/pool.js";

async function check() {
  try {
    const items = await query("SELECT id, item_name, item_code FROM inv_items WHERE item_name LIKE '%Sample%' OR item_name LIKE '%Softcare%'");
    console.log("Items in inv_items:");
    console.table(items);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
