
import { query } from "../db/pool.js";

async function check() {
  try {
    const sales = await query("SELECT company_id, branch_id FROM pos_sales ORDER BY id DESC LIMIT 1");
    console.log("Recent POS sale scope:");
    console.table(sales);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
