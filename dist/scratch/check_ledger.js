
import { query } from "../db/pool.js";

async function check() {
  try {
    const ledger = await query("SELECT id, item_id, transaction_type, qty_change, source_ref FROM inv_stock_ledger WHERE transaction_type = 'POS_SALE' ORDER BY id DESC LIMIT 10");
    console.log("Recent POS_SALE ledger entries:");
    console.table(ledger);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
