import { query } from "./pool.js";

async function checkSchema() {
  try {
    const [row] = await query("SELECT * FROM sal_invoices LIMIT 1");
    if (row) {
        console.log("Invoice columns:", Object.keys(row));
    } else {
        const columns = await query("PRAGMA table_info(sal_invoices)");
        console.log("Columns from PRAGMA:", columns.map(c => c.name));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
