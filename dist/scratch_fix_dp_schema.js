import { query, pool } from "./db/pool.js";

async function hasColumn(tableName, columnName) {
  try {
    await query(`SELECT ${columnName} FROM ${tableName} LIMIT 1`);
    return true;
  } catch (err) {
    return false;
  }
}

async function ensureDirectPurchaseExtendedColumns() {
  if (!(await hasColumn("pur_direct_purchase_hdr", "currency"))) {
    console.log("Adding currency column to pur_direct_purchase_hdr...");
    await pool
      .query("ALTER TABLE pur_direct_purchase_hdr ADD COLUMN currency VARCHAR(20) NULL AFTER warehouse_id")
      .catch((e) => console.error("Error adding currency:", e.message));
  }
  if (!(await hasColumn("pur_direct_purchase_dtl", "tax_amount"))) {
    console.log("Adding tax_amount column to pur_direct_purchase_dtl...");
    await pool
      .query("ALTER TABLE pur_direct_purchase_dtl ADD COLUMN tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER tax_percent")
      .catch((e) => console.error("Error adding tax_amount:", e.message));
  }
  if (!(await hasColumn("pur_direct_purchase_dtl", "tax_code_id"))) {
    console.log("Adding tax_code_id column to pur_direct_purchase_dtl...");
    await pool
      .query("ALTER TABLE pur_direct_purchase_dtl ADD COLUMN tax_code_id BIGINT UNSIGNED NULL")
      .catch((e) => console.error("Error adding tax_code_id:", e.message));
  }
}

async function run() {
  try {
    await ensureDirectPurchaseExtendedColumns();
    console.log("Direct Purchase schema update complete.");
    
    console.log("\npur_direct_purchase_hdr:");
    console.table((await query("SHOW COLUMNS FROM pur_direct_purchase_hdr")).map(r => ({ Field: r.Field, Type: r.Type })));
    
    console.log("\npur_direct_purchase_dtl:");
    console.table((await query("SHOW COLUMNS FROM pur_direct_purchase_dtl")).map(r => ({ Field: r.Field, Type: r.Type })));
  } catch (e) {
    console.error("Run error:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
