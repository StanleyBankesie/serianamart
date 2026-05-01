
import { query } from "../db/pool.js";

async function check() {
  try {
    const rows = await query("SELECT id, company_id, branch_id, warehouse_id, item_id, qty FROM inv_stock_balances WHERE qty > 0");
    console.log("Active stock in inv_stock_balances:");
    console.table(rows);

    const terminals = await query("SELECT id, code, warehouse_id FROM pos_terminals");
    console.log("Terminals:");
    console.table(terminals);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
