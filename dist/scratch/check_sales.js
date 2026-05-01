
import { query } from "../db/pool.js";

async function check() {
  try {
    const sales = await query("SELECT id, receipt_no, status, terminal_id FROM pos_sales ORDER BY id DESC LIMIT 5");
    console.log("Recent POS sales:");
    console.table(sales);

    const lines = await query("SELECT sale_id, item_name, qty FROM pos_sale_lines ORDER BY sale_id DESC LIMIT 10");
    console.log("Recent POS sale lines:");
    console.table(lines);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
