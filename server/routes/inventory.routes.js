import express from "express";
import * as XLSX from "xlsx";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  recordMovementTx,
  consumeStockFIFOTx,
  reserveStockTx,
  moveReservedStockTx,
} from "../services/stock.service.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";

const router = express.Router();

function toNumber(v, fb = null) {
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function toDateOnly(s) {
  if (!s) return null;
  if (typeof s !== "string") return null;
  return String(s).slice(0, 10) || null;
}

async function resolveTransferScopeTx(
  conn,
  {
    companyId,
    transferType,
    fromBranchId,
    toBranchId,
    fromWarehouseId,
    toWarehouseId,
  },
) {
  const normalizedType = String(transferType || "")
    .trim()
    .toUpperCase();
  let resolvedFromBranchId = fromBranchId || null;
  let resolvedToBranchId = toBranchId || null;

  if (normalizedType === "INTER_WAREHOUSE") {
    if (!fromWarehouseId || !toWarehouseId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "From warehouse and to warehouse are required",
      );
    }
    const [warehouseRows] = await conn.execute(
      `
      SELECT id, company_id, branch_id
      FROM inv_warehouses
      WHERE company_id = :companyId
        AND id IN (:fromWarehouseId, :toWarehouseId)
      `,
      { companyId, fromWarehouseId, toWarehouseId },
    );
    const fromWarehouse = (warehouseRows || []).find(
      (row) => Number(row.id) === Number(fromWarehouseId),
    );
    const toWarehouse = (warehouseRows || []).find(
      (row) => Number(row.id) === Number(toWarehouseId),
    );
    if (!fromWarehouse || !toWarehouse) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid transfer warehouse");
    }
    resolvedFromBranchId = Number(fromWarehouse.branch_id) || null;
    resolvedToBranchId = Number(toWarehouse.branch_id) || null;
  }

  return {
    transferType: normalizedType || null,
    fromBranchId: resolvedFromBranchId,
    toBranchId: resolvedToBranchId,
    fromWarehouseId: fromWarehouseId || null,
    toWarehouseId: toWarehouseId || null,
  };
}

async function hasTable(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
    `,
    { tableName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function hasTrigger(triggerName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.triggers
    WHERE trigger_schema = DATABASE()
      AND trigger_name = :triggerName
    `,
    { triggerName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensureWarehousesTable() {
  if (!(await hasTable("inv_warehouses"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_warehouses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        warehouse_code VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(150) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_warehouse_scope_code (company_id, branch_id, warehouse_code),
        KEY idx_warehouse_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

async function ensureStockBalancesWarehouseInfrastructure() {
  if (!(await hasColumn("inv_stock_balances", "warehouse_id"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
    ).catch(() => {});
    await query(
      "ALTER TABLE inv_stock_balances ADD UNIQUE KEY uq_stock_scope_wh_item (company_id, branch_id, warehouse_id, item_id)",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "reserved_qty"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN reserved_qty DECIMAL(18,3) NOT NULL DEFAULT 0",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "batch_no"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN batch_no VARCHAR(100) NULL",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "serial_no"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN serial_no VARCHAR(100) NULL",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "expiry_date"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN expiry_date DATE NULL",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "entry_date"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN entry_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "source_type"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN source_type VARCHAR(50) NULL",
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_balances", "source_id"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN source_id BIGINT UNSIGNED NULL",
    ).catch(() => {});
  }
}

async function ensureStockBalanceDetailsInfrastructure() {
  // View now reads from inv_stock_balances directly (no separate details table)
  await query(`
    CREATE OR REPLACE VIEW v_active_stock_details AS
    SELECT
      sb.id,
      sb.company_id,
      sb.branch_id,
      sb.warehouse_id,
      sb.item_id,
      sb.batch_no,
      sb.serial_no,
      sb.expiry_date,
      sb.qty,
      sb.reserved_qty,
      sb.entry_date,
      sb.source_type,
      sb.source_id,
      i.item_code,
      i.item_name,
      i.uom,
      w.warehouse_name
    FROM inv_stock_balances sb
    JOIN inv_items i ON i.id = sb.item_id
    LEFT JOIN inv_warehouses w ON w.id = sb.warehouse_id
    WHERE (sb.qty > 0 OR sb.reserved_qty > 0)
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_ledger (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      transaction_type VARCHAR(50) NOT NULL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      qty_change DECIMAL(18,3) NOT NULL,
      batch_no VARCHAR(100) DEFAULT NULL,
      serial_no VARCHAR(100) DEFAULT NULL,
      expiry_date DATE DEFAULT NULL,
      source_ref VARCHAR(100) DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      KEY idx_ledger_scope (company_id, branch_id),
      KEY idx_ledger_item (item_id),
      KEY idx_ledger_date (transaction_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureGRNTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_goods_receipt_notes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      grn_no VARCHAR(50) NOT NULL,
      grn_date DATE NOT NULL,
      grn_type ENUM('LOCAL','IMPORT') NOT NULL DEFAULT 'LOCAL',
      warehouse_id BIGINT UNSIGNED NULL,
      supplier_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_grn_no (company_id, branch_id, grn_no),
      KEY idx_grn_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_goods_receipt_note_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      grn_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_ordered DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_received DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_accepted DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_rejected DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      KEY idx_grnd_grn (grn_id),
      KEY idx_grnd_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function nextGRNNo(companyId, branchId, type = "LOCAL") {
  const prefix = type === "IMPORT" ? "GI-" : "GL-";
  const rows = await query(
    `
    SELECT grn_no
    FROM inv_goods_receipt_notes
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND grn_no LIKE :pattern
    ORDER BY CAST(SUBSTRING(grn_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId, pattern: `${prefix}%` },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].grn_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

async function nextMaterialRequisitionNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT requisition_no
    FROM inv_material_requisitions
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND requisition_no LIKE 'MR-%'
    ORDER BY CAST(SUBSTRING(requisition_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  ).catch(() => []);
  let nextNum = 1;
  if (rows && rows.length) {
    const prev = String(rows[0].requisition_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MR-${String(nextNum).padStart(6, "0")}`;
}

async function ensureReturnToStoresInfrastructure() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_return_to_stores (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      rts_no VARCHAR(50) NOT NULL,
      rts_date DATE NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      department_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_rts_no (company_id, branch_id, rts_no),
      KEY idx_rts_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_return_to_stores_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      rts_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_returned DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20),
      reason VARCHAR(255),
      \`condition\` VARCHAR(20) DEFAULT 'GOOD',
      batch_serial VARCHAR(100),
      location VARCHAR(100),
      remarks VARCHAR(255),
      KEY idx_rtsd_rts (rts_id),
      KEY idx_rtsd_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS qty_returned DECIMAL(18,3) NOT NULL DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS reason VARCHAR(255)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS \`condition\` VARCHAR(20) DEFAULT 'GOOD'
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS batch_serial VARCHAR(100)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS location VARCHAR(100)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS remarks VARCHAR(255)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS remaining_qty DECIMAL(18,3) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS qty_issued DECIMAL(18,3) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS issue_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS requisition_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS return_type VARCHAR(50) DEFAULT 'EXCESS'
  `).catch(() => {});
  await ensureReturnToStoresStockInTrigger();
}

async function ensureReturnToStoresStockInTrigger() {
  if (!(await hasTrigger("tr_rts_status_au_stock_in"))) {
    await query(`
      CREATE TRIGGER tr_rts_status_au_stock_in
      AFTER UPDATE ON inv_return_to_stores
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, COALESCE(d.qty_returned, 0),
                 d.batch_serial, NULL, NULL, NOW(), 'RETURN_TO_STORES', NEW.id
          FROM inv_return_to_stores_details d
          WHERE d.rts_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
}

async function nextReturnNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT rts_no
    FROM inv_return_to_stores
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND rts_no LIKE 'RTS-%'
    ORDER BY CAST(SUBSTRING(rts_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].rts_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RTS-${String(nextNum).padStart(6, "0")}`;
}

async function ensureStockTransferTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfers (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      transfer_no VARCHAR(50) NOT NULL,
      transfer_date DATE NOT NULL,
      from_branch_id BIGINT UNSIGNED NULL,
      to_branch_id BIGINT UNSIGNED NULL,
      from_warehouse_id BIGINT UNSIGNED NULL,
      to_warehouse_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_trans_no (company_id, branch_id, transfer_no),
      KEY idx_trans_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Ensure additional columns for tracking and mapping
  await query(`
    ALTER TABLE inv_stock_transfers 
    ADD COLUMN IF NOT EXISTS received_date DATETIME NULL AFTER status,
    ADD COLUMN IF NOT EXISTS received_by BIGINT UNSIGNED NULL AFTER received_date,
    ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(30) NULL AFTER received_by,
    ADD COLUMN IF NOT EXISTS branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER company_id
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfer_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      transfer_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      uom VARCHAR(20),
      batch_no VARCHAR(100) NULL,
      accepted_qty DECIMAL(18,3) NULL,
      rejected_qty DECIMAL(18,3) NULL,
      received_qty DECIMAL(18,3) NULL,
      acceptance_remarks TEXT NULL,
      KEY idx_std_transfer (transfer_id),
      KEY idx_std_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    ALTER TABLE inv_stock_transfer_details 
    ADD COLUMN IF NOT EXISTS uom VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS accepted_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS rejected_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS received_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS acceptance_remarks TEXT NULL
  `).catch(() => {});
}

async function applyTransferReceiptMovementsTx(
  conn,
  { companyId, transferId, createdBy = null },
) {
  const [rows] = await conn.execute(
    `
    SELECT
      t.transfer_no,
      t.from_warehouse_id,
      t.to_warehouse_id,
      COALESCE(tw.company_id, t.company_id) AS to_company_id,
      COALESCE(tw.branch_id, t.to_branch_id, t.branch_id) AS to_branch_id,
      d.item_id,
      COALESCE(d.received_qty, 0) AS received_qty
    FROM inv_stock_transfers t
    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
    LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
    WHERE t.id = :transferId
      AND t.company_id = :companyId
    ORDER BY d.id ASC
    `,
    { companyId, transferId },
  );

  for (const row of rows || []) {
    const qtyToMove = Number(row.received_qty || 0);
    const itemId = Number(row.item_id || 0);
    const fromWarehouseId = Number(row.from_warehouse_id || 0) || null;
    const toWarehouseId = Number(row.to_warehouse_id || 0) || null;
    const toCompanyId = Number(row.to_company_id || 0) || companyId;
    const toBranchId = Number(row.to_branch_id || 0) || null;

    if (!qtyToMove || !itemId || !fromWarehouseId || !toWarehouseId) continue;

    let remainingSourceQty = qtyToMove;
    const [sourceRows] = await conn.execute(
      `
      SELECT id, reserved_qty
      FROM inv_stock_balances
      WHERE company_id = :companyId
        AND warehouse_id = :warehouseId
        AND item_id = :itemId
        AND COALESCE(reserved_qty, 0) > 0
      ORDER BY entry_date ASC, id ASC
      FOR UPDATE
      `,
      {
        companyId,
        warehouseId: fromWarehouseId,
        itemId,
      },
    );

    for (const sourceRow of sourceRows || []) {
      if (remainingSourceQty <= 0) break;
      const reservedQty = Number(sourceRow.reserved_qty || 0);
      if (reservedQty <= 0) continue;
      const deductQty = Math.min(remainingSourceQty, reservedQty);
      await conn.execute(
        `
        UPDATE inv_stock_balances
        SET reserved_qty = reserved_qty - :deductQty
        WHERE id = :id
        `,
        { deductQty, id: sourceRow.id },
      );
      remainingSourceQty -= deductQty;
    }

    if (remainingSourceQty > 0) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        `Received qty exceeds reserved stock for item ${itemId}`,
      );
    }

    const [destRows] = await conn.execute(
      `
      SELECT id
      FROM inv_stock_balances
      WHERE company_id = :companyId
        AND warehouse_id = :warehouseId
        AND item_id = :itemId
      ORDER BY entry_date ASC, id ASC
      LIMIT 1
      FOR UPDATE
      `,
      {
        companyId: toCompanyId,
        warehouseId: toWarehouseId,
        itemId,
      },
    );

    if (destRows?.length) {
      await conn.execute(
        `
        UPDATE inv_stock_balances
        SET qty = qty + :qtyToMove
        WHERE id = :id
        `,
        { qtyToMove, id: destRows[0].id },
      );
    } else {
      await conn.execute(
        `
        INSERT INTO inv_stock_balances
          (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, entry_date, source_type, source_id)
        VALUES
          (:companyId, :branchId, :warehouseId, :itemId, :qty, 0, NOW(), 'TRANSFER_IN', :sourceId)
        `,
        {
          companyId: toCompanyId,
          branchId: toBranchId,
          warehouseId: toWarehouseId,
          itemId,
          qty: qtyToMove,
          sourceId: transferId,
        },
      );
    }
  }
}

// UOMs
async function ensureUomTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_uom (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      uom_code VARCHAR(20) NOT NULL,
      uom_name VARCHAR(120) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_uom_code (uom_code)
    )
  `).catch(() => {});

  // Ensure default UOMs exist
  const defaultUOMs = [
    { uom_code: "PCS", uom_name: "Pieces" },
    { uom_code: "KG", uom_name: "Kilogram" },
    { uom_code: "L", uom_name: "Liter" },
    { uom_code: "M", uom_name: "Meter" },
    { uom_code: "BOX", uom_name: "Box" },
    { uom_code: "BAG", uom_name: "Bag" },
    { uom_code: "ROLL", uom_name: "Roll" },
    { uom_code: "PACK", uom_name: "Pack" },
  ];

  for (const uom of defaultUOMs) {
    await query(
      `INSERT IGNORE INTO inv_uom (uom_code, uom_name, is_active) VALUES (:uom_code, :uom_name, 1)`,
      { uom_code: uom.uom_code, uom_name: uom.uom_name },
    ).catch(() => {});
  }
}

router.get("/uoms", requireAuth, async (req, res, next) => {
  try {
    await ensureUomTable();
    const rows = await query(
      `
        SELECT id, uom_code, uom_name
        FROM inv_uom
        WHERE is_active = 1
        ORDER BY uom_name ASC, uom_code ASC
        `,
    );
    res.json({ items: rows || [] });
  } catch (e) {
    next(e);
  }
});

async function ensureUnitConversionsTable() {
  if (!(await hasTable("inv_unit_conversions"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_unit_conversions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        from_uom VARCHAR(20) NOT NULL,
        to_uom VARCHAR(20) NOT NULL,
        conversion_factor DECIMAL(18,6) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_unit_conv (company_id, item_id, from_uom, to_uom),
        KEY idx_unit_conv_item (item_id),
        CONSTRAINT fk_unit_conv_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
  }
}

router.get(
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      const { companyId } = req.scope;
      const rows = await query(
        `
        SELECT c.id,
               c.item_id,
               i.item_code,
               i.item_name,
               c.from_uom,
               c.to_uom,
               c.conversion_factor,
               c.is_active
        FROM inv_unit_conversions c
        JOIN inv_items i ON i.id = c.item_id
        WHERE c.company_id = :companyId
        ORDER BY i.item_name ASC, c.from_uom ASC, c.to_uom ASC, c.id ASC
        `,
        { companyId },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

async function nextTransferNo(companyId) {
  const rows = await query(
    `
    SELECT transfer_no
    FROM inv_stock_transfers
    WHERE company_id = :companyId
      AND transfer_no LIKE 'TRN-%'
    ORDER BY CAST(SUBSTRING(transfer_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].transfer_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `TRN-${String(nextNum).padStart(6, "0")}`;
}

async function ensureMaterialRequisitionApprovalTrigger() {
  await ensureStockBalancesWarehouseInfrastructure();
  await ensureIssueToRequirementTables();
  try {
    await query(
      "ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100)",
    );
  } catch {}
  try {
    await query(
      "ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100)",
    );
  } catch {}
  if (!(await hasTrigger("tr_mat_req_status_au_stock_out"))) {
    await query(`
      CREATE TRIGGER tr_mat_req_status_au_stock_out
      AFTER UPDATE ON inv_material_requisitions
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, -COALESCE(d.qty_requested, 0),
                 d.batch_no, d.serial_no, NULL, NOW(), 'MATERIAL_REQUISITION', NEW.id
          FROM inv_material_requisition_details d
          WHERE d.requisition_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
  if (!(await hasTrigger("tr_mat_req_status_au_stock_in"))) {
    await query(`
      CREATE TRIGGER tr_mat_req_status_au_stock_in
      AFTER UPDATE ON inv_material_requisitions
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'RETURNED' AND OLD.status = 'APPROVED' THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, COALESCE(d.qty_requested, 0),
                 d.batch_no, d.serial_no, NULL, NOW(), 'MATERIAL_REQUISITION', NEW.id
          FROM inv_material_requisition_details d
          WHERE d.requisition_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
  try {
    await query(`DROP TRIGGER IF EXISTS tr_mat_req_status_au_issue_create`);
  } catch {}
  await query(`
    CREATE TRIGGER tr_mat_req_status_au_issue_create
    AFTER UPDATE ON inv_material_requisitions
    FOR EACH ROW
    BEGIN
      DECLARE v_seq BIGINT UNSIGNED;
      DECLARE v_issue_no VARCHAR(50);
      DECLARE v_issue_id BIGINT UNSIGNED;
      IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
        SELECT MAX(CAST(SUBSTRING(issue_no, 5) AS UNSIGNED)) INTO v_seq
          FROM inv_issue_to_requirement
         WHERE company_id = NEW.company_id
           AND branch_id = NEW.branch_id
           AND issue_no LIKE 'ISS-%';
        SET v_seq = IFNULL(v_seq, 0) + 1;
        SET v_issue_no = CONCAT('ISS-', LPAD(v_seq, 6, '0'));
        INSERT INTO inv_issue_to_requirement
          (company_id, branch_id, issue_no, issue_date, warehouse_id, issued_to, status, remarks, created_by, created_at, updated_at, department_id, issue_type, requisition_id)
        VALUES
          (NEW.company_id, NEW.branch_id, v_issue_no, CURDATE(), NEW.warehouse_id, NEW.requested_by, 'POSTED', NEW.remarks, NULL, NEW.updated_at, NEW.updated_at, NEW.department_id, NEW.requisition_type, NEW.id);
        SET v_issue_id = LAST_INSERT_ID();
        INSERT INTO inv_issue_to_requirement_details
          (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
        SELECT 
          v_issue_id,
          d.item_id,
          COALESCE(d.qty_requested, 0) AS qty_issued,
          i.uom,
          d.batch_no,
          d.serial_no
        FROM inv_material_requisition_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.requisition_id = NEW.id;
      END IF;
    END
  `);
}

router.get(
  "/items",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      // Ensure table and UOM column exists with proper defaults
      await ensureItemsTable();
      const rows = await query(
        `
        SELECT id, item_code, item_name, uom, service_item, cost_price, is_active
        FROM inv_items
        WHERE company_id = :companyId
        ORDER BY item_name ASC
        `,
        { companyId: companyId || null },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/warehouses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureWarehousesTable();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT id, warehouse_name
        FROM inv_warehouses
        WHERE company_id = :companyId AND branch_id = :branchId
        ORDER BY warehouse_name ASC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock/available",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query.warehouse_id);
      const itemId = toNumber(req.query.item_id);

      if (!warehouseId || !itemId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "warehouse_id and item_id are required",
        );
      }

      const rows = await query(
        `
        SELECT qty
        FROM inv_stock_balances
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND warehouse_id = :warehouseId
          AND item_id = :itemId
        LIMIT 1
        `,
        { companyId, branchId, warehouseId, itemId },
      ).catch(() => []);

      const qty = rows && rows.length ? Number(rows[0].qty || 0) : 0;
      res.json({ qty });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.VIEW"),
  async (req, res, next) => {
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId, branchId } = req.scope;
      const statusFilter =
        String(req.query?.status || "")
          .trim()
          .toUpperCase() || null;
      // Ensure soft-delete columns exist
      if (!(await hasColumn("inv_material_requisitions", "is_active"))) {
        await query(
          "ALTER TABLE inv_material_requisitions ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
        ).catch(() => {});
      }
      if (!(await hasColumn("inv_material_requisitions", "deleted_at"))) {
        await query(
          "ALTER TABLE inv_material_requisitions ADD COLUMN deleted_at DATETIME NULL",
        ).catch(() => {});
      }
      let where = `
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
          AND COALESCE(r.is_active,'Y') = 'Y'
      `;
      const params = { companyId, branchId };
      if (statusFilter) {
        where += ` AND r.status = :status`;
        params.status = statusFilter;
      }
      const rows = await query(
        `
        SELECT r.id,
               r.requisition_no,
               r.requisition_date,
               r.requisition_type,
               r.priority,
               r.requested_by,
               r.status,
               r.warehouse_id,
               r.department_id,
               w.warehouse_name,
               dep.dept_name AS department_name,
               COUNT(d.id) AS item_count,
               MAX(u.username) AS forwarded_to_username
        FROM inv_material_requisitions r
        LEFT JOIN inv_material_requisition_details d ON d.requisition_id = r.id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN hr_departments dep ON dep.id = r.department_id
        LEFT JOIN (
          SELECT t.document_id, t.assigned_to_user_id
          FROM adm_document_workflows t
          JOIN (
            SELECT document_id, MAX(id) AS max_id
            FROM adm_document_workflows
            WHERE company_id = :companyId
              AND status = 'PENDING'
              AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
            GROUP BY document_id
          ) m ON m.max_id = t.id
        ) x ON x.document_id = r.id
        LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
        ${where}
        GROUP BY r.id
        ORDER BY r.requisition_date DESC, r.id DESC
        `,
        params,
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Stock Balances Report ────────────────────────────────────────────────────
router.get(
  "/stock-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query?.warehouseId);
      const q = String(req.query?.q || "").trim();
      const params = { companyId, branchId };
      let whereItem = "i.company_id = :companyId";
      if (q) {
        whereItem +=
          " AND (i.item_code LIKE :q OR i.item_name LIKE :q OR i.uom LIKE :q)";
        params.q = `%${q}%`;
      }
      const stockWhere = [
        "sb.company_id = :companyId",
        "sb.branch_id = :branchId",
      ];
      if (warehouseId) {
        stockWhere.push("sb.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(SUM(sb.qty), 0) AS total_qty,
          COALESCE(SUM(sb.reserved_qty), 0) AS reserved_qty,
          COALESCE(SUM(sb.qty), 0) - COALESCE(SUM(sb.reserved_qty), 0) AS available_qty
        FROM inv_items i
        LEFT JOIN inv_stock_balances sb
          ON sb.item_id = i.id
         AND ${stockWhere.join(" AND ")}
        WHERE ${whereItem}
        GROUP BY i.id, i.item_code, i.item_name
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Inventory Reports (minimal endpoints) ────────────────────────────────────
router.get(
  "/reports/health-monitor",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query?.warehouseId);
      const params = { companyId, branchId };
      const stockWhere = [
        "sb.company_id = :companyId",
        "sb.branch_id = :branchId",
      ];
      if (warehouseId) {
        stockWhere.push("sb.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(SUM(sb.qty), 0) AS available_qty,
          COALESCE(i.reorder_level, 0) AS reorder_level
        FROM inv_items i
        LEFT JOIN inv_stock_balances sb
          ON sb.item_id = i.id
         AND ${stockWhere.join(" AND ")}
        WHERE i.company_id = :companyId
        GROUP BY i.id, i.item_code, i.item_name, i.reorder_level
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);
      const items =
        (rows || []).map((r) => {
          const avail = Number(r.available_qty || 0);
          const reorder = Number(r.reorder_level || 0);
          let status = "OK";
          if (avail <= 0) status = "CRITICAL";
          else if (avail <= reorder) status = "LOW";
          return {
            ...r,
            days_of_cover: 0,
            status,
          };
        }) || [];
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/periodical-stock-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query?.warehouseId);
      const q = String(req.query?.q || "").trim();
      const params = { companyId, branchId };
      let where = "v.company_id = :companyId AND v.branch_id = :branchId";
      if (warehouseId) {
        where += " AND v.warehouse_id = :warehouseId";
        params.warehouseId = warehouseId;
      }
      if (q) {
        where += " AND (i.item_code LIKE :q OR i.item_name LIKE :q)";
        params.q = `%${q}%`;
      }
      const rows = await query(
        `
        SELECT 
          v.item_id,
          v.warehouse_id,
          i.item_code,
          i.item_name,
          v.opening_qty,
          0 AS receipts_qty,
          0 AS issues_qty,
          v.closing_qty
        FROM v_inv_stock_summary v
        LEFT JOIN inv_items i ON i.id = v.item_id
        WHERE ${where}
        ORDER BY i.item_name ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/periodical-stock-statement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query?.warehouseId);
      const q = String(req.query?.q || "").trim();
      const params = { companyId, branchId };
      let where = "v.company_id = :companyId AND v.branch_id = :branchId";
      if (warehouseId) {
        where += " AND v.warehouse_id = :warehouseId";
        params.warehouseId = warehouseId;
      }
      if (q) {
        where += " AND (i.item_code LIKE :q OR i.item_name LIKE :q)";
        params.q = `%${q}%`;
      }
      const rows = await query(
        `
        SELECT 
          v.item_id,
          v.warehouse_id,
          i.item_code,
          i.item_name,
          v.opening_qty,
          0 AS receipts_qty,
          0 AS issues_qty,
          v.closing_qty
        FROM v_inv_stock_summary v
        LEFT JOIN inv_items i ON i.id = v.item_id
        WHERE ${where}
        ORDER BY i.item_name ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/issue-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const departmentId = toNumber(req.query?.departmentId);
      const params = { companyId, branchId };
      const where = ["v.company_id = :companyId", "v.branch_id = :branchId"];
      if (from) {
        where.push("v.issue_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("v.issue_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("v.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      if (departmentId) {
        where.push("v.department_id = :departmentId");
        params.departmentId = departmentId;
      }
      const rows = await query(
        `
        SELECT 
          v.issue_id,
          v.issue_no,
          v.issue_date,
          v.issue_type,
          v.warehouse_id,
          v.department_id,
          v.item_id,
          v.qty_issued,
          v.uom,
          v.returned_qty,
          v.remaining_qty,
          i.item_code,
          i.item_name,
          d.dept_name AS department_name
        FROM v_inv_issue_register v
        LEFT JOIN inv_items i ON i.id = v.item_id
        LEFT JOIN hr_departments d ON d.id = v.department_id
        WHERE ${where.join(" AND ")}
        ORDER BY v.issue_date DESC, v.issue_id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/material-returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const departmentId = toNumber(req.query?.departmentId);
      const params = { companyId, branchId };
      const where = ["v.company_id = :companyId", "v.branch_id = :branchId"];
      if (from) {
        where.push("v.rts_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("v.rts_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("v.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      if (departmentId) {
        where.push("v.department_id = :departmentId");
        params.departmentId = departmentId;
      }
      const rows = await query(
        `
        SELECT 
          v.rts_id,
          v.rts_no,
          v.rts_date,
          v.status,
          v.warehouse_id,
          v.department_id,
          v.item_id,
          v.qty,
          v.uom,
          i.item_code,
          i.item_name
        FROM v_inv_material_returns v
        LEFT JOIN inv_items i ON i.id = v.item_id
        WHERE ${where.join(" AND ")}
        ORDER BY v.rts_date DESC, v.rts_id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `
        SELECT r.*
        FROM inv_material_requisitions r
        WHERE r.id = :id AND r.company_id = :companyId AND r.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Material requisition not found");
      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               i.uom,
               d.qty_requested,
               d.qty_issued
        FROM inv_material_requisition_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.requisition_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: rows[0], details });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Admin: Rebuild Reporting Objects ────────────────────────────────────────
router.post(
  "/admin/rebuild-reporting",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      await ensureMaterialRequisitionApprovalTrigger();
      res.json({ ok: true, message: "Reporting views and triggers rebuilt" });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Adjustments Report ────────────────────────────────────────────────
router.get(
  "/reports/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const params = { companyId, branchId };
      const where = ["a.company_id = :companyId", "a.branch_id = :branchId"];
      if (from) {
        where.push("a.adjustment_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("a.adjustment_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("a.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT
          a.id AS adjustment_id,
          a.adjustment_no,
          a.adjustment_date,
          a.status,
          a.remarks AS reason,
          a.warehouse_id,
          w.warehouse_name,
          d.item_id,
          d.qty,
          d.uom,
          d.batch_no,
          d.unit_price,
          i.item_code,
          i.item_name
        FROM inv_stock_adjustments a
        JOIN inv_stock_adjustment_details d ON d.adjustment_id = a.id
        LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        WHERE ${where.join(" AND ")}
        ORDER BY a.adjustment_date DESC, a.id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const requisitionNo =
        body.requisition_no && String(body.requisition_no).trim()
          ? String(body.requisition_no).trim()
          : await nextMaterialRequisitionNo(companyId, branchId);
      const requisitionDate = body.requisition_date;
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const requisitionType = body.requisition_type || "INTERNAL";
      const priority = body.priority || "MEDIUM";
      const requestedBy = body.requested_by || null;
      const remarks = body.remarks || null;
      const status = body.status || "DRAFT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!requisitionDate) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "requisition_date is required",
        );
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_material_requisitions
          (company_id, branch_id, requisition_no, requisition_date, warehouse_id, department_id, requisition_type, priority, requested_by, remarks, status, created_by)
        VALUES
          (:companyId, :branchId, :requisitionNo, :requisitionDate, :warehouseId, :departmentId, :requisitionType, :priority, :requestedBy, :remarks, :status, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          requisitionNo: requisitionNo || null,
          requisitionDate: toDateOnly(requisitionDate) || null,
          warehouseId: toNumber(warehouseId) || null,
          departmentId: toNumber(departmentId) || null,
          requisitionType:
            (requisitionType ? String(requisitionType).trim() : null) ||
            "INTERNAL",
          priority: (priority ? String(priority).trim() : null) || "MEDIUM",
          requestedBy: requestedBy ? String(requestedBy).trim() || null : null,
          remarks: remarks ? String(remarks).trim() || null : null,
          status: (status ? String(status).trim() : null) || "DRAFT",
          createdBy: createdBy || null,
        },
      );
      const requisitionId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        const batchNo = d.batch_no ? String(d.batch_no).trim() : null;
        const serialNo = d.serial_no ? String(d.serial_no).trim() : null;
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, batch_no, serial_no)
          VALUES (:requisitionId, :itemId, :qtyRequested, :qtyIssued, :batchNo, :serialNo)
          `,
          {
            requisitionId: requisitionId || null,
            itemId: itemId || null,
            qtyRequested: qtyRequested || 0,
            qtyIssued: qtyIssued || 0,
            batchNo: batchNo || null,
            serialNo: serialNo || null,
          },
        );
      }

      await conn.commit();
      res
        .status(201)
        .json({ id: requisitionId, requisition_no: requisitionNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const requisitionDate = body.requisition_date;
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const requisitionType = body.requisition_type || "INTERNAL";
      const priority = body.priority || "MEDIUM";
      const requestedBy = body.requested_by || null;
      const remarks = body.remarks || null;
      const status = body.status || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();

      const [upd] = await conn.execute(
        `
        UPDATE inv_material_requisitions
        SET requisition_date = :requisitionDate,
            warehouse_id = :warehouseId,
            department_id = :departmentId,
            requisition_type = :requisitionType,
            priority = :priority,
            requested_by = :requestedBy,
            remarks = :remarks,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          requisitionDate: toDateOnly(requisitionDate) || null,
          warehouseId: toNumber(warehouseId) || null,
          departmentId: toNumber(departmentId) || null,
          requisitionType:
            (requisitionType ? String(requisitionType).trim() : null) ||
            "INTERNAL",
          priority: (priority ? String(priority).trim() : null) || "MEDIUM",
          requestedBy: requestedBy ? String(requestedBy).trim() || null : null,
          remarks: remarks ? String(remarks).trim() || null : null,
          status: (status ? String(status).trim() : null) || "DRAFT",
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Material requisition not found");

      await conn.execute(
        `DELETE FROM inv_material_requisition_details WHERE requisition_id = :id`,
        { id: id || null },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        const batchNo = d.batch_no ? String(d.batch_no).trim() : null;
        const serialNo = d.serial_no ? String(d.serial_no).trim() : null;
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, batch_no, serial_no)
          VALUES (:id, :itemId, :qtyRequested, :qtyIssued, :batchNo, :serialNo)
          `,
          {
            id: id || null,
            itemId: itemId || null,
            qtyRequested: qtyRequested || 0,
            qtyIssued: qtyIssued || 0,
            batchNo: batchNo || null,
            serialNo: serialNo || null,
          },
        );
      }

      // Soft delete on cancel
      if (status === "CANCELLED") {
        try {
          if (!(await hasColumn("inv_material_requisitions", "is_active"))) {
            await conn.execute(
              "ALTER TABLE inv_material_requisitions ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
            );
          }
          if (!(await hasColumn("inv_material_requisitions", "deleted_at"))) {
            await conn.execute(
              "ALTER TABLE inv_material_requisitions ADD COLUMN deleted_at DATETIME NULL",
            );
          }
          await conn.execute(
            "UPDATE inv_material_requisitions SET is_active = 'N', deleted_at = NOW() WHERE id = :id",
            { id },
          );
        } catch {}
      }
      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/material-requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/material-requisitions";
      const wfByRoute = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND document_route = :docRouteBase
        ORDER BY id ASC
        `,
        { companyId: companyId || null, docRouteBase: docRouteBase || null },
      );
      const wfDefs = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
        ORDER BY id ASC
        `,
        { companyId: companyId || null },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
           LIMIT 1`,
          { wfId: workflowIdOverride || null, companyId: companyId || null },
        );
        if (wfRows.length && Number(wfRows[0].is_active) === 1) {
          activeWf = wfRows[0];
        }
      }
      if (!activeWf && wfByRoute.length) {
        for (const wf of wfByRoute) {
          if (Number(wf.is_active) !== 1) continue;
          if (amount === null) {
            activeWf = wf;
            break;
          }
          const minOk =
            wf.min_amount === null || Number(amount) >= Number(wf.min_amount);
          const maxOk =
            wf.max_amount === null || Number(amount) <= Number(wf.max_amount);
          if (minOk && maxOk) {
            activeWf = wf;
            break;
          }
        }
      }
      for (const wf of wfDefs) {
        if (activeWf) break;
        if (Number(wf.is_active) !== 1) continue;
        if (amount === null) {
          activeWf = wf;
          break;
        }
        const minOk =
          wf.min_amount === null || Number(amount) >= Number(wf.min_amount);
        const maxOk =
          wf.max_amount === null || Number(amount) <= Number(wf.max_amount);
        if (minOk && maxOk) {
          activeWf = wf;
          break;
        }
      }
      if (!activeWf) {
        await query(
          `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver_user_id configured",
        );
      }
      const allowedUsers = await query(
        `SELECT approver_user_id 
           FROM adm_workflow_step_approvers 
           WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );
      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      const dwRes = await query(
        `
          INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'MATERIAL_REQUISITION', :amount, :stepOrder, 'PENDING', :assignedTo)
          `,
        {
          companyId: companyId || null,
          workflowId: activeWf?.id || null,
          documentId: id || null,
          amount: amount === null ? null : Number(amount) || null,
          stepOrder: first?.step_order || null,
          assignedTo: assignedToUserId || null,
        },
      );
      const instanceId = dwRes.insertId;
      await query(
        `
          INSERT INTO adm_workflow_tasks
            (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
          VALUES
            (:companyId, :workflowId, :dwId, :documentId, 'MATERIAL_REQUISITION', :stepOrder, :assignedTo, 'PENDING')
          `,
        {
          companyId: companyId || null,
          workflowId: activeWf?.id || null,
          dwId: instanceId || null,
          documentId: id || null,
          stepOrder: first?.step_order || null,
          assignedTo: assignedToUserId || null,
        },
      );
      await query(
        `
          INSERT INTO adm_workflow_logs
            (document_workflow_id, step_order, action, actor_user_id, comments)
          VALUES
            (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
          `,
        {
          dwId: instanceId || null,
          stepOrder: first?.step_order || null,
          actor: req.user?.sub || null,
          comments: "",
        },
      );
      await query(
        `UPDATE inv_material_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
        { id: id || null, companyId: companyId || null },
      );
      const refRows = await query(
        `SELECT requisition_no FROM inv_material_requisitions WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id: id || null, companyId: companyId || null },
      );
      const docNo = refRows.length ? refRows[0].requisition_no : null;
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId: companyId || null,
          userId: assignedToUserId || null,
          title: "Approval Required",
          message: docNo
            ? `Material Requisition ${docNo} requires your approval`
            : `Material Requisition #${id} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      );
      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
      return;
      await query(
        `UPDATE inv_material_requisitions SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id: id || null, companyId: companyId || null },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grn/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureGRNTables();
      const { companyId, branchId } = req.scope;
      const { type } = req.query;
      const nextNo = await nextGRNNo(companyId, branchId, type || "LOCAL");
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-to-stores",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT r.id,
               r.rts_no,
               r.rts_date,
               r.warehouse_id,
               r.department_id,
               r.status,
               r.return_type,
               w.warehouse_name,
               d.dept_name AS department_name,
               (SELECT COUNT(*) 
                FROM inv_return_to_stores_details 
                WHERE rts_id = r.id) as item_count,
               dw.assigned_to_user_id,
               u.username as forwarded_to_username
        FROM inv_return_to_stores r
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN hr_departments d ON d.id = r.department_id
        LEFT JOIN adm_document_workflows dw 
          ON dw.document_id = r.id 
          AND dw.document_type = 'RETURN_TO_STORES'
          AND dw.status = 'PENDING'
        LEFT JOIN adm_users u ON u.id = dw.assigned_to_user_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        ORDER BY r.rts_date DESC, r.id DESC
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-to-stores/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const nextNo = await nextReturnNo(companyId, branchId);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock-transfers/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const { companyId } = req.scope;
      const nextNo = await nextTransferNo(companyId);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

// Item groups and categories (lookups for UI)
async function ensureItemGroupTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      group_code VARCHAR(50) NOT NULL,
      group_name VARCHAR(120) NOT NULL,
      parent_group_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_group_code (company_id, branch_id, group_code)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      category_code VARCHAR(50) NOT NULL,
      category_name VARCHAR(120) NOT NULL,
      parent_category_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cat_code (company_id, branch_id, category_code)
    )
  `).catch(() => {});
}

async function ensureItemBatchTables() {
  await query(
    `
    CREATE TABLE IF NOT EXISTS inv_item_batches (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      batch_no VARCHAR(50) NOT NULL,
      expiry_date DATE NULL,
      cost DECIMAL(18,4) NOT NULL DEFAULT 0,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_reserved DECIMAL(18,3) NOT NULL DEFAULT 0,
      source_type ENUM('GRN','DIRECT_PURCHASE','ADJUSTMENT','SALE') NOT NULL,
      source_id BIGINT UNSIGNED NULL,
      source_date DATE NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_company_batch (company_id, branch_id, item_id, batch_no),
      KEY idx_item (item_id),
      KEY idx_exp (expiry_date)
    )
  `,
  ).catch(() => {});
  await query(
    `
    CREATE TABLE IF NOT EXISTS inv_batch_movements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      batch_id BIGINT UNSIGNED NOT NULL,
      movement_type ENUM('IN','OUT') NOT NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      ref_type VARCHAR(40) NULL,
      ref_id BIGINT UNSIGNED NULL,
      ref_date DATE NULL,
      remarks VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch (batch_id),
      KEY idx_item (item_id)
    )
  `,
  ).catch(() => {});
}

// ─── Reporting Views ──────────────────────────────────────────────────────────
async function ensureReportingViews() {
  await query(`DROP VIEW IF EXISTS v_inv_stock_summary`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_stock_summary AS
    SELECT 
      sb.company_id,
      sb.branch_id,
      sb.warehouse_id,
      sb.item_id,
      COALESCE(sb.qty, 0) AS opening_qty,
      COALESCE(sb.qty, 0) AS closing_qty
    FROM inv_stock_balances sb
  `).catch(() => {});
  await query(`DROP VIEW IF EXISTS v_inv_issue_register`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_issue_register AS
    SELECT 
      i.company_id,
      i.branch_id,
      i.id AS issue_id,
      i.issue_no,
      i.issue_date,
      i.issue_type,
      i.warehouse_id,
      i.department_id,
      d.item_id,
      d.qty_issued,
      d.uom,
      COALESCE((
        SELECT SUM(rd.qty_returned)
        FROM inv_return_to_stores r
        JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
        WHERE r.company_id = i.company_id
          AND r.branch_id = i.branch_id
          AND rd.item_id = d.item_id
          AND (r.department_id <=> i.department_id)
          AND (r.warehouse_id <=> i.warehouse_id)
          AND r.rts_date >= i.issue_date
      ), 0) AS returned_qty,
      COALESCE(d.qty_issued, 0) - COALESCE((
        SELECT SUM(rd.qty_returned)
        FROM inv_return_to_stores r
        JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
        WHERE r.company_id = i.company_id
          AND r.branch_id = i.branch_id
          AND rd.item_id = d.item_id
          AND (r.department_id <=> i.department_id)
          AND (r.warehouse_id <=> i.warehouse_id)
          AND r.rts_date >= i.issue_date
      ), 0) AS remaining_qty
    FROM inv_issue_to_requirement i
    JOIN inv_issue_to_requirement_details d ON d.issue_id = i.id
  `).catch(() => {});
  await query(`DROP VIEW IF EXISTS v_inv_material_returns`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_material_returns AS
    SELECT
      r.company_id,
      r.branch_id,
      r.id AS rts_id,
      r.rts_no,
      r.rts_date,
      r.status,
      r.warehouse_id,
      r.department_id,
      d.item_id,
      d.qty,
      d.uom
    FROM inv_return_to_stores r
    JOIN inv_return_to_stores_details d ON d.rts_id = r.id
  `).catch(() => {});
}

async function upsertStockBalanceTx(
  conn,
  { companyId, branchId, warehouseId, itemId, deltaQty },
) {
  const [rows] = await conn.execute(
    `
    SELECT qty FROM inv_stock_balances 
     WHERE company_id = :companyId AND branch_id = :branchId
       AND warehouse_id = :warehouseId AND item_id = :itemId
     LIMIT 1
    `,
    {
      companyId: companyId || null,
      branchId: branchId || null,
      warehouseId: warehouseId || null,
      itemId: itemId || null,
    },
  );
  if (Array.isArray(rows) && rows.length) {
    await conn.execute(
      `
      UPDATE inv_stock_balances 
         SET qty = qty + :delta, updated_at = NOW()
       WHERE company_id = :companyId AND branch_id = :branchId
         AND warehouse_id = :warehouseId AND item_id = :itemId
      `,
      {
        delta: deltaQty || 0,
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: warehouseId || null,
        itemId: itemId || null,
      },
    );
  } else {
    await conn.execute(
      `
      INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
      VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
      `,
      {
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        qty: Math.max(0, deltaQty || 0),
      },
    );
  }
}

async function nextAdjustmentNo(companyId) {
  const rows = await query(
    `
    SELECT adjustment_no FROM inv_stock_adjustments
    WHERE company_id = :companyId AND adjustment_no LIKE 'ADJ-%'
    ORDER BY adjustment_no DESC
    LIMIT 1
    `,
    { companyId },
  ).catch(() => []);
  if (rows && rows.length) {
    const m = String(rows[0].adjustment_no || "").match(/^ADJ-(\d{6})$/);
    if (m) {
      const n = Number(m[1]) + 1;
      return `ADJ-${String(n).padStart(6, "0")}`;
    }
  }
  return "ADJ-000001";
}

async function allocateFromBatchesTx(
  conn,
  { companyId, branchId, warehouseId, itemId, qty, refType, refId, refDate },
) {
  let remaining = Number(qty || 0);
  if (!(remaining > 0)) return [];
  const [batches] = await conn.execute(
    `
    SELECT id, qty, cost FROM inv_item_batches
     WHERE company_id = :companyId AND branch_id = :branchId AND item_id = :itemId AND qty > 0
     ORDER BY COALESCE(expiry_date, '9999-12-31') ASC, COALESCE(source_date, '9999-12-31') ASC, id ASC
    `,
    {
      companyId: companyId || null,
      branchId: branchId || null,
      itemId: itemId || null,
    },
  );
  const allocations = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(b.qty), remaining);
    if (take <= 0) continue;
    await conn.execute(
      `UPDATE inv_item_batches SET qty = qty - :take WHERE id = :id`,
      { take: take || 0, id: b?.id || null },
    );
    await conn.execute(
      `
      INSERT INTO inv_batch_movements
        (company_id, branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, ref_date, remarks)
      VALUES
        (:companyId, :branchId, :itemId, :batchId, 'OUT', :qty, :refType, :refId, :refDate, 'FIFO consume')
      `,
      {
        companyId: companyId || null,
        branchId: branchId || null,
        itemId: itemId || null,
        batchId: b?.id || null,
        qty: take || 0,
        refType: refType || null,
        refId: refId || null,
        refDate: refDate || null,
      },
    );
    allocations.push({ batch_id: b.id, qty: take, unit_cost: b.cost });
    remaining -= take;
  }
  if (remaining > 0) {
    throw httpError(
      400,
      "INSUFFICIENT_STOCK",
      "Not enough batch quantity to allocate",
    );
  }
  await upsertStockBalanceTx(conn, {
    companyId: companyId || null,
    branchId: branchId || null,
    warehouseId: warehouseId || null,
    itemId: itemId || null,
    deltaQty: -(qty || 0),
  });
  return allocations;
}

router.get(
  "/stock-adjustments/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const nextNo = await nextAdjustmentNo(companyId);
      res.json({ next_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-adjustments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name
          FROM inv_stock_adjustments a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Adjustment not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name 
          FROM inv_stock_adjustment_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
         WHERE d.adjustment_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-adjustments/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [adj] = await query(
        `
        SELECT id, adjustment_no, status
        FROM inv_stock_adjustments
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!adj) throw httpError(404, "NOT_FOUND", "Adjustment not found");

      const existing = await query(
        `
        SELECT id
        FROM adm_document_workflows
        WHERE company_id = :companyId
          AND document_id = :id
          AND document_type IN ('STOCK_ADJUSTMENT', 'Stock Adjustment')
          AND status = 'PENDING'
        ORDER BY id DESC
        LIMIT 1
        `,
        { companyId, id },
      ).catch(() => []);
      if (existing.length) {
        return res.json({
          instanceId: existing[0].id,
          status: "PENDING_APPROVAL",
        });
      }

      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/stock-adjustments";

      const wfByRoute = await query(
        `SELECT * FROM adm_workflows
         WHERE company_id = :companyId
           AND document_route = :docRouteBase
           AND is_active = 1
         ORDER BY id ASC`,
        { companyId, docRouteBase },
      ).catch(() => []);

      const wfByTypeName = await query(
        `SELECT * FROM adm_workflows
         WHERE company_id = :companyId
           AND is_active = 1
           AND (document_type = 'STOCK_ADJUSTMENT' OR document_type = 'Stock Adjustment')
         ORDER BY id ASC`,
        { companyId },
      ).catch(() => []);

      let activeWf = null;
      if (workflowIdOverride) {
        const wfOverrideRows = await query(
          `SELECT * FROM adm_workflows
           WHERE id = :wfId AND company_id = :companyId AND is_active = 1
           LIMIT 1`,
          { wfId: workflowIdOverride, companyId },
        ).catch(() => []);
        if (wfOverrideRows.length) activeWf = wfOverrideRows[0];
      }

      const candidates = [...wfByRoute, ...wfByTypeName];
      for (const wf of candidates) {
        if (activeWf) break;
        if (Number(wf.is_active) !== 1) continue;
        if (amount === null || typeof amount === "undefined") {
          activeWf = wf;
          break;
        }
        const minOk =
          wf.min_amount == null || Number(amount) >= Number(wf.min_amount);
        const maxOk =
          wf.max_amount == null || Number(amount) <= Number(wf.max_amount);
        if (minOk && maxOk) {
          activeWf = wf;
          break;
        }
      }

      if (!activeWf) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }
      const first = steps[0];

      const allowedUsers = await query(
        `SELECT approver_user_id
         FROM adm_workflow_step_approvers
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      ).catch(() => []);
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );

      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = toNumber(first.approver_user_id) || null;
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (!assignedToUserId && allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      if (!assignedToUserId) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver configured",
        );
      }

      const dwRes = await query(
        `
        INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
        VALUES
          (:companyId, :workflowId, :documentId, 'STOCK_ADJUSTMENT', :amount, :stepOrder, 'PENDING', :assignedTo)
        `,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          amount: amount === null ? null : Number(amount) || null,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `
        INSERT INTO adm_workflow_tasks
          (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
        VALUES
          (:companyId, :workflowId, :dwId, :documentId, 'STOCK_ADJUSTMENT', :stepOrder, :assignedTo, 'PENDING')
        `,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      ).catch(() => {});

      await query(
        `
        INSERT INTO adm_workflow_logs
          (document_workflow_id, step_order, action, actor_user_id, comments)
        VALUES
          (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
        `,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user?.sub || null,
          comments: "",
        },
      ).catch(() => {});

      await query(
        `UPDATE inv_stock_adjustments
         SET status = 'PENDING_APPROVAL'
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId: assignedToUserId,
          title: "Approval Required",
          message: adj.adjustment_no
            ? `Stock Adjustment ${adj.adjustment_no} requires your approval`
            : `Stock Adjustment #${id} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      ).catch(() => {});

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const {
        adjustment_no,
        adjustment_date,
        warehouse_id,
        adjustment_type,
        reference_doc,
        reason,
        status,
        details,
      } = req.body || {};
      const adjNo = adjustment_no || (await nextAdjustmentNo(companyId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_adjustments
          (company_id, branch_id, warehouse_id, adjustment_no, adjustment_date, adjustment_type, reference_doc, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :adjNo, :adjDate, :adjustmentType, :referenceDoc, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          adjNo,
          adjDate: toDateOnly(adjustment_date || new Date()),
          adjustmentType: adjustment_type ? String(adjustment_type) : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks: reason ? String(reason) : null,
        },
      );
      const adjId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          const itemId = toNumber(r.item_id);
          const qty = Number(r.qty || 0);
          const unitCost = Number(r.unit_cost || 0);
          const uom = String(r.uom || "PCS");
          const currentStock = Number(r.current_stock || 0);
          const adjustedStock = Number(r.adjusted_stock || 0);
          await conn.execute(
            `
            INSERT INTO inv_stock_adjustment_details
              (adjustment_id, item_id, current_stock, adjusted_stock, qty, uom, unit_cost, unit_price, line_total, remarks)
            VALUES
              (:adjId, :itemId, :currentStock, :adjustedStock, :qty, :uom, :unitCost, :unitPrice, :lineTotal, :remarks)
            `,
            {
              adjId,
              itemId,
              currentStock,
              adjustedStock,
              qty,
              uom,
              unitCost,
              unitPrice: unitCost,
              lineTotal: unitCost * Math.abs(qty),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ id: adjId, adjustment_no: adjNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

// ─── Stock Updation Routes ────────────────────────────────────────────────────

router.get(
  "/stock-updation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT a.id, a.updation_no, a.updation_date, a.status,
               w.warehouse_name,
               COUNT(d.id) AS item_count,
               u.username AS forwarded_to_username
          FROM inv_stock_updations a
          LEFT JOIN inv_stock_updation_details d ON d.updation_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
              WHERE company_id = :companyId
                AND status = 'PENDING'
                AND (document_type = 'STOCK_UPDATION')
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.updation_date DESC, a.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-updation/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const nextNo = await nextUpdationNo(companyId, branchId);
      res.json({ next_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-updation/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name
          FROM inv_stock_updations a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Updation not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name 
          FROM inv_stock_updation_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
         WHERE d.updation_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-updation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId } = req.scope;
      const {
        updation_no,
        updation_date,
        warehouse_id,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};
      const upNo = updation_no || (await nextUpdationNo(companyId, branchId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_updations
          (company_id, branch_id, warehouse_id, updation_no, updation_date, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :upNo, :upDate, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          upNo,
          upDate: toDateOnly(updation_date || new Date()),
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks: remarks || reason ? String(remarks || reason) : null,
        },
      );
      const upId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_updation_details
              (updation_id, item_id, qty, uom, batch_no, unit_cost, remarks)
            VALUES
              (:upId, :itemId, :qty, :uom, :batchNo, :unitCost, :remarks)
            `,
            {
              upId,
              itemId: toNumber(r.item_id),
              qty: Number(r.qty || 0),
              uom: String(r.uom || "PCS"),
              batchNo: r.batch_no || null,
              unitCost: Number(r.unit_cost || 0),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ id: upId, updation_no: upNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-updation/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const { updation_date, warehouse_id, reason, details, remarks } =
        req.body || {};

      await conn.beginTransaction();
      await conn.execute(
        `
        UPDATE inv_stock_updations
        SET updation_date = :upDate,
            warehouse_id = :warehouseId,
            reason = :reason,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          upDate: toDateOnly(updation_date || new Date()),
          warehouse_id: toNumber(warehouse_id) || null,
          reason: reason ? String(reason) : null,
          remarks: remarks || null,
        },
      );

      if (Array.isArray(details)) {
        await conn.execute(
          `DELETE FROM inv_stock_updation_details WHERE updation_id = :id`,
          { id },
        );
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_updation_details
              (updation_id, item_id, qty, uom, batch_no, unit_cost, remarks)
            VALUES
              (:upId, :itemId, :qty, :uom, :batchNo, :unitCost, :remarks)
            `,
            {
              upId: id,
              itemId: toNumber(r.item_id),
              qty: Number(r.qty || 0),
              uom: String(r.uom || "PCS"),
              batchNo: r.batch_no || null,
              unitCost: Number(r.unit_cost || 0),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ success: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/stock-updation/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [upd] = await query(
        `SELECT id, updation_no FROM inv_stock_updations WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!upd) throw httpError(404, "NOT_FOUND", "Updation not found");

      // Workflow trigger logic... (simplified for now to match project style)
      // In this project, 'submit' usually finds an active workflow or just updates status.
      // We will follow the exact same logic as stock adjustments.

      const docType = "STOCK_UPDATION";
      const docRouteBase = "/inventory/stock-updation";

      const wfByRoute = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_route = :docRouteBase OR document_type = :docType) AND is_active = 1 ORDER BY id ASC`,
        { companyId, docRouteBase, docType },
      ).catch(() => []);

      let activeWf = wfByRoute[0] || null;

      if (!activeWf) {
        await query(
          `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];
      const assignedToUserId =
        toNumber(req.body?.target_user_id) || toNumber(first.approver_user_id);

      const dwRes = await query(
        `INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :workflowId, :documentId, :docType, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          docType,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `UPDATE inv_stock_updations SET status = 'PENDING_APPROVAL' WHERE id = :id`,
        { id },
      );

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Stock Verification Routes ────────────────────────────────────────────────

router.get(
  "/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT a.id, a.verification_no, a.verification_date, a.verification_type, a.status,
               w.warehouse_name,
               COUNT(d.id) AS item_count,
               u.username AS forwarded_to_username
          FROM inv_stock_verifications a
          LEFT JOIN inv_stock_verification_details d ON d.verification_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
              WHERE company_id = :companyId
                AND status = 'PENDING'
                AND (document_type = 'STOCK_VERIFICATION')
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.verification_date DESC, a.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-verification/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const nextNo = await nextVerificationNo(companyId, branchId);
      res.json({ verification_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-verification/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name
          FROM inv_stock_verifications a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Verification not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name 
          FROM inv_stock_verification_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
         WHERE d.verification_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId } = req.scope;
      const {
        verification_no,
        verification_date,
        start_date,
        end_date,
        warehouse_id,
        verification_type,
        reference_doc,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};
      const verNo =
        verification_no || (await nextVerificationNo(companyId, branchId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_verifications
          (company_id, branch_id, warehouse_id, verification_no, verification_date, start_date, end_date, verification_type, reference_doc, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :verNo, :verDate, :startDate, :endDate, :verificationType, :referenceDoc, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          verNo,
          verDate: toDateOnly(verification_date || new Date()),
          startDate: toDateOnly(start_date) || null,
          endDate: toDateOnly(end_date) || null,
          verificationType: verification_type
            ? String(verification_type)
            : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks:
            remarks != null
              ? String(remarks)
              : reason != null
                ? String(reason)
                : null,
        },
      );
      const verId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_verification_details
              (verification_id, item_id, system_qty, counted_qty, variance_qty, uom, remarks)
            VALUES
              (:verId, :itemId, :systemQty, :countedQty, :varianceQty, :uom, :remarks)
            `,
            {
              verId,
              itemId: toNumber(r.item_id),
              systemQty: Number(r.system_qty || 0),
              countedQty: Number(r.counted_qty || 0),
              varianceQty:
                r.variance_qty != null
                  ? Number(r.variance_qty || 0)
                  : Number(r.counted_qty || 0) - Number(r.system_qty || 0),
              uom: String(r.uom || "PCS"),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ id: verId, verification_no: verNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-verification/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const {
        verification_date,
        start_date,
        end_date,
        warehouse_id,
        verification_type,
        reference_doc,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};

      await conn.beginTransaction();
      await conn.execute(
        `
        UPDATE inv_stock_verifications
        SET verification_date = :verDate,
            start_date = :startDate,
            end_date = :endDate,
            warehouse_id = :warehouseId,
            verification_type = :verificationType,
            reference_doc = :referenceDoc,
            reason = :reason,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          verDate: toDateOnly(verification_date || new Date()),
          startDate: toDateOnly(start_date) || null,
          endDate: toDateOnly(end_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          verificationType: verification_type
            ? String(verification_type)
            : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks:
            remarks != null
              ? String(remarks)
              : reason != null
                ? String(reason)
                : null,
        },
      );

      if (Array.isArray(details)) {
        await conn.execute(
          `DELETE FROM inv_stock_verification_details WHERE verification_id = :id`,
          { id },
        );
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_verification_details
              (verification_id, item_id, system_qty, verified_qty, variance_qty, uom, remarks)
            VALUES
              (:verId, :itemId, :systemQty, :verifiedQty, :varianceQty, :uom, :remarks)
            `,
            {
              verId: id,
              itemId: toNumber(r.item_id),
              systemQty: Number(r.system_qty || 0),
              verifiedQty: Number(r.verified_qty || 0),
              varianceQty:
                r.variance_qty != null
                  ? Number(r.variance_qty || 0)
                  : Number(r.verified_qty || 0) - Number(r.system_qty || 0),
              uom: String(r.uom || "PCS"),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ success: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/stock-verification/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [ver] = await query(
        `SELECT id, verification_no FROM inv_stock_verifications WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!ver) throw httpError(404, "NOT_FOUND", "Verification not found");

      const docType = "STOCK_VERIFICATION";
      const docRouteBase = "/inventory/stock-verification";

      const wfByRoute = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_route = :docRouteBase OR document_type = :docType) AND is_active = 1 ORDER BY id ASC`,
        { companyId, docRouteBase, docType },
      ).catch(() => []);

      let activeWf = wfByRoute[0] || null;

      if (!activeWf) {
        await query(
          `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];
      const assignedToUserId =
        toNumber(req.body?.target_user_id) || toNumber(first.approver_user_id);

      const dwRes = await query(
        `INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :workflowId, :documentId, :docType, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          docType,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `UPDATE inv_stock_verifications SET status = 'PENDING_APPROVAL' WHERE id = :id`,
        { id },
      );

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

// Batches list and allocation
router.get(
  "/batches",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { item_id, batch_no, expiry_from, expiry_to } = req.query || {};
      const whereParts = [
        "b.company_id = :companyId",
        "b.branch_id = :branchId",
      ];
      const params = { companyId, branchId };
      if (item_id) {
        whereParts.push("b.item_id = :itemId");
        params.itemId = Number(item_id);
      }
      if (batch_no) {
        whereParts.push("b.batch_no LIKE :batch");
        params.batch = `%${batch_no}%`;
      }
      if (expiry_from) {
        whereParts.push("b.expiry_date >= :expFrom");
        params.expFrom = expiry_from;
      }
      if (expiry_to) {
        whereParts.push("b.expiry_date <= :expTo");
        params.expTo = expiry_to;
      }
      const rows = await query(
        `
        SELECT b.*
          FROM v_active_stock_details b
         WHERE ${whereParts.join(" AND ")}
         ORDER BY COALESCE(b.expiry_date,'9999-12-31') ASC, b.id ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/batch-options",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const itemId = toNumber(req.query.item_id);
      const warehouseId = toNumber(req.query.warehouse_id);
      if (!itemId || !warehouseId) return res.json({ items: [] });

      const rows = await query(
        `
        SELECT batch_no,
               COALESCE(SUM(qty), 0) AS qty,
               COALESCE(SUM(reserved_qty), 0) AS reserved_qty,
               MIN(expiry_date) AS expiry_date
          FROM inv_stock_balances
         WHERE company_id = :companyId
           AND item_id = :itemId
           AND warehouse_id = :warehouseId
           AND batch_no IS NOT NULL
           AND batch_no <> ''
         GROUP BY batch_no
         ORDER BY COALESCE(MIN(expiry_date), '9999-12-31') ASC, batch_no ASC
        `,
        { companyId, itemId, warehouseId },
      );

      const items =
        (rows || []).map((r) => {
          const qty = Number(r.qty || 0);
          const reserved = Number(r.reserved_qty || 0);
          const available = qty - reserved;
          return {
            batch_no: r.batch_no,
            expiry_date: r.expiry_date || null,
            qty,
            reserved_qty: reserved,
            available_qty: available,
            available_qty_clamped: Math.max(0, available),
          };
        }) || [];

      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/batches/allocate-out",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureItemBatchTables();
      const { companyId, branchId } = req.scope;
      const { item_id, qty, ref_type, ref_id, ref_date, warehouse_id } =
        req.body || {};
      if (!item_id || !qty)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_id and qty are required",
        );
      await conn.beginTransaction();
      const allocations = await allocateFromBatchesTx(conn, {
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: toNumber(warehouse_id) || null,
        itemId: Number(item_id) || null,
        qty: Number(qty) || 0,
        refType: ref_type ? String(ref_type).trim() || null : null,
        refId: toNumber(ref_id) || null,
        refDate: toDateOnly(ref_date || new Date()) || null,
      });
      await conn.commit();
      res.json({ allocations });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);
router.get(
  "/item-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT g.id, g.group_code, g.group_name, g.parent_group_id,
               CASE WHEN g.is_active = 1 THEN 1 ELSE 0 END AS is_active,
               p.group_name AS parent_group_name
          FROM inv_item_groups g
          LEFT JOIN inv_item_groups p ON p.id = g.parent_group_id
         WHERE g.company_id = :companyId AND g.branch_id = :branchId
         ORDER BY g.group_name ASC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Expiry monitor: runs periodically to push notifications ──────────────────
let __batchExpiryMonitorStarted = false;
async function runBatchExpiryMonitorOnce() {
  try {
    const soon = await query(
      `
      SELECT b.*, i.item_name
        FROM inv_item_batches b
        LEFT JOIN inv_items i ON i.id = b.item_id
       WHERE b.qty > 0
         AND b.expiry_date IS NOT NULL
         AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      `,
    );
    if (!soon || !soon.length) return;
    const users = await query(
      `
      SELECT id, email, username, full_name FROM adm_users WHERE is_active = 1
      `,
    ).catch(() => []);
    for (const row of soon) {
      const message = `Batch ${row.batch_no} of ${row.item_name} expires on ${row.expiry_date} • Qty: ${row.qty}`;
      if (users && users.length) {
        for (const u of users) {
          await query(
            `
            INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
            VALUES (:companyId, :userId, :title, :message, :link, 0)
            `,
            {
              companyId: row.company_id,
              userId: u.id,
              title: "Batch Expiry Reminder",
              message,
              link: "/inventory/batches",
            },
          ).catch(() => {});
          try {
            if (
              isMailerConfigured() &&
              u.email &&
              /\S+@\S+\.\S+/.test(u.email)
            ) {
              await sendMail({
                to: u.email,
                subject: "Batch Expiry Reminder",
                text: message,
                html: `<p>${message}</p>`,
              });
            }
          } catch {}
        }
      } else {
        await query(
          `
          INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
          VALUES (:companyId, NULL, :title, :message, :link, 0)
          `,
          {
            companyId: row.company_id,
            title: "Batch Expiry Reminder",
            message,
            link: "/inventory/batches",
          },
        ).catch(() => {});
      }
    }
  } catch {}
}
function startBatchExpiryMonitor() {
  if (__batchExpiryMonitorStarted) return;
  __batchExpiryMonitorStarted = true;
  setInterval(runBatchExpiryMonitorOnce, 6 * 60 * 60 * 1000); // every 6 hours
  // kick off one run soon after startup
  setTimeout(runBatchExpiryMonitorOnce, 30 * 1000);
}
startBatchExpiryMonitor();

router.get(
  "/item-categories",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT c.id, c.category_code, c.category_name, c.parent_category_id,
               CASE WHEN c.is_active = 1 THEN 1 ELSE 0 END AS is_active,
               p.category_name AS parent_category_name
          FROM inv_item_categories c
          LEFT JOIN inv_item_categories p ON p.id = c.parent_category_id
         WHERE c.company_id = :companyId AND c.branch_id = :branchId
         ORDER BY c.category_name ASC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Stock adjustments (shared by multiple screens)
async function ensureStockAdjustmentTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      adjustment_no VARCHAR(50) NOT NULL,
      adjustment_date DATE NOT NULL,
      adjustment_type VARCHAR(30) NULL,
      reference_doc VARCHAR(100) NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_adj_no (company_id, branch_id, adjustment_no)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustment_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      adjustment_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      current_stock DECIMAL(18,3) DEFAULT 0,
      adjusted_stock DECIMAL(18,3) DEFAULT 0,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_no VARCHAR(100),
      unit_cost DECIMAL(18,4) DEFAULT 0,
      unit_price DECIMAL(18,4) DEFAULT 0,
      line_total DECIMAL(18,4) DEFAULT 0,
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_adj (adjustment_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});

  if (!(await hasColumn("inv_stock_adjustments", "warehouse_id"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "adjustment_type"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN adjustment_type VARCHAR(30) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "reference_doc"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN reference_doc VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "reason"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN reason TEXT NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "remarks"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN remarks TEXT`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "current_stock"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN current_stock DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "adjusted_stock"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN adjusted_stock DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "uom"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN uom VARCHAR(20) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "remarks"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN remarks VARCHAR(255) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "batch_no"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN batch_no VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "unit_cost"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN unit_cost DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "unit_price"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN unit_price DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "line_total"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN line_total DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
}

async function ensureStockUpdationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_updations (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      updation_no VARCHAR(50) NOT NULL,
      updation_date DATE NOT NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_upd_no (company_id, branch_id, updation_no)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_updation_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      updation_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_no VARCHAR(100),
      unit_cost DECIMAL(18,4) DEFAULT 0,
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_upd (updation_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});
}

async function nextUpdationNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT updation_no
    FROM inv_stock_updations
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND updation_no LIKE 'UPD-%'
    ORDER BY CAST(SUBSTRING(updation_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].updation_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `UPD-${String(nextNum).padStart(6, "0")}`;
}

async function ensureStockVerificationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_verifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      verification_no VARCHAR(50) NOT NULL,
      verification_date DATE NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      verification_type VARCHAR(30) NULL,
      reference_doc VARCHAR(100) NULL,
      reason TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ver_no (company_id, branch_id, verification_no),
      KEY idx_ver_wh (warehouse_id)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_verification_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      verification_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      system_qty DECIMAL(18,3) DEFAULT 0,
      counted_qty DECIMAL(18,3) DEFAULT 0,
      variance_qty DECIMAL(18,3) DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_ver (verification_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});

  if (!(await hasColumn("inv_stock_verifications", "start_date"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN start_date DATE NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "end_date"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN end_date DATE NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "verification_type"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN verification_type VARCHAR(30) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "reference_doc"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN reference_doc VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "status"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "system_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN system_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "counted_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN counted_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "variance_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN variance_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "uom"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN uom VARCHAR(20) NULL`,
    ).catch(() => {});
  }
}

async function nextVerificationNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT verification_no
    FROM inv_stock_verifications
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND verification_no LIKE 'SV-%'
    ORDER BY CAST(SUBSTRING(verification_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].verification_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `SV-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT a.id, a.adjustment_no, a.adjustment_date, a.status,
               MAX(a.adjustment_type) AS adjustment_type,
               MAX(w.warehouse_name) AS warehouse_name,
               COUNT(d.id) AS item_count,
               u.username AS forwarded_to_username
          FROM inv_stock_adjustments a
          LEFT JOIN inv_stock_adjustment_details d ON d.adjustment_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
              WHERE company_id = :companyId
                AND status = 'PENDING'
                AND (document_type IN ('STOCK_ADJUSTMENT','Stock Adjustment'))
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.adjustment_date DESC, a.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Stock transfers list
router.get(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT t.id, t.transfer_no, t.transfer_date, t.status,
               t.from_branch_id, t.to_branch_id,
               t.from_warehouse_id, t.to_warehouse_id,
               fb.name AS from_branch,
               tb.name AS to_branch,
               fw.warehouse_name AS from_warehouse,
               tw.warehouse_name AS to_warehouse,
               COUNT(d.id) AS item_count
          FROM inv_stock_transfers t
          LEFT JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
          LEFT JOIN adm_branches fb ON fb.id = t.from_branch_id
          LEFT JOIN adm_branches tb ON tb.id = t.to_branch_id
          LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
          LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
         WHERE t.company_id = :companyId AND t.branch_id = :branchId
         GROUP BY t.id
         ORDER BY t.transfer_date DESC, t.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Get available stock for a specific item and warehouse
router.get(
  "/stock/balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const itemId = toNumber(req.query.item_id);
      const warehouseId = toNumber(req.query.warehouse_id);
      const batchNo = req.query.batch_no ? String(req.query.batch_no) : null;

      if (!itemId || !warehouseId) {
        return res.json({
          available: 0,
          available_clamped: 0,
          qty: 0,
          reserved: 0,
        });
      }

      const rows = await query(
        `
        SELECT COALESCE(SUM(qty), 0) AS qty,
               COALESCE(SUM(reserved_qty), 0) AS reserved_qty
          FROM inv_stock_balances
         WHERE company_id = :companyId
           AND item_id = :itemId
           AND warehouse_id = :warehouseId
           AND (:batchNo IS NULL OR batch_no = :batchNo)
        `,
        { companyId, itemId, warehouseId, batchNo },
      );

      if (!rows || rows.length === 0) {
        return res.json({
          available: 0,
          available_clamped: 0,
          qty: 0,
          reserved: 0,
        });
      }

      const qty = Number(rows[0].qty || 0);
      const reserved = Number(rows[0].reserved_qty || 0);
      const available = qty - reserved;
      res.json({
        qty,
        reserved,
        available,
        available_clamped: Math.max(0, available),
      });
    } catch (e) {
      next(e);
    }
  },
);

// ─── GRN alias endpoints for Inventory module UI ──────────────────────────────
router.get(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const grnType = String(req.query?.grn_type || "").toUpperCase() || null;
      let where = "WHERE g.company_id = :companyId AND g.branch_id = :branchId";
      const params = { companyId, branchId };
      if (grnType) {
        where += " AND g.grn_type = :grnType";
        params.grnType = grnType;
      }
      const rows = await query(
        `
        SELECT g.id, g.grn_no, g.grn_date, g.grn_type, g.status,
               s.supplier_name, w.warehouse_name,
               u.username AS forwarded_to_username
          FROM inv_goods_receipt_notes g
          LEFT JOIN pur_suppliers s ON s.id = g.supplier_id
          LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
              FROM adm_document_workflows t
              JOIN (
                SELECT document_id, MAX(id) AS max_id
                  FROM adm_document_workflows
                 WHERE company_id = :companyId
                   AND status = 'PENDING'
                   AND (document_type IN ('GRN','GOODS_RECEIPT','GOODS_RECEIPT_NOTE'))
                 GROUP BY document_id
              ) m ON m.max_id = t.id
          ) x ON x.document_id = g.id
          LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         ${where}
         ORDER BY g.grn_date DESC, g.id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT g.*, s.supplier_name, w.warehouse_name
          FROM inv_goods_receipt_notes g
          LEFT JOIN pur_suppliers s ON s.id = g.supplier_id
          LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
         WHERE g.id = :id AND g.company_id = :companyId AND g.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "GRN not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name
          FROM inv_goods_receipt_note_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
         WHERE d.grn_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: { ...hdr, details: details || [] } });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grn/:id/cancel-accounting",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await query(
        `UPDATE inv_goods_receipt_notes SET status = 'CANCELLED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Issue to Requirement Area ────────────────────────────────────────────────
async function ensureIssueToRequirementTables() {
  // Tables should already exist, but ensure they do for safety
  await query(`
    CREATE TABLE IF NOT EXISTS inv_issue_to_requirement (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      issue_no VARCHAR(50) NOT NULL,
      issue_date DATE NOT NULL,
      warehouse_id BIGINT UNSIGNED DEFAULT NULL,
      issued_to VARCHAR(255) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(500) DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      department_id BIGINT UNSIGNED DEFAULT NULL,
      issue_type VARCHAR(50) DEFAULT 'GENERAL',
      requisition_id BIGINT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_issue_scope_no (company_id, branch_id, issue_no),
      KEY idx_issue_scope (company_id, branch_id),
      KEY fk_issue_warehouse (warehouse_id),
      KEY fk_issue_created_by (created_by),
      CONSTRAINT fk_issue_company FOREIGN KEY (company_id) REFERENCES adm_companies (id),
      CONSTRAINT fk_issue_branch FOREIGN KEY (branch_id) REFERENCES adm_branches (id),
      CONSTRAINT fk_issue_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses (id),
      CONSTRAINT fk_issue_created_by FOREIGN KEY (created_by) REFERENCES adm_users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_issue_to_requirement_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      issue_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_issued DECIMAL(18,3) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_number VARCHAR(100) DEFAULT NULL,
      serial_number VARCHAR(100) DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_issued_issue (issue_id),
      KEY fk_issued_item (item_id),
      CONSTRAINT fk_issued_issue FOREIGN KEY (issue_id) REFERENCES inv_issue_to_requirement (id) ON DELETE CASCADE,
      CONSTRAINT fk_issued_item FOREIGN KEY (item_id) REFERENCES inv_items (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
}

async function nextIssueNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT issue_no
    FROM inv_issue_to_requirement
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND issue_no LIKE 'ISS-%'
    ORDER BY CAST(SUBSTRING(issue_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].issue_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `ISS-${String(nextNum).padStart(6, "0")}`;
}

// GET list of issues
router.get(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.issued_to,
               i.department_id, i.status, i.remarks, i.issue_type,
               i.requisition_id, i.created_by, i.created_at, i.updated_at,
               w.warehouse_name, d.dept_name AS department_name, u.username AS created_by_username
        FROM inv_issue_to_requirement i
        LEFT JOIN inv_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN hr_departments d ON d.id = i.department_id
        LEFT JOIN adm_users u ON u.id = i.created_by
        WHERE i.company_id = :companyId AND i.branch_id = :branchId
        ORDER BY i.issue_date DESC, i.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// GET single issue
router.get(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      await ensureIssueToRequirementTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [hdr] = await query(
        `
        SELECT i.*, w.warehouse_name, d.dept_name AS department_name, u.username AS created_by_username
        FROM inv_issue_to_requirement i
        LEFT JOIN inv_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN hr_departments d ON d.id = i.department_id
        LEFT JOIN adm_users u ON u.id = i.created_by
        WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Issue not found");

      const details = await query(
        `
        SELECT 
          d.*, 
          iv.item_code, 
          iv.item_name, 
          iv.uom as item_uom,
          v.returned_qty,
          v.remaining_qty
        FROM inv_issue_to_requirement_details d
        LEFT JOIN inv_items iv ON iv.id = d.item_id
        LEFT JOIN v_inv_issue_register v 
          ON v.issue_id = :id AND v.item_id = d.item_id
        WHERE d.issue_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

// POST create new issue
router.post(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId, userId } = req.scope;
      const {
        issue_date,
        warehouse_id,
        issued_to,
        department_id,
        issue_type,
        requisition_id,
        status,
        remarks,
        details = [],
      } = req.body;

      // Validate required fields
      if (!issue_date)
        throw httpError(400, "VALIDATION_ERROR", "issue_date is required");
      if (!Array.isArray(details))
        throw httpError(400, "VALIDATION_ERROR", "details must be an array");

      // Generate issue number
      const issueNo = await nextIssueNo(companyId, branchId);

      // Insert header
      const result = await query(
        `
        INSERT INTO inv_issue_to_requirement
        (company_id, branch_id, issue_no, issue_date, warehouse_id, issued_to,
         department_id, issue_type, requisition_id, status, remarks, created_by)
        VALUES (:companyId, :branchId, :issueNo, :issueDate, :warehouseId, :issuedTo,
                :departmentId, :issueType, :requisitionId, :status, :remarks, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          issueNo: issueNo || null,
          issueDate: toDateOnly(issue_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          issuedTo: issued_to ? String(issued_to).trim() || null : null,
          departmentId: toNumber(department_id) || null,
          issueType:
            (issue_type ? String(issue_type).trim() : null) || "GENERAL",
          requisitionId: toNumber(requisition_id) || null,
          status: (status ? String(status).trim() : null) || "DRAFT",
          remarks: remarks ? String(remarks).trim() || null : null,
          createdBy: userId || null,
        },
      );

      const issueId = result.insertId;

      // Insert details
      for (const line of details) {
        if (line.item_id && Number(line.qty_issued || 0) > 0) {
          await query(
            `
            INSERT INTO inv_issue_to_requirement_details
            (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
            VALUES (:issueId, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
            `,
            {
              issueId: issueId || null,
              itemId: toNumber(line.item_id) || null,
              qtyIssued: Number(line.qty_issued || 0) || 0,
              uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
              batchNumber: line.batch_number
                ? String(line.batch_number).trim() || null
                : null,
              serialNumber: line.serial_number
                ? String(line.serial_number).trim() || null
                : null,
            },
          );
        }
      }

      res.status(201).json({ id: issueId, issue_no: issueNo });
    } catch (e) {
      next(e);
    }
  },
);

// PUT update issue
router.put(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const {
        issue_date,
        warehouse_id,
        issued_to,
        department_id,
        issue_type,
        requisition_id,
        status,
        remarks,
        details = [],
      } = req.body;

      // Check if issue exists
      const [existing] = await query(
        `
        SELECT id FROM inv_issue_to_requirement
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");

      // Update header
      await query(
        `
        UPDATE inv_issue_to_requirement
        SET issue_date = :issueDate, warehouse_id = :warehouseId, issued_to = :issuedTo,
            department_id = :departmentId, issue_type = :issueType,
            requisition_id = :requisitionId, status = :status, remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          issueDate: toDateOnly(issue_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          issuedTo: issued_to ? String(issued_to).trim() || null : null,
          departmentId: toNumber(department_id) || null,
          issueType:
            (issue_type ? String(issue_type).trim() : null) || "GENERAL",
          requisitionId: toNumber(requisition_id) || null,
          status: (status ? String(status).trim() : null) || "DRAFT",
          remarks: remarks ? String(remarks).trim() || null : null,
        },
      );

      // Delete existing details
      await query(
        `DELETE FROM inv_issue_to_requirement_details WHERE issue_id = :id`,
        { id: id || null },
      );

      // Insert new details
      for (const line of details) {
        if (line.item_id && Number(line.qty_issued || 0) > 0) {
          await query(
            `
            INSERT INTO inv_issue_to_requirement_details
            (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
            VALUES (:issueId, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
            `,
            {
              issueId: id || null,
              itemId: toNumber(line.item_id) || null,
              qtyIssued: Number(line.qty_issued || 0) || 0,
              uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
              batchNumber: line.batch_number
                ? String(line.batch_number).trim() || null
                : null,
              serialNumber: line.serial_number
                ? String(line.serial_number).trim() || null
                : null,
            },
          );
        }
      }

      res.json({ id, ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// DELETE issue
router.delete(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      // Check if issue exists
      const [existing] = await query(
        `
        SELECT id FROM inv_issue_to_requirement
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");

      // Delete details first (cascade delete should handle this, but explicit is safer)
      await query(
        `DELETE FROM inv_issue_to_requirement_details WHERE issue_id = :id`,
        { id },
      );

      // Delete header
      await query(
        `
        DELETE FROM inv_issue_to_requirement
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId },
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// Return to Stores endpoints
router.get(
  "/return-to-stores/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT r.*, w.warehouse_name, d.dept_name AS department_name
        FROM inv_return_to_stores r
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN hr_departments d ON d.id = r.department_id
        WHERE r.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Return not found");
      const details = await query(
        `
        SELECT d.id, d.rts_id, d.item_id, d.qty_returned, d.uom, d.reason, d.\`condition\`, d.batch_serial, d.location, d.remarks, i.item_code, i.item_name
        FROM inv_return_to_stores_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.rts_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/return-to-stores",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const rtsNo = body.rts_no || (await nextReturnNo(companyId, branchId));
      const rtsDate = toDateOnly(body.rts_date || new Date()) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const departmentId = toNumber(body.department_id) || null;
      const issueId = toNumber(body.issue_id) || null;
      const requisitionId = toNumber(body.requisition_id) || null;
      const returnType = body.return_type || "EXCESS";
      const remarks = body.remarks || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `
        INSERT INTO inv_return_to_stores
        (company_id, branch_id, rts_no, rts_date, warehouse_id, department_id, status, issue_id, requisition_id, return_type, remarks)
        VALUES (:companyId, :branchId, :rtsNo, :rtsDate, :warehouseId, :departmentId, :status, :issueId, :requisitionId, :returnType, :remarks)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          rtsNo: rtsNo || null,
          rtsDate: rtsDate || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          status: status || "DRAFT",
          issueId: issueId || null,
          requisitionId: requisitionId || null,
          returnType: returnType || "EXCESS",
          remarks: remarks || null,
        },
      );
      const rtsId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || line.qty_returned || 0);
        const remainingQty = Number(line.remaining_qty || 0);
        const qtyIssued = Number(line.qty_issued || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details
          (rts_id, item_id, qty_returned, uom, remaining_qty, qty_issued, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:rtsId, :itemId, :qty, :uom, :remainingQty, :qtyIssued, :reason, :condition, :batchSerial, :location, :lineRemarks)
          `,
          {
            rtsId: rtsId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            remainingQty: remainingQty || null,
            qtyIssued: qtyIssued || null,
            reason: line.reason || null,
            condition: line.condition || "GOOD",
            batchSerial: line.batch_serial || null,
            location: line.location || null,
            lineRemarks: line.remarks || null,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: rtsId, rts_no: rtsNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/return-to-stores/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const rtsDate = toDateOnly(body.rts_date) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const departmentId = toNumber(body.department_id) || null;
      const issueId = toNumber(body.issue_id) || null;
      const requisitionId = toNumber(body.requisition_id) || null;
      const returnType = body.return_type || "EXCESS";
      const remarks = body.remarks || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_return_to_stores
        SET rts_date = :rtsDate, warehouse_id = :warehouseId, department_id = :departmentId, status = :status, issue_id = :issueId, requisition_id = :requisitionId, return_type = :returnType, remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          rtsDate: rtsDate || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          status: status || "DRAFT",
          issueId: issueId || null,
          requisitionId: requisitionId || null,
          returnType: returnType || "EXCESS",
          remarks: remarks || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Return not found");

      await conn.execute(
        `DELETE FROM inv_return_to_stores_details WHERE rts_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || line.qty_returned || 0);
        const remainingQty = Number(line.remaining_qty || 0);
        const qtyIssued = Number(line.qty_issued || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details
          (rts_id, item_id, qty_returned, uom, remaining_qty, qty_issued, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:rtsId, :itemId, :qty, :uom, :remainingQty, :qtyIssued, :reason, :condition, :batchSerial, :location, :lineRemarks)
          `,
          {
            rtsId: id || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            remainingQty: remainingQty || null,
            qtyIssued: qtyIssued || null,
            reason: line.reason || null,
            condition: line.condition || "GOOD",
            batchSerial: line.batch_serial || null,
            location: line.location || null,
            lineRemarks: line.remarks || null,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/return-to-stores/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/return-to-stores";

      // Initialize workflow
      const wfByRoute = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND document_route = :docRouteBase AND is_active = 1 LIMIT 1`,
        { companyId, docRouteBase },
      );

      const wfByTypeName = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_type = 'RETURN_TO_STORES' OR document_type = 'Return to Stores') AND is_active = 1 LIMIT 1`,
        { companyId },
      );

      let activeWf = null;
      if (workflowIdOverride) {
        const wfOverrideRows = await query(
          `SELECT * FROM adm_workflows WHERE id = :wfId AND is_active = 1 LIMIT 1`,
          { wfId: workflowIdOverride },
        );
        if (wfOverrideRows.length) activeWf = wfOverrideRows[0];
      }

      if (!activeWf) {
        activeWf = wfByRoute.length
          ? wfByRoute[0]
          : wfByTypeName.length
            ? wfByTypeName[0]
            : null;
      }

      if (!activeWf) {
        // Fallback: If no workflow, just approve it? No, usually we want a workflow.
        // But for consistency with other modules, let's see.
        // If no workflow is found, we might just set it to APPROVED immediately if that's the intended behavior for "no workflow".
        // However, standard app behavior seems to be requiring a workflow or failing.
        // Let's just set status to SUBMITTED if no workflow is configed.
        await query(
          `UPDATE inv_return_to_stores SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        return res.json({ status: "SUBMITTED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );

      if (!steps.length) {
        await query(
          `UPDATE inv_return_to_stores SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        return res.json({ status: "SUBMITTED" });
      }

      const first = steps[0];
      const targetUserId =
        toNumber(req.body?.target_user_id) || first.approver_user_id;

      await query(
        `INSERT INTO adm_document_workflows 
         (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :wfId, :docId, 'RETURN_TO_STORES', 0, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          wfId: activeWf.id,
          docId: id,
          stepOrder: first.step_order,
          assignedTo: targetUserId,
        },
      );

      const workflowInstanceId = (
        await query("SELECT LAST_INSERT_ID() AS id")
      )[0].id;

      await query(
        `INSERT INTO adm_workflow_tasks 
         (document_workflow_id, step_order, assigned_to_user_id, status, action)
         VALUES (:dwId, :stepOrder, :assignedTo, 'PENDING', 'PENDING')`,
        {
          dwId: workflowInstanceId,
          stepOrder: first.step_order,
          assignedTo: targetUserId,
        },
      );

      await query(
        `UPDATE inv_return_to_stores SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      res.json({ status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/return-to-stores/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      const { status } = req.body;
      if (!id || !status)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id or status");

      await query(
        `UPDATE inv_return_to_stores SET status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, status, companyId, branchId },
      );

      res.json({ success: true, status });
    } catch (err) {
      next(err);
    }
  },
);

// Stock Transfer endpoints
router.get(
  "/stock-transfers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT t.*, fb.name AS from_branch, tb.name AS to_branch,
               fw.warehouse_name AS from_warehouse, tw.warehouse_name AS to_warehouse
        FROM inv_stock_transfers t
        LEFT JOIN adm_branches fb ON fb.id = t.from_branch_id
        LEFT JOIN adm_branches tb ON tb.id = t.to_branch_id
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Transfer not found");
      const details = await query(
        `
        SELECT d.id, d.transfer_id, d.item_id, d.qty, d.uom, d.batch_no AS batch_number, i.item_code, i.item_name
        FROM inv_stock_transfer_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.transfer_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTransferTables();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalanceDetailsInfrastructure();

      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const transferNo = body.transfer_no || (await nextTransferNo(companyId));
      const transferDate = toDateOnly(body.transfer_date || new Date()) || null;
      const fromBranchId = toNumber(body.from_branch_id) || null;
      const toBranchId = toNumber(body.to_branch_id) || null;
      const fromWarehouseId = toNumber(body.from_warehouse_id) || null;
      const toWarehouseId = toNumber(body.to_warehouse_id) || null;
      const rawTransferType = body.transfer_type
        ? String(body.transfer_type).trim()
        : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const transferScope = await resolveTransferScopeTx(conn, {
        companyId,
        transferType: rawTransferType,
        fromBranchId,
        toBranchId,
        fromWarehouseId,
        toWarehouseId,
      });
      const [result] = await conn.execute(
        `
        INSERT INTO inv_stock_transfers
        (company_id, branch_id, transfer_no, transfer_date, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, transfer_type, status)
        VALUES (:companyId, :branchId, :transferNo, :transferDate, :fromBranchId, :toBranchId, :fromWarehouseId, :toWarehouseId, :transferType, :status)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          transferNo: transferNo || null,
          transferDate: transferDate || null,
          fromBranchId: transferScope.fromBranchId,
          toBranchId: transferScope.toBranchId,
          fromWarehouseId: transferScope.fromWarehouseId,
          toWarehouseId: transferScope.toWarehouseId,
          transferType: transferScope.transferType,
          status,
        },
      );
      const transferId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId || qty <= 0) continue;

        if (
          ["IN_TRANSIT", "IN TRANSIT"].includes(String(status).toUpperCase())
        ) {
          await reserveStockTx(conn, {
            companyId,
            branchId,
            warehouseId: transferScope.fromWarehouseId,
            itemId,
            qtyToReserve: qty,
            sourceRef: transferNo,
            createdBy: req.user?.sub || null,
          });
        }

        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        const batchNo = line.batch_number
          ? String(line.batch_number).trim() || null
          : null;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details
          (transfer_id, item_id, qty, uom, batch_no)
          VALUES (:transferId, :itemId, :qty, :uom, :batchNo)
          `,
          {
            transferId: transferId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            batchNo,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: transferId, transfer_no: transferNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-transfers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTransferTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const transferDate = toDateOnly(body.transfer_date) || null;
      const fromBranchId = toNumber(body.from_branch_id) || null;
      const toBranchId = toNumber(body.to_branch_id) || null;
      const fromWarehouseId = toNumber(body.from_warehouse_id) || null;
      const toWarehouseId = toNumber(body.to_warehouse_id) || null;
      const rawTransferType = body.transfer_type
        ? String(body.transfer_type).trim()
        : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const transferScope = await resolveTransferScopeTx(conn, {
        companyId,
        transferType: rawTransferType,
        fromBranchId,
        toBranchId,
        fromWarehouseId,
        toWarehouseId,
      });
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_transfers
        SET transfer_date = :transferDate, from_branch_id = :fromBranchId, to_branch_id = :toBranchId, 
            from_warehouse_id = :fromWarehouseId, to_warehouse_id = :toWarehouseId, transfer_type = :transferType, status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          transferDate: transferDate || null,
          fromBranchId: transferScope.fromBranchId,
          toBranchId: transferScope.toBranchId,
          fromWarehouseId: transferScope.fromWarehouseId,
          toWarehouseId: transferScope.toWarehouseId,
          transferType: transferScope.transferType,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Transfer not found");

      await conn.execute(
        `DELETE FROM inv_stock_transfer_details WHERE transfer_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        const batchNo = line.batch_number
          ? String(line.batch_number).trim() || null
          : null;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details
          (transfer_id, item_id, qty, uom, batch_no)
          VALUES (:transferId, :itemId, :qty, :uom, :batchNo)
          `,
          {
            transferId: id || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            batchNo,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-transfers/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      const { status } = req.body;
      if (!id || !status)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id or status");

      await conn.beginTransaction();

      const [hdr] = await conn.execute(
        `SELECT * FROM inv_stock_transfers WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!hdr || !hdr.length)
        throw httpError(404, "NOT_FOUND", "Transfer not found");

      const transfer = hdr[0];
      const oldStatus = transfer.status;

      // Update status
      await conn.execute(
        `UPDATE inv_stock_transfers SET status = :status WHERE id = :id`,
        { status, id },
      );

      // If moving from DRAFT to IN_TRANSIT / IN TRANSIT, reserve stock
      if (
        oldStatus === "DRAFT" &&
        ["IN_TRANSIT", "IN TRANSIT"].includes(String(status).toUpperCase())
      ) {
        const [details] = await conn.execute(
          `SELECT item_id, qty FROM inv_stock_transfer_details WHERE transfer_id = :id`,
          { id },
        );
        for (const line of details) {
          await reserveStockTx(conn, {
            companyId,
            branchId,
            warehouseId: transfer.from_warehouse_id,
            itemId: line.item_id,
            qtyToReserve: line.qty,
            sourceRef: transfer.transfer_no,
            createdBy: req.user?.sub || null,
          });
        }
      }

      await conn.commit();
      res.json({ success: true, status });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

// Stock Adjustment endpoints
router.post(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const adjustmentNo =
        body.adjustment_no || (await nextAdjustmentNo(companyId));
      const adjustmentDate =
        toDateOnly(body.adjustment_date || new Date()) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks = body.remarks ? String(body.remarks).trim() || null : null;
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `
        INSERT INTO inv_stock_adjustments
        (company_id, branch_id, adjustment_no, adjustment_date, status, remarks)
        VALUES (:companyId, :branchId, :adjustmentNo, :adjustmentDate, :status, :remarks)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          adjustmentNo: adjustmentNo || null,
          adjustmentDate: adjustmentDate || null,
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      const adjustmentId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details
          (adjustment_id, item_id, qty, uom, unit_price, line_total, remarks)
          VALUES (:adjustmentId, :itemId, :qty, :uom, :unitPrice, :lineTotal, :remarks)
          `,
          {
            adjustmentId: adjustmentId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
            unitPrice: Number(line.unit_price || 0) || 0,
            lineTotal: Number(line.line_total || 0) || 0,
            remarks: line.remarks ? String(line.remarks).trim() || null : null,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: adjustmentId, adjustment_no: adjustmentNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-adjustments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const adjustmentDate = toDateOnly(body.adjustment_date) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const adjustmentType = body.adjustment_type
        ? String(body.adjustment_type)
        : null;
      const referenceDoc = body.reference_doc
        ? String(body.reference_doc)
        : null;
      const reason = body.reason ? String(body.reason) : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks =
        reason || (body.remarks ? String(body.remarks).trim() || null : null);
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_adjustments
        SET warehouse_id = :warehouseId,
            adjustment_date = :adjustmentDate,
            adjustment_type = :adjustmentType,
            reference_doc = :referenceDoc,
            reason = :reason,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          warehouseId,
          adjustmentDate: adjustmentDate || null,
          adjustmentType,
          referenceDoc,
          reason,
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Adjustment not found");

      await conn.execute(
        `DELETE FROM inv_stock_adjustment_details WHERE adjustment_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId) continue;
        const unitCost = Number(line.unit_cost || 0);
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details
          (adjustment_id, item_id, current_stock, adjusted_stock, qty, uom, unit_cost, unit_price, line_total, remarks)
          VALUES (:adjustmentId, :itemId, :currentStock, :adjustedStock, :qty, :uom, :unitCost, :unitPrice, :lineTotal, :remarks)
          `,
          {
            adjustmentId: id || null,
            itemId: itemId || null,
            currentStock: Number(line.current_stock || 0),
            adjustedStock: Number(line.adjusted_stock || 0),
            qty: qty || 0,
            uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
            unitCost,
            unitPrice: unitCost,
            lineTotal: unitCost * Math.abs(qty || 0),
            remarks: line.remarks ? String(line.remarks).trim() || null : null,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

// Daily Stock Count/Stock Take endpoints
async function ensureStockCountTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_daily_stock_counts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      stock_take_no VARCHAR(50) NULL,
      count_date DATE NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_count (company_id, branch_id, warehouse_id, count_date),
      KEY idx_count_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS stock_take_no VARCHAR(50) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_daily_stock_counts MODIFY COLUMN warehouse_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_daily_stock_counts ADD UNIQUE KEY uq_stock_take_no (company_id, branch_id, stock_take_no)
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_daily_stock_count_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      count_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_counted DECIMAL(18,3),
      qty_system DECIMAL(18,3),
      variance DECIMAL(18,3),
      remarks VARCHAR(255),
      KEY idx_detail (count_id),
      KEY idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

async function nextStockTakeNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT stock_take_no
    FROM inv_daily_stock_counts
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND stock_take_no LIKE 'STK-%'
    ORDER BY CAST(SUBSTRING(stock_take_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  ).catch(() => []);
  let nextNum = 1;
  if (rows && rows.length) {
    const prev = String(rows[0].stock_take_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `STK-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/daily-stock-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT c.id, c.warehouse_id, c.count_date, c.status,
               w.warehouse_name, COUNT(d.id) AS item_count
        FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        LEFT JOIN inv_daily_stock_count_details d ON d.count_id = c.id
        WHERE c.company_id = :companyId AND c.branch_id = :branchId
        GROUP BY c.id
        ORDER BY c.count_date DESC, c.id DESC
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT c.id,
               c.stock_take_no,
               c.count_date AS stock_take_date,
               c.status,
               w.warehouse_name
        FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        WHERE c.company_id = :companyId AND c.branch_id = :branchId
        ORDER BY c.count_date DESC, c.id DESC
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/daily-stock-count/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT c.*, w.warehouse_name
        FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        WHERE c.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Stock count not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name
        FROM inv_daily_stock_count_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.count_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-takes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT c.*, w.warehouse_name
        FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        WHERE c.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Stock take not found");
      const detailsRaw = await query(
        `
        SELECT d.*
        FROM inv_daily_stock_count_details d
        WHERE d.count_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      const item = {
        stock_take_no: hdr.stock_take_no || null,
        stock_take_date: hdr.count_date || null,
        warehouse_id: hdr.warehouse_id || null,
        status: hdr.status || "DRAFT",
      };
      const details = (detailsRaw || []).map((r) => ({
        item_id: r.item_id,
        physical_qty: r.qty_counted,
      }));
      res.json({ item, details });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/daily-stock-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId, branchId, userId } = req.scope;
      const body = req.body || {};
      const warehouseId = toNumber(body.warehouse_id);
      const countDate = toDateOnly(body.count_date || new Date()) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks = body.remarks ? String(body.remarks).trim() || null : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!warehouseId)
        throw httpError(400, "VALIDATION_ERROR", "warehouse_id is required");

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `
        INSERT INTO inv_daily_stock_counts
        (company_id, branch_id, warehouse_id, count_date, status, remarks, created_by)
        VALUES (:companyId, :branchId, :warehouseId, :countDate, :status, :remarks, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          countDate: countDate || null,
          status: status || "DRAFT",
          remarks: remarks || null,
          createdBy: userId || null,
        },
      );
      const countId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qtyCount = Number(line.qty_counted || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_daily_stock_count_details
          (count_id, item_id, qty_counted, qty_system, variance, remarks)
          VALUES (:countId, :itemId, :qtyCount, :qtySystem, :variance, :lineRemarks)
          `,
          {
            countId: countId || null,
            itemId: itemId || null,
            qtyCount: qtyCount || 0,
            qtySystem: Number(line.qty_system || 0) || 0,
            variance: Number(line.variance || 0) || 0,
            lineRemarks: line.remarks
              ? String(line.remarks).trim() || null
              : null,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: countId });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const stockTakeNoRaw = body.stock_take_no;
      const stockTakeDate =
        toDateOnly(body.stock_take_date || new Date()) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];
      if (!stockTakeDate)
        throw httpError(400, "VALIDATION_ERROR", "stock_take_date is required");
      const stockTakeNo =
        stockTakeNoRaw && String(stockTakeNoRaw).trim()
          ? String(stockTakeNoRaw).trim()
          : await nextStockTakeNo(companyId, branchId);
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_daily_stock_counts
          (company_id, branch_id, warehouse_id, stock_take_no, count_date, status)
        VALUES
          (:companyId, :branchId, :warehouseId, :stockTakeNo, :countDate, :status)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          stockTakeNo: stockTakeNo || null,
          countDate: stockTakeDate || null,
          status: status || "DRAFT",
        },
      );
      const countId = hdr.insertId;
      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty =
          line.physical_qty === "" ? null : Number(line.physical_qty || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_daily_stock_count_details
            (count_id, item_id, qty_counted)
          VALUES
            (:countId, :itemId, :qty)
          `,
          { countId: countId || null, itemId: itemId || null, qty: qty },
        );
      }
      await conn.commit();
      res.status(201).json({ id: countId, stock_take_no: stockTakeNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/daily-stock-count/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const countDate = toDateOnly(body.count_date) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks = body.remarks ? String(body.remarks).trim() || null : null;
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET count_date = :countDate, status = :status, remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          countDate: countDate || null,
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Stock count not found");

      await conn.execute(
        `DELETE FROM inv_daily_stock_count_details WHERE count_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qtyCount = Number(line.qty_counted || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_daily_stock_count_details
          (count_id, item_id, qty_counted, qty_system, variance, remarks)
          VALUES (:countId, :itemId, :qtyCount, :qtySystem, :variance, :lineRemarks)
          `,
          {
            countId: id || null,
            itemId: itemId || null,
            qtyCount: qtyCount || 0,
            qtySystem: Number(line.qty_system || 0) || 0,
            variance: Number(line.variance || 0) || 0,
            lineRemarks: line.remarks
              ? String(line.remarks).trim() || null
              : null,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-takes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const stockTakeNoRaw = body.stock_take_no;
      const stockTakeDate = toDateOnly(body.stock_take_date) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];
      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET stock_take_no = :stockTakeNo,
            count_date = :countDate,
            warehouse_id = :warehouseId,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          stockTakeNo: stockTakeNoRaw || null,
          countDate: stockTakeDate || null,
          warehouseId: warehouseId || null,
          status: status || "DRAFT",
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Stock take not found");
      await conn.execute(
        `DELETE FROM inv_daily_stock_count_details WHERE count_id = :id`,
        { id: id || null },
      );
      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty =
          line.physical_qty === "" ? null : Number(line.physical_qty || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_daily_stock_count_details
            (count_id, item_id, qty_counted)
          VALUES
            (:countId, :itemId, :qty)
          `,
          { countId: id || null, itemId: itemId || null, qty: qty },
        );
      }
      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

// Stock Reorder Points
async function ensureStockReorderTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_reorder_points (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NOT NULL,
      reorder_level DECIMAL(18,3) NOT NULL DEFAULT 0,
      reorder_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      max_stock DECIMAL(18,3),
      min_stock DECIMAL(18,3),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reorder (company_id, branch_id, item_id, warehouse_id),
      KEY idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

router.get(
  "/stock-reorder",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockReorderTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT r.*, i.item_code, i.item_name, w.warehouse_name,
               COALESCE(s.qty, 0) AS current_qty
        FROM inv_stock_reorder_points r
        LEFT JOIN inv_items i ON i.id = r.item_id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN inv_stock_balances s ON s.item_id = r.item_id AND s.warehouse_id = r.warehouse_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId AND r.is_active = 1
        ORDER BY i.item_name, w.warehouse_name
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Items endpoints
async function ensureItemsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      item_code VARCHAR(50) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      uom VARCHAR(20) DEFAULT 'PCS',
      item_type VARCHAR(50) DEFAULT 'INVENTORY',
      category VARCHAR(100),
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_item_code (company_id, item_code),
      KEY idx_item_name (item_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
  // Ensure UOM column exists and update any null/empty values
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'PCS'
  `).catch(() => {});
  // Ensure stock level columns exist
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS max_stock_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS reorder_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  // Update any items with NULL or empty UOM to default 'PCS'
  await query(`
    UPDATE inv_items SET uom = 'PCS' WHERE uom IS NULL OR uom = ''
  `).catch(() => {});
}

router.get("/items/:id", requireAuth, async (req, res, next) => {
  try {
    await ensureItemsTable();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const [item] = await query(
      `SELECT * FROM inv_items WHERE id = :id LIMIT 1`,
      { id: id || null },
    );
    if (!item) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/items",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemsTable();
      const { companyId } = req.scope;
      const body = req.body || {};
      const itemCode = body.item_code ? String(body.item_code).trim() : null;
      const itemName = body.item_name ? String(body.item_name).trim() : null;
      const uom = body.uom ? String(body.uom).trim() : "PCS";
      const itemType = body.item_type
        ? String(body.item_type).trim()
        : "INVENTORY";
      const category = body.category
        ? String(body.category).trim() || null
        : null;
      const description = body.description
        ? String(body.description).trim() || null
        : null;

      if (!itemCode || !itemName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_code and item_name are required",
        );
      }

      const [result] = await query(
        `
        INSERT INTO inv_items
        (company_id, item_code, item_name, uom, item_type, category, description)
        VALUES (:companyId, :itemCode, :itemName, :uom, :itemType, :category, :description)
        `,
        {
          companyId: companyId || null,
          itemCode: itemCode || null,
          itemName: itemName || null,
          uom: uom || "PCS",
          itemType: itemType || "INVENTORY",
          category: category || null,
          description: description || null,
        },
      );
      const itemId = result.insertId;
      res.status(201).json({ id: itemId, item_code: itemCode });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemsTable();
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const itemCode = body.item_code ? String(body.item_code).trim() : null;
      const itemName = body.item_name ? String(body.item_name).trim() : null;
      const uom = body.uom ? String(body.uom).trim() : "PCS";
      const itemType = body.item_type
        ? String(body.item_type).trim()
        : "INVENTORY";
      const category = body.category
        ? String(body.category).trim() || null
        : null;
      const description = body.description
        ? String(body.description).trim() || null
        : null;

      if (!itemCode || !itemName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_code and item_name are required",
        );
      }

      const [upd] = await query(
        `
        UPDATE inv_items
        SET item_code = :itemCode, item_name = :itemName, uom = :uom, 
            item_type = :itemType, category = :category, description = :description
        WHERE id = :id AND company_id = :companyId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          itemCode: itemCode || null,
          itemName: itemName || null,
          uom: uom || "PCS",
          itemType: itemType || "INVENTORY",
          category: category || null,
          description: description || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item not found");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Supplier-Item Link Table ────────────────────────────────────────────
async function ensureSupplierItemsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_supplier_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      min_stock_level DECIMAL(18,3) DEFAULT 0,
      max_stock_level DECIMAL(18,3) DEFAULT 0,
      reorder_level DECIMAL(18,3) DEFAULT 0,
      lead_time INT DEFAULT 0,
      preferred TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_supplier_item (company_id, branch_id, supplier_id, item_id),
      KEY idx_supplier (supplier_id),
      KEY idx_item (item_id),
      CONSTRAINT fk_si_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_si_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_si_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id),
      CONSTRAINT fk_si_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

// ─── Reorder Points Table ────────────────────────────────────────────────
async function ensureReorderPointsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_reorder_points (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      min_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
      max_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
      reorder_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      lead_time INT DEFAULT 0,
      supplier_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reorder_point (company_id, branch_id, warehouse_id, item_id),
      KEY idx_rp_company_branch (company_id, branch_id),
      KEY idx_rp_warehouse (warehouse_id),
      KEY idx_rp_item (item_id),
      CONSTRAINT fk_rp_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_rp_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_rp_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id),
      CONSTRAINT fk_rp_item FOREIGN KEY (item_id) REFERENCES inv_items(id),
      CONSTRAINT fk_rp_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

// ─── Reorder Points Endpoints ─────────────────────────────────────────────
router.get(
  "/reorder-points",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReorderPointsTable();
      const { companyId, branchId } = req.scope;
      const { warehouseId, search, status } = req.query;

      let where =
        "WHERE rp.company_id = :companyId AND rp.branch_id = :branchId";
      const params = { companyId, branchId };

      if (warehouseId) {
        where += " AND rp.warehouse_id = :warehouseId";
        params.warehouseId = toNumber(warehouseId);
      }

      if (search) {
        where += " AND (i.item_code LIKE :search OR i.item_name LIKE :search)";
        params.search = `%${String(search).trim()}%`;
      }

      const rows = await query(
        `
        SELECT 
          rp.id,
          rp.warehouse_id,
          rp.supplier_id,
          rp.item_id,
          rp.min_stock,
          rp.max_stock,
          rp.reorder_qty,
          rp.lead_time,
          i.item_code,
          i.item_name,
          i.uom,
          w.warehouse_name,
          s.supplier_name,
          COALESCE(sb.qty, 0) AS current_stock
        FROM inv_reorder_points rp
        JOIN inv_items i ON i.id = rp.item_id
        JOIN inv_warehouses w ON w.id = rp.warehouse_id
        LEFT JOIN pur_suppliers s ON s.id = rp.supplier_id
        LEFT JOIN inv_stock_balances sb ON sb.company_id = rp.company_id 
          AND sb.branch_id = rp.branch_id 
          AND sb.warehouse_id = rp.warehouse_id 
          AND sb.item_id = rp.item_id
        ${where}
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);

      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/reorder-points",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReorderPointsTable();
      await ensureSupplierItemsTable();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const warehouseId = toNumber(body.warehouse_id);
      const itemId = toNumber(body.item_id);
      const supplierId = toNumber(body.supplier_id);
      const minStock = Number(body.min_stock || 0);
      const maxStock = Number(body.max_stock || 0);
      const reorderQty = Number(body.reorder_qty || 0);
      const leadTime = Number(body.lead_time || 0);

      if (!itemId || !warehouseId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_id and warehouse_id are required",
        );
      }

      await conn.beginTransaction();

      // Insert or update reorder point for warehouse
      await conn.execute(
        `
        INSERT INTO inv_reorder_points 
          (company_id, branch_id, warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, supplier_id, is_active)
        VALUES 
          (:companyId, :branchId, :warehouseId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, :supplierId, 1)
        ON DUPLICATE KEY UPDATE
          min_stock = :minStock,
          max_stock = :maxStock,
          reorder_qty = :reorderQty,
          lead_time = :leadTime,
          supplier_id = :supplierId
        `,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          minStock,
          maxStock,
          reorderQty,
          leadTime,
          supplierId,
        },
      );

      // Insert or update supplier-item link if supplier is provided
      if (supplierId) {
        await conn.execute(
          `
          INSERT INTO inv_supplier_items 
            (company_id, branch_id, supplier_id, item_id, min_stock_level, max_stock_level, reorder_level, lead_time, preferred)
          VALUES 
            (:companyId, :branchId, :supplierId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, 1)
          ON DUPLICATE KEY UPDATE
            min_stock_level = :minStock,
            max_stock_level = :maxStock,
            reorder_level = :reorderQty,
            lead_time = :leadTime,
            preferred = 1
          `,
          {
            companyId,
            branchId,
            supplierId,
            itemId,
            minStock,
            maxStock,
            reorderQty,
            leadTime,
          },
        );
      }

      // Update inv_items table with stock levels
      await conn.execute(
        `
        UPDATE inv_items
        SET min_stock_level = :minStock,
            max_stock_level = :maxStock,
            reorder_level = :reorderQty
        WHERE id = :itemId AND company_id = :companyId
        `,
        { itemId, companyId, minStock, maxStock, reorderQty },
      );

      await conn.commit();
      res.status(201).json({ ok: true, item_id: itemId });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.delete(
  "/reorder-points/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);

      if (!id) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      await conn.beginTransaction();

      // Delete from inv_reorder_points
      await conn.execute(
        `
        DELETE FROM inv_reorder_points
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId },
      );

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

// Bulk Reorder Template Export
router.get(
  "/reorder-points/export/template",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      console.log("📥 Template export request received");
      console.log(
        "🔐 Auth scope - Company:",
        req.scope?.companyId,
        "Branch:",
        req.scope?.branchId,
      );
      await ensureReorderPointsTable();
      const { companyId, branchId } = req.scope;
      console.log("🔍 Fetching items and warehouses for company:", companyId);

      // Fetch all items and warehouses for this company/branch
      const [items] = await query(
        `
        SELECT id, item_code, item_name, uom
        FROM inv_items
        WHERE company_id = :companyId AND is_active = 1
        ORDER BY item_code ASC
        `,
        { companyId },
      );
      console.log("📦 Items found:", items?.length || 0);

      const [warehouses] = await query(
        `
        SELECT id, warehouse_name
        FROM inv_warehouses
        WHERE company_id = :companyId AND branch_id = :branchId
        ORDER BY warehouse_name ASC
        `,
        { companyId, branchId },
      );
      console.log("🏭 Warehouses found:", warehouses?.length || 0);
      const hasItems = Array.isArray(items) && items.length > 0;
      const hasWarehouses = Array.isArray(warehouses) && warehouses.length > 0;

      // Create template data: Cartesian product of items x warehouses
      const templateData = [];
      if (hasItems && hasWarehouses) {
        for (const item of items) {
          for (const warehouse of warehouses) {
            templateData.push({
              "Item Code": item.item_code,
              "Item Name": item.item_name,
              UOM: item.uom || "PCS",
              Warehouse: warehouse.warehouse_name,
              "Min Stock": "",
              "Max Stock": "",
              "Reorder Qty": "",
              "Lead Time (Days)": "",
            });
          }
        }
      } else {
        templateData.push({
          "Item Code": "",
          "Item Name": "",
          UOM: "",
          Warehouse: "",
          "Min Stock": "",
          "Max Stock": "",
          "Reorder Qty": "",
          "Lead Time (Days)": "",
        });
      }

      // Create workbook and sheet
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reorder Points");

      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // Item Code
        { wch: 25 }, // Item Name
        { wch: 10 }, // UOM
        { wch: 20 }, // Warehouse
        { wch: 12 }, // Min Stock
        { wch: 12 }, // Max Stock
        { wch: 12 }, // Reorder Qty
        { wch: 15 }, // Lead Time
      ];
      ws["!cols"] = colWidths;

      // Generate buffer and send
      console.log(
        "📊 Generated template data with",
        templateData.length,
        "rows",
      );
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      console.log("📦 Excel buffer created, size:", buffer.length, "bytes");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="reorder_points_template.xlsx"',
      );
      res.send(buffer);
      console.log("✅ Template sent successfully");
    } catch (err) {
      console.error("❌ Template export error:", err);
      next(err);
    }
  },
);

// Bulk Reorder Upload
router.post(
  "/reorder-points/bulk-upload",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReorderPointsTable();
      await ensureSupplierItemsTable();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const data = Array.isArray(body.data) ? body.data : [];

      if (!data.length) {
        throw httpError(400, "VALIDATION_ERROR", "No data provided");
      }

      await conn.beginTransaction();
      let processed = 0;
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          const itemCode = String(row["Item Code"] || "").trim();
          const warehouseName = String(row["Warehouse"] || "").trim();
          const minStock = Number(row["Min Stock"] || 0);
          const maxStock = Number(row["Max Stock"] || 0);
          const reorderQty = Number(row["Reorder Qty"] || 0);
          const leadTime = Number(row["Lead Time (Days)"] || 0);

          if (!itemCode || !warehouseName) {
            errors.push(`Row ${i + 2}: Item Code and Warehouse are required`);
            continue;
          }

          // Find item ID by code
          const [itemResult] = await conn.execute(
            `SELECT id FROM inv_items WHERE company_id = :companyId AND item_code = :itemCode`,
            { companyId, itemCode },
          );
          if (!itemResult || !itemResult.length) {
            errors.push(`Row ${i + 2}: Item '${itemCode}' not found`);
            continue;
          }
          const itemId = itemResult[0].id;

          // Find warehouse ID by name
          const [whResult] = await conn.execute(
            `SELECT id FROM inv_warehouses WHERE company_id = :companyId AND branch_id = :branchId AND warehouse_name = :warehouseName`,
            { companyId, branchId, warehouseName },
          );
          if (!whResult || !whResult.length) {
            errors.push(`Row ${i + 2}: Warehouse '${warehouseName}' not found`);
            continue;
          }
          const warehouseId = whResult[0].id;

          // Upsert reorder point
          await conn.execute(
            `
            INSERT INTO inv_reorder_points 
              (company_id, branch_id, warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, is_active)
            VALUES 
              (:companyId, :branchId, :warehouseId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, 1)
            ON DUPLICATE KEY UPDATE
              min_stock = :minStock,
              max_stock = :maxStock,
              reorder_qty = :reorderQty,
              lead_time = :leadTime
            `,
            {
              companyId,
              branchId,
              warehouseId,
              itemId,
              minStock,
              maxStock,
              reorderQty,
              leadTime,
            },
          );

          // Update inv_items table with global stock levels
          await conn.execute(
            `
            UPDATE inv_items
            SET min_stock_level = :minStock,
                max_stock_level = :maxStock,
                reorder_level = :reorderQty
            WHERE id = :itemId AND company_id = :companyId
            `,
            { itemId, companyId, minStock, maxStock, reorderQty },
          );

          processed++;
        } catch (rowErr) {
          errors.push(`Row ${i + 2}: ${rowErr.message}`);
        }
      }

      await conn.commit();
      res.json({
        ok: true,
        processed,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/granular-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { itemId, warehouseId, batchNo, search } = req.query || {};

      const clauses = [
        "company_id = :companyId",
        "branch_id = :branchId",
        "qty > 0",
      ];
      const params = { companyId, branchId };

      if (itemId) {
        clauses.push("item_id = :itemId");
        params.itemId = toNumber(itemId);
      }
      if (warehouseId) {
        clauses.push("warehouse_id = :warehouseId");
        params.warehouseId = toNumber(warehouseId);
      }
      if (batchNo) {
        clauses.push("batch_no = :batchNo");
        params.batchNo = batchNo;
      }
      if (search) {
        clauses.push(
          "(item_name LIKE :search OR item_code LIKE :search OR batch_no LIKE :search OR serial_no LIKE :search)",
        );
        params.search = `%${search}%`;
      }

      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const items = await query(
        `
        SELECT *
        FROM v_active_stock_details
        ${where}
        ORDER BY item_name ASC, entry_date ASC
        LIMIT 1000
      `,
        params,
      );

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const { itemId } = req.query;
      let sql =
        "SELECT * FROM inv_unit_conversions WHERE company_id = :companyId AND is_active = 1";
      const params = { companyId };

      if (itemId) {
        sql += " AND item_id = :itemId";
        params.itemId = toNumber(itemId);
      }

      const rows = await query(sql, params);
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/transfer-acceptance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      // Fetch transfers where status is IN TRANSIT / IN_TRANSIT and to_branch_id = current branch
      const rows = await query(
        `
        SELECT t.*, 
               fw.warehouse_name AS from_warehouse_name,
               tw.warehouse_name AS to_warehouse_name
        FROM inv_stock_transfers t
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.company_id = :companyId 
          AND (
            COALESCE(tw.branch_id, 0) = :branchId
            OR COALESCE(t.to_branch_id, 0) = :branchId
            OR COALESCE(t.branch_id, 0) = :branchId
          )
          AND UPPER(REPLACE(COALESCE(t.status, ''), ' ', '_'))
              IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED')
        ORDER BY t.transfer_date DESC, t.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/transfer-acceptance/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT t.*, 
               fw.warehouse_name AS from_warehouse_name,
               tw.warehouse_name AS to_warehouse_name
        FROM inv_stock_transfers t
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.id = :id
          AND t.company_id = :companyId
          AND (
            COALESCE(tw.branch_id, 0) = :branchId
            OR COALESCE(t.to_branch_id, 0) = :branchId
            OR COALESCE(t.branch_id, 0) = :branchId
          )
        LIMIT 1
        `,
        { id, companyId, branchId },
      );

      const item = rows?.[0] || null;
      if (!item) throw httpError(404, "NOT_FOUND", "Transfer not found");

      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
               COALESCE(d.qty - COALESCE(d.received_qty, 0), 0) AS remaining_qty
        FROM inv_stock_transfer_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.transfer_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );

      res.json({ item, details });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/transfer-acceptance/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    // Basic implementation for acceptance
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const id = toNumber(req.params.id);
      const details = Array.isArray(req.body?.details) ? req.body.details : [];

      await conn.beginTransaction();

      const [hdrRows] = await conn.execute(
        `SELECT t.*
         FROM inv_stock_transfers t
         LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
         WHERE (t.id = :id OR t.transfer_no = :id) 
           AND t.company_id = :companyId 
           AND (
             COALESCE(tw.branch_id, 0) = :branchId
             OR COALESCE(t.to_branch_id, 0) = :branchId
             OR COALESCE(t.branch_id, 0) = :branchId
           )
         LIMIT 1`,
        { id: req.params.id, companyId, branchId },
      );
      const hdr = hdrRows?.[0];
      if (!hdr) throw httpError(404, "NOT_FOUND", "Transfer not found");
      const transferId = hdr.id;

      for (const d of details) {
        const lineId = toNumber(d.id);
        const accQty = Number(d.accepted_qty || 0);
        const rejQty = Number(d.rejected_qty || 0);
        const recvQty = Number(d.accepted_qty ?? d.received_qty ?? d.qty ?? 0);

        if (accQty > 0 || rejQty > 0) {
          await conn.execute(
            `UPDATE inv_stock_transfer_details 
             SET accepted_qty = :accQty,
                 rejected_qty = :rejQty,
                 received_qty = :recvQty,
                 acceptance_remarks = :remarks
             WHERE id = :lineId`,
            {
              accQty,
              rejQty,
              recvQty,
              remarks: d.acceptance_remarks || null,
              lineId,
            },
          );
        }
      }

      await conn.execute(
        `UPDATE inv_stock_transfers 
            SET status = 'RECEIVED', 
                received_date = CURRENT_TIMESTAMP, 
                received_by = :userId
          WHERE id = :id`,
        { id: transferId, userId },
      );

      await applyTransferReceiptMovementsTx(conn, {
        companyId,
        transferId,
        createdBy: userId,
      });

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.get(
  "/alerts/low-stock",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT 
          i.id,
          i.item_code,
          i.item_name,
          i.uom,
          COALESCE(sb.qty, 0) AS qty,
          COALESCE(i.reorder_level, 0) AS reorder_level
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        WHERE i.company_id = :companyId
          AND COALESCE(i.reorder_level, 0) > 0
          AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
        ORDER BY qty ASC, i.item_name ASC
        LIMIT 200
        `,
        { companyId, branchId },
      );
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/alerts/low-stock/notify-email",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT 
          i.id,
          i.item_code,
          i.item_name,
          i.uom,
          COALESCE(sb.qty, 0) AS qty,
          COALESCE(i.reorder_level, 0) AS reorder_level
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        WHERE i.company_id = :companyId
          AND COALESCE(i.reorder_level, 0) > 0
          AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
        ORDER BY qty ASC, i.item_name ASC
        LIMIT 200
        `,
        { companyId, branchId },
      );

      if (!items.length) {
        return res.json({ message: "No low stock items found" });
      }

      if (!isMailerConfigured()) {
        throw httpError(400, "BAD_REQUEST", "Mailer is not configured");
      }

      await query(`
        CREATE TABLE IF NOT EXISTS adm_notification_prefs (
          user_id BIGINT UNSIGNED NOT NULL,
          pref_key VARCHAR(100) NOT NULL,
          push_enabled TINYINT(1) NOT NULL DEFAULT 0,
          email_enabled TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, pref_key),
          INDEX idx_pref_key (pref_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      let recipients = await query(
        `
        SELECT DISTINCT u.id, u.email
        FROM adm_users u
        JOIN adm_notification_prefs np
          ON np.user_id = u.id
         AND np.pref_key = 'low-stock'
         AND np.email_enabled = 1
        WHERE u.is_active = 1
          AND u.company_id = :companyId
          AND u.branch_id = :branchId
          AND u.email IS NOT NULL
          AND u.email <> ''
        `,
        { companyId, branchId },
      );

      if (!recipients.length) {
        recipients = await query(
          `
          SELECT id, email
          FROM adm_users
          WHERE id = :userId
            AND company_id = :companyId
            AND branch_id = :branchId
            AND is_active = 1
            AND email IS NOT NULL
            AND email <> ''
          LIMIT 1
          `,
          { userId: req.user.sub, companyId, branchId },
        );
      }

      if (!recipients.length) {
        throw httpError(400, "BAD_REQUEST", "No recipient email found");
      }

      const count = items.length;
      const subject = `Low Stock Alert (${count} items)`;
      const lines = items
        .slice(0, 50)
        .map(
          (it) =>
            `${it.item_code} ${it.item_name} — qty ${Number(it.qty || 0)}, reorder ${Number(it.reorder_level || 0)}`,
        )
        .join("\n");
      const htmlRows = items
        .slice(0, 50)
        .map(
          (it) =>
            `<tr><td>${it.item_code}</td><td>${it.item_name}</td><td style="text-align:right">${Number(it.qty || 0)}</td><td style="text-align:right">${Number(it.reorder_level || 0)}</td></tr>`,
        )
        .join("");
      const text = `${count} items are at or below reorder levels.\n\n${lines}\n\nOpen: /inventory/alerts/low-stock`;
      const html = `<p>${count} items are at or below reorder levels.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${htmlRows}</tbody></table><p><a href="/inventory/alerts/low-stock">Open Alerts</a></p>`;

      for (const recipient of recipients) {
        await sendMail({
          to: recipient.email,
          subject,
          text,
          html,
        });
      }

      res.json({
        message: `Email notification sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Stock Verification Report
router.get(
  "/reports/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { from, to } = req.query;
      let where = "WHERE v.company_id = :companyId AND v.branch_id = :branchId";
      const params = { companyId, branchId };

      if (from) {
        where += " AND v.verification_date >= :from";
        params.from = from;
      }
      if (to) {
        where += " AND v.verification_date <= :to";
        params.to = to;
      }

      const rows = await query(
        `
        SELECT 
          v.id,
          v.verification_no AS verify_no,
          v.verification_date AS verify_date,
          v.status,
          w.warehouse_name,
          i.item_code,
          i.item_name,
          d.system_qty,
          d.physical_qty,
          d.variance_qty
        FROM inv_stock_verifications v
        JOIN inv_stock_verification_details d ON d.verification_id = v.id
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses w ON w.id = v.warehouse_id
        ${where}
        ORDER BY v.verification_date DESC, v.verification_no DESC
        `,
        params,
      );

      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
