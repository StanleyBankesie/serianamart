import { query } from "./db/pool.js";

async function check() {
  try {
    console.log("Columns for pur_direct_purchase_hdr:");
    const hdrRows = await query("SHOW COLUMNS FROM pur_direct_purchase_hdr").catch(() => []);
    hdrRows.forEach(r => console.log(`${r.Field}: ${r.Type}`));
    
    console.log("\nColumns for pur_direct_purchase_dtl:");
    const dtlRows = await query("SHOW COLUMNS FROM pur_direct_purchase_dtl").catch(() => []);
    dtlRows.forEach(r => console.log(`${r.Field}: ${r.Type}`));
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    process.exit(0);
  }
}

check();
