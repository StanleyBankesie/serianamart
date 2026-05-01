import { query } from "../db/pool.js";

async function hasColumn(tableName, columnName) {
  try {
    const rows = await query(`
      SELECT COUNT(*) AS c
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
        AND column_name = :columnName
    `, { tableName, columnName });
    return Number(rows?.[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await hasColumn(tableName, columnName))) {
    console.log(`Adding ${columnName} to ${tableName}...`);
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).catch(err => {
      console.error(`Failed to add ${columnName} to ${tableName}:`, err.message);
    });
  }
}

async function run() {
  try {
    const tables = [
      "inv_warehouses",
      "inv_uom",
      "inv_item_types",
      "adm_system_settings",
      "inv_stock_balances",
      "inv_issue_to_requirement_details",
      "inv_item_categories",
      "inv_item_groups",
      "fin_currencies",
      "sal_price_types",
      "fin_tax_codes",
      "fin_accounts",
      "inv_goods_receipt_notes",
      "inv_goods_receipt_note_details",
      "inv_material_requisitions",
      "inv_return_to_stores",
      "inv_return_to_stores_details",
      "inv_stock_transfers",
      "inv_stock_transfer_details",
      "inv_unit_conversions"
    ];

    for (const t of tables) {
      await addColumnIfMissing(t, "created_by", "BIGINT UNSIGNED NULL");
      await addColumnIfMissing(t, "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    console.log("Migration complete.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
  process.exit(0);
}

run();
