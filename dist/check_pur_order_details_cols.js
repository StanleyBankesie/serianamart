import { query } from "./db/pool.js";

async function check() {
  try {
    console.log("Columns for pur_order_details:");
    const rows = await query("SHOW COLUMNS FROM pur_order_details");
    rows.forEach(r => {
      console.log(`${r.Field}: ${r.Type}`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}

check();
