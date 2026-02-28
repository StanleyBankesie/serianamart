import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import * as inventoryController from "../controllers/inventory.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nextDocNo(prefix) {
  return `${prefix}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${Date.now()}`;
}

async function nextTransferNo(companyId) {
  const rows = await query(
    `
    SELECT transfer_no
    FROM inv_stock_transfers
    WHERE company_id = :companyId
      AND transfer_no REGEXP '^ST-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(transfer_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].transfer_no || "");
    const numPart = prev.slice(3 + 1);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `ST-${String(nextNum).padStart(6, "0")}`;
}

function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return v.toISOString().split("T")[0];
  }
  const s = String(v);
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

async function nextRequisitionNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT requisition_no
    FROM inv_material_requisitions
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND requisition_no REGEXP '^MRS-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(requisition_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].requisition_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MRS-${String(nextNum).padStart(6, "0")}`;
}

async function nextIssueNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT issue_no
    FROM inv_issue_to_requirement
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND issue_no REGEXP '^ISS-[0-9]{6}$'
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
async function nextReturnNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT rts_no
    FROM inv_return_to_stores
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND rts_no REGEXP '^RT-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(rts_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].rts_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RT-${String(nextNum).padStart(6, "0")}`;
}

// NOTE: Previous routes for PR, RFQ, PO, GRN were lost due to an overwrite.
// Please restore from version control if needed.

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

async function ensureWarehousesTable() {
  if (!(await hasTable("inv_warehouses"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_warehouses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        warehouse_code VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(150) NOT NULL,
        location VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_warehouse_scope_code (company_id, branch_id, warehouse_code),
        KEY idx_warehouse_scope (company_id, branch_id),
        CONSTRAINT fk_warehouse_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_warehouse_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

async function ensureStockBalancesWarehouseInfrastructure() {
  if (!(await hasColumn("inv_stock_balances", "warehouse_id"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
    );
    try {
      await query(
        "ALTER TABLE inv_stock_balances DROP INDEX uq_stock_scope_item",
      );
    } catch {}
    try {
      await query(
        "ALTER TABLE inv_stock_balances ADD CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id)",
      );
    } catch {}
    try {
      await query(
        "ALTER TABLE inv_stock_balances ADD UNIQUE KEY uq_stock_scope_wh_item (company_id, branch_id, warehouse_id, item_id)",
      );
    } catch {}
  }
}

async function ensureStockTakeTables() {
  await ensureWarehousesTable();
  if (!(await hasTable("inv_stock_takes"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_stock_takes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        stock_take_no VARCHAR(50) NOT NULL,
        stock_take_date DATE NOT NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_stock_take_scope_no (company_id, branch_id, stock_take_no),
        KEY idx_stock_take_scope (company_id, branch_id),
        KEY idx_stock_take_date (stock_take_date),
        CONSTRAINT fk_stock_take_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
  if (!(await hasTable("inv_stock_take_details"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_stock_take_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        stock_take_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        system_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        physical_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        variance_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_std_stock_take (stock_take_id),
        KEY idx_std_item (item_id),
        CONSTRAINT fk_std_stock_take FOREIGN KEY (stock_take_id) REFERENCES inv_stock_takes(id) ON DELETE CASCADE,
        CONSTRAINT fk_std_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

async function ensureTransferWarehouseColumns() {
  if (!(await hasColumn("inv_stock_transfers", "from_warehouse_id"))) {
    await query(
      "ALTER TABLE inv_stock_transfers ADD COLUMN from_warehouse_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_stock_transfers", "to_warehouse_id"))) {
    await query(
      "ALTER TABLE inv_stock_transfers ADD COLUMN to_warehouse_id BIGINT UNSIGNED NULL",
    );
  }
}

async function ensureStockAdjustmentsInfrastructure() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      adjustment_no VARCHAR(50) NOT NULL,
      adjustment_date DATE NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      adjustment_type VARCHAR(50) NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      reference_doc VARCHAR(255) NULL,
      reason VARCHAR(255) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sa_scope_no (company_id, branch_id, adjustment_no),
      KEY idx_sa_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustment_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      adjustment_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      current_stock DECIMAL(18,3) NULL,
      adjusted_stock DECIMAL(18,3) NULL,
      unit_cost DECIMAL(18,2) NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_sad_adjustment (adjustment_id),
      KEY idx_sad_item (item_id),
      CONSTRAINT fk_sad_adjustment FOREIGN KEY (adjustment_id) REFERENCES inv_stock_adjustments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function nextStockUpdateNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT adjustment_no
    FROM inv_stock_adjustments
    WHERE company_id = :companyId
      AND branch_id = :branchId
      AND adjustment_no REGEXP '^SA-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(adjustment_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].adjustment_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `SA-${String(nextNum).padStart(6, "0")}`;
}

async function ensureStockTransferTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      transfer_no VARCHAR(50) NOT NULL,
      transfer_date DATE NOT NULL,
      from_branch_id BIGINT UNSIGNED NOT NULL,
      to_branch_id BIGINT UNSIGNED NOT NULL,
      from_warehouse_id BIGINT UNSIGNED NULL,
      to_warehouse_id BIGINT UNSIGNED NULL,
      status ENUM('DRAFT','IN_TRANSIT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','POSTED') NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      received_date DATETIME NULL,
      received_by BIGINT UNSIGNED NULL,
      transfer_type VARCHAR(50) DEFAULT 'Inter-Branch',
      delivery_date DATE NULL,
      vehicle_no VARCHAR(50) NULL,
      driver_name VARCHAR(100) NULL,
      contact_number VARCHAR(50) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_trans_company_no (company_id, transfer_no),
      KEY idx_trans_company (company_id),
      KEY idx_trans_from_branch (from_branch_id),
      KEY idx_trans_to_branch (to_branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfer_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      transfer_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      batch_number VARCHAR(100) NULL,
      remarks VARCHAR(255) NULL,
      received_qty DECIMAL(18,3) NULL,
      accepted_qty DECIMAL(18,3) NULL,
      rejected_qty DECIMAL(18,3) NULL,
      acceptance_remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_std_transfer (transfer_id),
      KEY idx_std_item (item_id),
      CONSTRAINT fk_std_transfer FOREIGN KEY (transfer_id) REFERENCES inv_stock_transfers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
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

async function ensureIssueDepartmentInfrastructure() {
  if (!(await hasColumn("inv_issue_to_requirement", "department_id"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement ADD COLUMN department_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_issue_to_requirement", "issue_type"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement ADD COLUMN issue_type VARCHAR(50) DEFAULT 'GENERAL'",
    );
  }
  if (!(await hasColumn("inv_issue_to_requirement", "requisition_id"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement ADD COLUMN requisition_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_issue_to_requirement_details", "uom"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement_details ADD COLUMN uom VARCHAR(20) DEFAULT 'PCS'",
    );
  }
  if (!(await hasColumn("inv_issue_to_requirement_details", "batch_number"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement_details ADD COLUMN batch_number VARCHAR(100) NULL",
    );
  }
  if (!(await hasColumn("inv_issue_to_requirement_details", "serial_number"))) {
    await pool.query(
      "ALTER TABLE inv_issue_to_requirement_details ADD COLUMN serial_number VARCHAR(100) NULL",
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inv_department_stock_balances (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      department_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,6) NOT NULL DEFAULT 0,
      UNIQUE KEY uniq_dept_stock (company_id, branch_id, department_id, item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  if (!(await hasTrigger("tr_issue_to_requirement_details_ai_dept_stock"))) {
    await pool.query(`
      CREATE TRIGGER tr_issue_to_requirement_details_ai_dept_stock
      AFTER INSERT ON inv_issue_to_requirement_details
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_department_id BIGINT UNSIGNED;
        SELECT company_id, branch_id, department_id INTO v_company_id, v_branch_id, v_department_id
          FROM inv_issue_to_requirement WHERE id = NEW.issue_id LIMIT 1;
        IF v_company_id IS NOT NULL AND v_branch_id IS NOT NULL AND v_department_id IS NOT NULL THEN
          INSERT INTO inv_department_stock_balances (company_id, branch_id, department_id, item_id, qty)
          VALUES (v_company_id, v_branch_id, v_department_id, NEW.item_id, NEW.qty_issued)
          ON DUPLICATE KEY UPDATE qty = qty + NEW.qty_issued;
        END IF;
      END
    `);
  }
  if (!(await hasTrigger("tr_issue_to_requirement_details_au_dept_stock"))) {
    await pool.query(`
      CREATE TRIGGER tr_issue_to_requirement_details_au_dept_stock
      AFTER UPDATE ON inv_issue_to_requirement_details
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_department_id BIGINT UNSIGNED;
        DECLARE v_delta DECIMAL(18,6);
        SELECT company_id, branch_id, department_id INTO v_company_id, v_branch_id, v_department_id
          FROM inv_issue_to_requirement WHERE id = NEW.issue_id LIMIT 1;
        SET v_delta = NEW.qty_issued - OLD.qty_issued;
        IF v_company_id IS NOT NULL AND v_branch_id IS NOT NULL AND v_department_id IS NOT NULL AND v_delta IS NOT NULL AND v_delta <> 0 THEN
          INSERT INTO inv_department_stock_balances (company_id, branch_id, department_id, item_id, qty)
          VALUES (v_company_id, v_branch_id, v_department_id, NEW.item_id, v_delta)
          ON DUPLICATE KEY UPDATE qty = qty + v_delta;
        END IF;
      END
    `);
  }
  if (!(await hasTrigger("tr_issue_to_requirement_details_ad_dept_stock"))) {
    await pool.query(`
      CREATE TRIGGER tr_issue_to_requirement_details_ad_dept_stock
      AFTER DELETE ON inv_issue_to_requirement_details
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_department_id BIGINT UNSIGNED;
        SELECT company_id, branch_id, department_id INTO v_company_id, v_branch_id, v_department_id
          FROM inv_issue_to_requirement WHERE id = OLD.issue_id LIMIT 1;
        IF v_company_id IS NOT NULL AND v_branch_id IS NOT NULL AND v_department_id IS NOT NULL THEN
          INSERT INTO inv_department_stock_balances (company_id, branch_id, department_id, item_id, qty)
          VALUES (v_company_id, v_branch_id, v_department_id, OLD.item_id, -OLD.qty_issued)
          ON DUPLICATE KEY UPDATE qty = qty - OLD.qty_issued;
        END IF;
      END
    `);
  }
  return true;
}

async function ensureReturnToStoresInfrastructure() {
  if (!(await hasColumn("inv_return_to_stores", "department_id"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores ADD COLUMN department_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_return_to_stores", "requisition_id"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores ADD COLUMN requisition_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_return_to_stores", "return_type"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores ADD COLUMN return_type VARCHAR(50) DEFAULT 'EXCESS'",
    );
  }
  if (!(await hasColumn("inv_return_to_stores_details", "reason"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores_details ADD COLUMN reason VARCHAR(50) NULL",
    );
  }
  if (!(await hasColumn("inv_return_to_stores_details", "condition"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores_details ADD COLUMN `condition` VARCHAR(20) DEFAULT 'GOOD'",
    );
  }
  if (!(await hasColumn("inv_return_to_stores_details", "batch_serial"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores_details ADD COLUMN batch_serial VARCHAR(100) NULL",
    );
  }
  if (!(await hasColumn("inv_return_to_stores_details", "location"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores_details ADD COLUMN location VARCHAR(100) NULL",
    );
  }
  if (!(await hasColumn("inv_return_to_stores_details", "remarks"))) {
    await pool.query(
      "ALTER TABLE inv_return_to_stores_details ADD COLUMN remarks VARCHAR(255) NULL",
    );
  }
  return true;
}

async function ensureStockReserveTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_reserves (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      transfer_id BIGINT UNSIGNED NOT NULL,
      from_branch_id BIGINT UNSIGNED NOT NULL,
      to_branch_id BIGINT UNSIGNED NOT NULL,
      from_warehouse_id BIGINT UNSIGNED NULL,
      to_warehouse_id BIGINT UNSIGNED NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_reserved DECIMAL(18,3) NOT NULL,
      status ENUM('IN_TRANSIT','RECEIVED','CANCELLED') DEFAULT 'IN_TRANSIT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_res_company (company_id),
      KEY idx_res_transfer (transfer_id),
      KEY idx_res_item (item_id),
      CONSTRAINT fk_res_transfer FOREIGN KEY (transfer_id) REFERENCES inv_stock_transfers(id) ON DELETE CASCADE
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
      grn_type ENUM('LOCAL', 'IMPORT') NOT NULL DEFAULT 'LOCAL',
      po_id BIGINT UNSIGNED NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      port_clearance_id BIGINT UNSIGNED NULL,
      invoice_no VARCHAR(50) NULL,
      invoice_date DATE NULL,
      invoice_amount DECIMAL(18,2) NULL,
      invoice_due_date DATE NULL,
      bill_of_lading VARCHAR(100) NULL,
      customs_entry_no VARCHAR(100) NULL,
      shipping_company VARCHAR(100) NULL,
      port_of_entry VARCHAR(100) NULL,
      delivery_number VARCHAR(50) NULL,
      delivery_date DATE NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_grn_company (company_id),
      KEY idx_grn_branch (branch_id),
      UNIQUE KEY uq_grn_no (company_id, branch_id, grn_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_goods_receipt_note_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      grn_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_ordered DECIMAL(18,3) NOT NULL,
      qty_received DECIMAL(18,3) NOT NULL,
      qty_accepted DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_rejected DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      unit_cost DECIMAL(18,2) NULL,
      unit_price DECIMAL(18,2) NULL,
      line_amount DECIMAL(18,2) NULL,
      batch_number VARCHAR(100) NULL,
      mfg_date DATE NULL,
      expiry_date DATE NULL,
      remarks VARCHAR(255) NULL,
      KEY idx_grnd_grn (grn_id),
      KEY idx_grnd_item (item_id),
      CONSTRAINT fk_grnd_grn FOREIGN KEY (grn_id) REFERENCES inv_goods_receipt_notes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  if (!(await hasColumn("inv_goods_receipt_notes", "delivery_number"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_notes ADD COLUMN delivery_number VARCHAR(50) NULL",
    );
  }
  if (!(await hasColumn("inv_goods_receipt_notes", "delivery_date"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_notes ADD COLUMN delivery_date DATE NULL",
    );
  }
  if (!(await hasColumn("inv_goods_receipt_note_details", "unit_price"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_note_details ADD COLUMN unit_price DECIMAL(18,2) NULL",
    );
  }
  if (!(await hasColumn("inv_goods_receipt_note_details", "batch_number"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_note_details ADD COLUMN batch_number VARCHAR(100) NULL",
    );
  }
  if (!(await hasColumn("inv_goods_receipt_note_details", "mfg_date"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_note_details ADD COLUMN mfg_date DATE NULL",
    );
  }
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

router.get(
  "/grn/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { type } = req.query; // LOCAL or IMPORT
      const nextNo = await nextGRNNo(companyId, branchId, type || "LOCAL");
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/grn/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const grnRows = await query(
        `SELECT grn_type FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      const grnType = String(grnRows?.[0]?.grn_type || "LOCAL").toUpperCase();
      const docRouteBase =
        grnType === "IMPORT" ? "/inventory/grn-import" : "/inventory/grn-local";
      const wfByRoute = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND document_route = :docRouteBase
        ORDER BY id ASC
        `,
        { companyId, docRouteBase },
      );
      const wfDefs = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND (
            document_type = 'GOODS_RECEIPT' OR document_type = 'Goods Receipt' OR
            document_type = 'GRN' OR document_type = 'Goods Receipt Note'
          )
        ORDER BY id ASC
        `,
        { companyId },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (
               document_type = 'GOODS_RECEIPT' OR document_type = 'Goods Receipt' OR
               document_type = 'GRN' OR document_type = 'Goods Receipt Note'
             )
           LIMIT 1`,
          { wfId: workflowIdOverride, companyId },
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
      if (activeWf) {
        const steps = await query(
          `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
          { wf: activeWf.id },
        );
        if (!steps.length)
          throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
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
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
          assignedToUserId = Number(targetUserIdRaw);
        } else if (allowedUsers.length > 0) {
          assignedToUserId = Number(allowedUsers[0].approver_user_id);
        }
        const dwRes = await query(
          `
          INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'GOODS_RECEIPT', :amount, :stepOrder, 'PENDING', :assignedTo)
          `,
          {
            companyId,
            workflowId: activeWf.id,
            documentId: id,
            amount: amount === null ? null : Number(amount),
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
            (:companyId, :workflowId, :dwId, :documentId, 'GOODS_RECEIPT', :stepOrder, :assignedTo, 'PENDING')
          `,
          {
            companyId,
            workflowId: activeWf.id,
            dwId: instanceId,
            documentId: id,
            stepOrder: first.step_order,
            assignedTo: assignedToUserId,
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
            dwId: instanceId,
            stepOrder: first.step_order,
            actor: req.user.sub,
            comments: "",
          },
        );
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        const rows = await query(
          `SELECT grn_no FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId LIMIT 1`,
          { id, companyId },
        );
        const docNo = rows.length ? rows[0].grn_no : null;
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId,
            userId: assignedToUserId,
            title: "Approval Required",
            message: docNo
              ? `GRN ${docNo} requires your approval`
              : `GRN #${id} requires your approval`,
            link: `/administration/workflows/approvals/${instanceId}`,
          },
        );
        res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
        return;
      }
      let behavior = null;
      if (wfDefs.length) {
        const firstWf = wfDefs[0];
        if (Number(firstWf.is_active) === 0) {
          behavior = firstWf.default_behavior || null;
          if (!behavior) {
            behavior = "AUTO_APPROVE";
          }
        }
      }
      if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        try {
          const headerRows = await query(
            `SELECT branch_id, warehouse_id FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId LIMIT 1`,
            { id, companyId },
          );
          const details = await query(
            `SELECT item_id, qty_accepted FROM inv_goods_receipt_note_details WHERE grn_id = :id`,
            { id },
          );
          if (headerRows.length) {
            const branchId = Number(headerRows[0].branch_id || 0);
            const warehouseId = headerRows[0].warehouse_id || null;
            for (const d of details) {
              const itemId = Number(d.item_id);
              const qtyAccepted = Number(d.qty_accepted || 0);
              if (itemId && Number.isFinite(qtyAccepted) && qtyAccepted > 0) {
                await query(
                  `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                   VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyAccepted)
                   ON DUPLICATE KEY UPDATE qty = qty + :qtyAccepted`,
                  {
                    companyId,
                    branchId,
                    warehouseId,
                    itemId,
                    qtyAccepted,
                  },
                );
              }
            }
          }
        } catch (e) {}
        res.json({ status: "APPROVED" });
        return;
      }
      await query(
        `UPDATE inv_goods_receipt_notes SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { grn_type, status } = req.query;

      let sql = `
        SELECT g.id, g.grn_no, g.grn_date, g.grn_type, g.supplier_id, g.po_id, g.port_clearance_id, g.status, 
               s.supplier_name, w.warehouse_name
        FROM inv_goods_receipt_notes g
        JOIN pur_suppliers s ON s.id = g.supplier_id
        LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
        WHERE g.company_id = :companyId AND g.branch_id = :branchId
      `;

      if (grn_type) sql += ` AND g.grn_type = :grn_type`;
      if (status) sql += ` AND g.status = :status`;

      sql += ` ORDER BY g.grn_date DESC, g.id DESC`;

      const rows = await query(sql, { companyId, branchId, grn_type, status });
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT g.*, s.supplier_name, pc.clearance_no, w.warehouse_name
        FROM inv_goods_receipt_notes g
        JOIN pur_suppliers s ON s.id = g.supplier_id
        LEFT JOIN pur_port_clearances pc ON pc.id = g.port_clearance_id
        LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
        WHERE g.id = :id AND g.company_id = :companyId AND g.branch_id = :branchId
        `,
        { id, companyId, branchId },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "GRN not found");

      const details = await query(
        `
        SELECT d.*, i.item_name, i.item_code
        FROM inv_goods_receipt_note_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.grn_id = :id
        `,
        { id },
      );

      res.json({ item: { ...rows[0], details } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureGRNTables();
      await ensureStockBalancesWarehouseInfrastructure();

      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const grnType = body.grn_type || "LOCAL";
      const grnNo =
        body.grn_no || (await nextGRNNo(companyId, branchId, grnType));
      const grnDate = body.grn_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      const poId = toNumber(body.po_id);
      const warehouseId = toNumber(body.warehouse_id);
      const portClearanceId = toNumber(body.port_clearance_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      // Validate PO status if provided
      if (poId) {
        const [po] = await conn.execute(
          "SELECT status FROM pur_orders WHERE id = ? AND company_id = ? AND branch_id = ?",
          [poId, companyId, branchId],
        );
        if (!po.length) throw httpError(404, "NOT_FOUND", "PO not found");
        if (po[0].status !== "APPROVED") {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Purchase Order must be APPROVED to be referenced",
          );
        }
      }

      const details = Array.isArray(body.details) ? body.details : [];
      const cleanDetails = [];

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyReceived = Number(d.qty_received);
        if (!itemId || !Number.isFinite(qtyReceived)) continue;

        cleanDetails.push({
          itemId,
          qtyOrdered: Number(d.qty_ordered) || 0,
          qtyReceived,
          qtyAccepted: Number(d.qty_accepted) || qtyReceived,
          qtyRejected: Number(d.qty_rejected) || 0,
          uom: d.uom || "PCS",
          unitPrice: Number(d.unit_price) || 0,
          lineAmount: Number(d.line_amount) || 0,
          batchNumber: d.batch_serial || null,
          mfgDate: d.mfg_date || null,
          expiryDate: d.expiry_date || null,
          remarks: d.remarks || null,
        });
      }

      await conn.beginTransaction();

      const invoiceAmountFinal =
        body.invoice_amount != null && body.invoice_amount !== ""
          ? Number(body.invoice_amount)
          : null;
      const [resHeader] = await conn.execute(
        `INSERT INTO inv_goods_receipt_notes 
         (company_id, branch_id, grn_no, grn_date, grn_type, po_id, supplier_id, warehouse_id, port_clearance_id,
      invoice_no, invoice_date, invoice_amount, invoice_due_date, bill_of_lading, customs_entry_no, shipping_company, port_of_entry,
      delivery_number, delivery_date,
          status, remarks, created_by)
         VALUES 
         (:companyId, :branchId, :grnNo, :grnDate, :grnType, :poId, :supplierId, :warehouseId, :portClearanceId,
      :invoiceNo, :invoiceDate, :invoiceAmount, :invoiceDueDate, :billOfLading, :customsEntryNo, :shippingCompany, :portOfEntry,
      :deliveryNumber, :deliveryDate,
          'DRAFT', :remarks, :createdBy)`,
        {
          companyId,
          branchId,
          grnNo,
          grnDate,
          grnType,
          poId: poId || null,
          supplierId,
          warehouseId: warehouseId || null,
          portClearanceId: portClearanceId || null,
          invoiceNo: body.invoice_no || null,
          invoiceDate: body.invoice_date || null,
          invoiceAmount: invoiceAmountFinal,
          invoiceDueDate: body.invoice_due_date || null,
          billOfLading: body.bill_of_lading || null,
          customsEntryNo: body.customs_entry_no || null,
          shippingCompany: body.shipping_company || null,
          portOfEntry: body.port_of_entry || null,
          deliveryNumber: body.delivery_number || null,
          deliveryDate: body.delivery_date || null,
          remarks: body.remarks || null,
          createdBy: req.user.sub,
        },
      );
      const grnId = resHeader.insertId;

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
       (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount, batch_number, mfg_date, expiry_date, remarks)
           VALUES
       (:grnId, :itemId, :qtyOrdered, :qtyReceived, :qtyAccepted, :qtyRejected, :uom, :unitPrice, :lineAmount, :batchNumber, :mfgDate, :expiryDate, :remarks)`,
          { grnId, ...d },
        );
      }

      await conn.commit();
      res.status(201).json({ id: grnId, grn_no: grnNo });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureGRNTables();
      await ensureStockBalancesWarehouseInfrastructure();

      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      const body = req.body || {};

      const grnDate = body.grn_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      const poId = toNumber(body.po_id);
      const warehouseId = toNumber(body.warehouse_id);
      const portClearanceId = toNumber(body.port_clearance_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const [existing] = await conn.execute(
        "SELECT status FROM inv_goods_receipt_notes WHERE id = ? AND company_id = ? AND branch_id = ?",
        [id, companyId, branchId],
      );
      if (!existing.length) throw httpError(404, "NOT_FOUND", "GRN not found");
      if (existing[0].status !== "DRAFT") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Only DRAFT GRNs can be updated",
        );
      }

      // Validate PO status if provided
      if (poId) {
        const [po] = await conn.execute(
          "SELECT status FROM pur_orders WHERE id = ? AND company_id = ? AND branch_id = ?",
          [poId, companyId, branchId],
        );
        if (!po.length) throw httpError(404, "NOT_FOUND", "PO not found");
        if (po[0].status !== "APPROVED") {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Purchase Order must be APPROVED to be referenced",
          );
        }
      }

      const details = Array.isArray(body.details) ? body.details : [];
      const cleanDetails = [];

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyReceived = Number(d.qty_received);
        if (!itemId || !Number.isFinite(qtyReceived)) continue;

        cleanDetails.push({
          itemId,
          qtyOrdered: Number(d.qty_ordered) || 0,
          qtyReceived,
          qtyAccepted: Number(d.qty_accepted) || qtyReceived,
          qtyRejected: Number(d.qty_rejected) || 0,
          uom: d.uom || "PCS",
          unitPrice: Number(d.unit_price) || 0,
          lineAmount: Number(d.line_amount) || 0,
          batchNumber: d.batch_serial || null,
          mfgDate: d.mfg_date || null,
          expiryDate: d.expiry_date || null,
          remarks: d.remarks || null,
        });
      }

      await conn.beginTransaction();

      await conn.execute(
        `UPDATE inv_goods_receipt_notes SET
           grn_date = :grnDate,
           supplier_id = :supplierId,
           po_id = :poId,
           warehouse_id = :warehouseId,
           port_clearance_id = :portClearanceId,
           invoice_no = :invoiceNo,
           invoice_date = :invoiceDate,
       invoice_amount = :invoiceAmount,
           invoice_due_date = :invoiceDueDate,
           bill_of_lading = :billOfLading,
           customs_entry_no = :customsEntryNo,
           shipping_company = :shippingCompany,
           port_of_entry = :portOfEntry,
       delivery_number = :deliveryNumber,
       delivery_date = :deliveryDate,
           remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          grnDate,
          supplierId,
          poId: poId || null,
          warehouseId: warehouseId || null,
          portClearanceId: portClearanceId || null,
          invoiceNo: body.invoice_no || null,
          invoiceDate: body.invoice_date || null,
          invoiceAmount:
            body.invoice_amount != null && body.invoice_amount !== ""
              ? Number(body.invoice_amount)
              : null,
          invoiceDueDate: body.invoice_due_date || null,
          billOfLading: body.bill_of_lading || null,
          customsEntryNo: body.customs_entry_no || null,
          shippingCompany: body.shipping_company || null,
          portOfEntry: body.port_of_entry || null,
          deliveryNumber: body.delivery_number || null,
          deliveryDate: body.delivery_date || null,
          remarks: body.remarks || null,
        },
      );

      const prev = await conn.execute(
        `SELECT item_id, SUM(qty_accepted) AS qty
         FROM inv_goods_receipt_note_details
         WHERE grn_id = ?
         GROUP BY item_id`,
        [id],
      );
      const prevMap = new Map();
      // execute returns [rows, fields], so prev[0] is rows
      if (Array.isArray(prev[0])) {
        prev[0].forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      }

      const newMap = new Map();
      await conn.execute(
        "DELETE FROM inv_goods_receipt_note_details WHERE grn_id = ?",
        [id],
      );
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
       (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount, batch_number, mfg_date, expiry_date, remarks)
           VALUES
       (:grnId, :itemId, :qtyOrdered, :qtyReceived, :qtyAccepted, :qtyRejected, :uom, :unitPrice, :lineAmount, :batchNumber, :mfgDate, :expiryDate, :remarks)`,
          { grnId: id, ...d },
        );
        newMap.set(
          d.itemId,
          Number(newMap.get(d.itemId) || 0) + Number(d.qtyAccepted),
        );
      }

      const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
      for (const itemId of keys) {
        const before = Number(prevMap.get(itemId) || 0);
        const after = Number(newMap.get(itemId) || 0);
        const delta = after - before;
        // Stock balances are updated upon approval, not during draft updates.
      }

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

router.post(
  "/stock-adjustments/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.ADJUSTMENT.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/stock-adjustments";

      const wfByRoute = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND document_route = :docRouteBase
        ORDER BY id ASC
        `,
        { companyId, docRouteBase },
      );
      const wfDefs = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND (document_type = 'STOCK_ADJUSTMENT' OR document_type = 'Stock Adjustment')
        ORDER BY id ASC
        `,
        { companyId },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (document_type = 'STOCK_ADJUSTMENT' OR document_type = 'Stock Adjustment')
           LIMIT 1`,
          { wfId: workflowIdOverride, companyId },
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
      if (activeWf) {
        const steps = await query(
          `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
          { wf: activeWf.id },
        );
        if (!steps.length)
          throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
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
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
          assignedToUserId = Number(targetUserIdRaw);
        } else if (allowedUsers.length > 0) {
          assignedToUserId = Number(allowedUsers[0].approver_user_id);
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
            amount: amount === null ? null : Number(amount),
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
        );
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
            actor: req.user.sub,
            comments: "",
          },
        );
        await query(
          `UPDATE inv_stock_adjustments SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId,
            userId: assignedToUserId,
            title: "Approval Required",
            message: await (async () => {
              const rows = await query(
                `SELECT adjustment_no FROM inv_stock_adjustments WHERE id = :id AND company_id = :companyId LIMIT 1`,
                { id, companyId },
              );
              const docNo = rows.length ? rows[0].adjustment_no : null;
              const countRows = await query(
                `SELECT COUNT(*) AS c FROM inv_stock_adjustment_details WHERE adjustment_id = :id`,
                { id },
              );
              const itemCount = Number(countRows?.[0]?.c || 0);
              return docNo
                ? `Stock Adjustment ${docNo} (${itemCount} items) requires your approval`
                : `Stock Adjustment #${id} (${itemCount} items) requires your approval`;
            })(),
            link: `/administration/workflows/approvals/${instanceId}`,
          },
        );
        const emailRes = await query(
          "SELECT email FROM adm_users WHERE id = :id",
          {
            id: assignedToUserId,
          },
        );
        if (emailRes.length && emailRes[0].email) {
          const to = emailRes[0].email;
          const subject = "Approval Required";
          const text = `Stock Adjustment #${id} requires your approval. View: ${req.protocol}://${req.headers.host}/administration/workflows/approvals/${instanceId}`;
          const html = `<p>Stock Adjustment #${id} requires your approval.</p><p><a href="/administration/workflows/approvals/${instanceId}">Open Approval</a></p>`;
          if (isMailerConfigured()) {
            try {
              await sendMail({ to, subject, text, html });
            } catch (e) {
              console.log(`[EMAIL ERROR] ${e?.message || e}`);
            }
          } else {
            console.log(
              `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`,
            );
          }
        }
        res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
        return;
      }
      let behavior = null;
      if (wfDefs.length) {
        const firstWf = wfDefs[0];
        if (Number(firstWf.is_active) === 0) {
          behavior = firstWf.default_behavior || null;
          if (!behavior) {
            behavior = "AUTO_APPROVE";
          }
        }
      }
      if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        res.json({ status: "APPROVED" });
        return;
      }
      await query(
        `UPDATE inv_stock_adjustments SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/uoms",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.VIEW"),
  inventoryController.listUoms,
);

router.get(
  "/items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.VIEW"),
  inventoryController.listItems,
);

router.post(
  "/stock-balances/bulk-upload",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.ADJUSTMENT.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
    } catch {}
    return inventoryController.bulkUpdateStockBalances(req, res, next);
  },
);

router.get(
  "/items/next-code",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  inventoryController.getNextItemCode,
);

router.get(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.VIEW"),
  inventoryController.getItemById,
);

router.get(
  "/warehouses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.WAREHOUSES.VIEW"),
  inventoryController.listWarehouses,
);

router.get(
  "/warehouses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.WAREHOUSES.VIEW"),
  inventoryController.getWarehouseById,
);

router.post(
  "/warehouses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.WAREHOUSES.MANAGE"),
  inventoryController.createWarehouse,
);

router.put(
  "/warehouses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.WAREHOUSES.MANAGE"),
  inventoryController.updateWarehouse,
);

router.put(
  "/warehouses/:id/link-branch",
  requireAuth,
  requireCompanyScope,
  requirePermission("INV.WAREHOUSES.MANAGE"),
  inventoryController.linkWarehouseBranch,
);

router.post(
  "/items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  inventoryController.createItem,
);

router.post(
  "/items/bulk",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  inventoryController.bulkUpsertItems,
);

router.put(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  inventoryController.updateItem,
);

router.get(
  "/item-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.GROUPS.VIEW"),
  inventoryController.listItemGroups,
);

router.get(
  "/item-groups/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.GROUPS.VIEW"),
  inventoryController.getItemGroupById,
);

router.post(
  "/item-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.GROUPS.MANAGE"),
  inventoryController.createItemGroup,
);

router.put(
  "/item-groups/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.GROUPS.MANAGE"),
  inventoryController.updateItemGroup,
);

router.get(
  "/item-categories",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.CATEGORIES.VIEW"),
  inventoryController.listItemCategories,
);

router.get(
  "/item-categories/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.CATEGORIES.VIEW"),
  inventoryController.getItemCategoryById,
);

router.post(
  "/item-categories",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.CATEGORIES.MANAGE"),
  inventoryController.createItemCategory,
);

router.put(
  "/item-categories/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.CATEGORIES.MANAGE"),
  inventoryController.updateItemCategory,
);

router.delete(
  "/item-categories/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.CATEGORIES.MANAGE"),
  inventoryController.deleteItemCategory,
);

router.get(
  "/item-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.TYPES.VIEW"),
  inventoryController.listItemTypes,
);

router.get(
  "/item-types/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.TYPES.VIEW"),
  inventoryController.getItemTypeById,
);

router.post(
  "/item-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.TYPES.MANAGE"),
  inventoryController.createItemType,
);

router.put(
  "/item-types/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.TYPES.MANAGE"),
  inventoryController.updateItemType,
);

router.delete(
  "/item-types/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEM.TYPES.MANAGE"),
  inventoryController.deleteItemType,
);

router.get(
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.UNIT.CONVERSION.VIEW"),
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      await inventoryController.listUnitConversions(req, res, next);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/unit-conversions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.UNIT.CONVERSION.VIEW"),
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      await inventoryController.getUnitConversionById(req, res, next);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.UNIT.CONVERSION.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      await inventoryController.createUnitConversion(req, res, next);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/unit-conversions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.UNIT.CONVERSION.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      await inventoryController.updateUnitConversion(req, res, next);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/uoms",
  requireAuth,
  requireCompanyScope,
  requirePermission("INV.UOM.VIEW"),
  inventoryController.listUoms,
);

router.post(
  "/uoms",
  requireAuth,
  requireCompanyScope,
  requirePermission("INV.UOM.MANAGE"),
  inventoryController.createUom,
);

router.put(
  "/uoms/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("INV.UOM.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const uomCode = String(body.uom_code || "").trim();
      const uomName = String(body.uom_name || "").trim();
      const uomType = String(body.uom_type || "COUNT").trim();
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!uomCode || !uomName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "uom_code and uom_name are required",
        );
      }

      const [upd] = await pool.execute(
        `
        UPDATE inv_uoms
        SET uom_code = :uomCode,
            uom_name = :uomName,
            uom_type = :uomType,
            is_active = :isActive
        WHERE id = :id AND company_id = :companyId
        `,
        { id, companyId, uomCode, uomName, uomType, isActive },
      );

      if (!upd.affectedRows) throw httpError(404, "NOT_FOUND", "UOM not found");

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/uoms/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("INV.UOM.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [del] = await pool.execute(
        `DELETE FROM inv_uoms WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );

      if (!del.affectedRows) throw httpError(404, "NOT_FOUND", "UOM not found");

      res.json({ ok: true });
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete UOM because it is in use.",
          ),
        );
      }
      next(err);
    }
  },
);

router.put(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};

      const itemCode = String(body.item_code || "").trim();
      const itemName = String(body.item_name || "").trim();
      const uom = String(body.uom || "PCS").trim() || "PCS";
      const barcode = body.barcode ? String(body.barcode).trim() : null;
      const costPrice = Number(body.cost_price || 0);
      const sellingPrice = Number(body.selling_price || 0);
      const currencyId = toNumber(body.currency_id);
      const priceTypeId = toNumber(body.price_type_id);
      const imageUrl = body.image_url ? String(body.image_url).trim() : null;
      const vatOnPurchaseId = toNumber(body.vat_on_purchase_id);
      const vatOnSalesId = toNumber(body.vat_on_sales_id);
      const purchaseAccountId = toNumber(body.purchase_account_id);
      const salesAccountId = toNumber(body.sales_account_id);
      const isActive =
        body.is_active === undefined ? 1 : Number(Boolean(body.is_active));

      if (!itemCode || !itemName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_code and item_name are required",
        );
      }

      const [upd] = await pool.execute(
        `
        UPDATE inv_items
        SET item_code = :itemCode,
            item_name = :itemName,
            uom = :uom,
            barcode = :barcode,
            cost_price = :costPrice,
            selling_price = :sellingPrice,
            currency_id = :currencyId,
            price_type_id = :priceTypeId,
            image_url = :imageUrl,
            vat_on_purchase_id = :vatOnPurchaseId,
            vat_on_sales_id = :vatOnSalesId,
            purchase_account_id = :purchaseAccountId,
            sales_account_id = :salesAccountId,
            is_active = :isActive
        WHERE id = :id AND company_id = :companyId
        `,
        {
          id,
          companyId,
          itemCode,
          itemName,
          uom,
          barcode,
          costPrice,
          sellingPrice,
          currencyId: currencyId || null,
          priceTypeId: priceTypeId || null,
          imageUrl,
          vatOnPurchaseId: vatOnPurchaseId || null,
          vatOnSalesId: vatOnSalesId || null,
          purchaseAccountId: purchaseAccountId || null,
          salesAccountId: salesAccountId || null,
          isActive,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item not found");

      res.json({ ok: true });
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
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT r.id,
               r.requisition_no,
               r.requisition_date,
               r.requisition_type,
               r.priority,
               r.requested_by,
               r.status,
               w.warehouse_name,
               d.name as department_name,
               COUNT(rd.id) AS item_count
        FROM inv_material_requisitions r
        LEFT JOIN inv_material_requisition_details rd ON rd.requisition_id = r.id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments d ON d.id = r.department_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        GROUP BY r.id
        ORDER BY r.requisition_date DESC, r.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
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
        SELECT r.*, w.warehouse_name, d.name as department_name
        FROM inv_material_requisitions r
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments d ON d.id = r.department_id
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
        body.requisition_no || (await nextRequisitionNo(companyId, branchId));
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

      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalancesWarehouseInfrastructure();
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_material_requisitions
          (company_id, branch_id, requisition_no, requisition_date, warehouse_id, department_id, requisition_type, priority, requested_by, remarks, status, created_by)
        VALUES
          (:companyId, :branchId, :requisitionNo, :requisitionDate, :warehouseId, :departmentId, :requisitionType, :priority, :requestedBy, :remarks, :status, :createdBy)
        `,
        {
          companyId,
          branchId,
          requisitionNo,
          requisitionDate: toDateOnly(requisitionDate),
          warehouseId,
          departmentId,
          requisitionType,
          priority,
          requestedBy,
          remarks,
          status,
          createdBy,
        },
      );
      const requisitionId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued)
          VALUES (:requisitionId, :itemId, :qtyRequested, :qtyIssued)
          `,
          { requisitionId, itemId, qtyRequested, qtyIssued },
        );
      }

      await conn.commit();
      res
        .status(201)
        .json({ id: requisitionId, requisition_no: requisitionNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
          id,
          companyId,
          branchId,
          requisitionDate: toDateOnly(requisitionDate),
          warehouseId,
          departmentId,
          requisitionType,
          priority,
          requestedBy,
          remarks,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Material requisition not found");

      await conn.execute(
        `DELETE FROM inv_material_requisition_details WHERE requisition_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued)
          VALUES (:id, :itemId, :qtyRequested, :qtyIssued)
          `,
          { id, itemId, qtyRequested, qtyIssued },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
        { companyId, docRouteBase },
      );
      const wfDefs = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
        ORDER BY id ASC
        `,
        { companyId },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
           LIMIT 1`,
          { wfId: workflowIdOverride, companyId },
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
      if (activeWf) {
        const steps = await query(
          `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
          { wf: activeWf.id },
        );
        if (!steps.length)
          throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
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
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
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
            companyId,
            workflowId: activeWf.id,
            documentId: id,
            amount: amount === null ? null : Number(amount),
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
            (:companyId, :workflowId, :dwId, :documentId, 'MATERIAL_REQUISITION', :stepOrder, :assignedTo, 'PENDING')
          `,
          {
            companyId,
            workflowId: activeWf.id,
            dwId: instanceId,
            documentId: id,
            stepOrder: first.step_order,
            assignedTo: assignedToUserId,
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
            dwId: instanceId,
            stepOrder: first.step_order,
            actor: req.user.sub,
            comments: "",
          },
        );
        await query(
          `UPDATE inv_material_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId,
            userId: assignedToUserId,
            title: "Approval Required",
            message: await (async () => {
              const rows = await query(
                `SELECT requisition_no FROM inv_material_requisitions WHERE id = :id AND company_id = :companyId LIMIT 1`,
                { id, companyId },
              );
              const docNo = rows.length ? rows[0].requisition_no : null;
              let countRows = await query(
                `SELECT COUNT(*) AS c FROM inv_material_requisition_details WHERE requisition_id = :id`,
                { id },
              );
              const itemCount = Number(countRows?.[0]?.c || 0);
              return docNo
                ? `Material Requisition ${docNo} (${itemCount} items) requires your approval`
                : `Material Requisition #${id} (${itemCount} items) requires your approval`;
            })(),
            link: `/administration/workflows/approvals/${instanceId}`,
          },
        );
        const emailRes = await query(
          "SELECT email FROM adm_users WHERE id = :id",
          {
            id: assignedToUserId,
          },
        );
        if (emailRes.length && emailRes[0].email) {
          const to = emailRes[0].email;
          const subject = "Approval Required";
          const text = `Material Requisition #${id} requires your approval. View: ${req.protocol}://${req.headers.host}/administration/workflows/approvals/${instanceId}`;
          const html = `<p>Material Requisition #${id} requires your approval.</p><p><a href="/administration/workflows/approvals/${instanceId}">Open Approval</a></p>`;
          if (isMailerConfigured()) {
            try {
              await sendMail({ to, subject, text, html });
            } catch (e) {
              console.log(`[EMAIL ERROR] ${e?.message || e}`);
            }
          } else {
            console.log(
              `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`,
            );
          }
        }
        res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
        return;
      }
      let behavior = null;
      if (wfDefs.length) {
        const firstWf = wfDefs[0];
        if (Number(firstWf.is_active) === 0) {
          behavior = firstWf.default_behavior || null;
          if (!behavior) {
            behavior = "AUTO_APPROVE";
          }
        }
      }
      if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
        await query(
          `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        res.json({ status: "APPROVED" });
        return;
      }
      await query(
        `UPDATE inv_material_requisitions SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ status: "SUBMITTED" });
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
  requirePermission("INV.RETURN_TO_STORES.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureReturnToStoresInfrastructure();
      const rows = await query(
        `
        SELECT r.id,
               r.rts_no,
               r.rts_date,
               r.warehouse_id,
               w.warehouse_name,
               r.department_id,
               dept.name as department_name,
               r.return_type,
               r.status,
               COUNT(d.id) AS item_count
        FROM inv_return_to_stores r
        LEFT JOIN inv_return_to_stores_details d ON d.rts_id = r.id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments dept ON dept.id = r.department_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        GROUP BY r.id
        ORDER BY r.rts_date DESC, r.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
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
  requirePermission("INV.RETURN_TO_STORES.MANAGE"),
  async (req, res, next) => {
    try {
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
      const { companyId } = req.scope;
      await ensureStockTransferTables();
      const nextNo = await nextTransferNo(companyId);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/return-to-stores/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.RETURN_TO_STORES.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/return-to-stores";

      const wfByRoute = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND document_route = :docRouteBase
        ORDER BY id ASC
        `,
        { companyId, docRouteBase },
      );
      const wfDefs = await query(
        `
        SELECT *
        FROM adm_workflows
        WHERE company_id = :companyId
          AND (document_type = 'RETURN_TO_STORES' OR document_type = 'Return to Stores')
        ORDER BY id ASC
        `,
        { companyId },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (document_type = 'RETURN_TO_STORES' OR document_type = 'Return to Stores')
           LIMIT 1`,
          { wfId: workflowIdOverride, companyId },
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
      if (activeWf) {
        const steps = await query(
          `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
          { wf: activeWf.id },
        );
        if (!steps.length)
          throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
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
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
          assignedToUserId = Number(targetUserIdRaw);
        } else if (allowedUsers.length > 0) {
          assignedToUserId = Number(allowedUsers[0].approver_user_id);
        }
        const dwRes = await query(
          `
          INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'RETURN_TO_STORES', :amount, :stepOrder, 'PENDING', :assignedTo)
          `,
          {
            companyId,
            workflowId: activeWf.id,
            documentId: id,
            amount: amount === null ? null : Number(amount),
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
            (:companyId, :workflowId, :dwId, :documentId, 'RETURN_TO_STORES', :stepOrder, :assignedTo, 'PENDING')
          `,
          {
            companyId,
            workflowId: activeWf.id,
            dwId: instanceId,
            documentId: id,
            stepOrder: first.step_order,
            assignedTo: assignedToUserId,
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
            dwId: instanceId,
            stepOrder: first.step_order,
            actor: req.user.sub,
            comments: "",
          },
        );
        await query(
          `UPDATE inv_return_to_stores SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId,
            userId: assignedToUserId,
            title: "Approval Required",
            message: await (async () => {
              const rows = await query(
                `SELECT rts_no FROM inv_return_to_stores WHERE id = :id AND company_id = :companyId LIMIT 1`,
                { id, companyId },
              );
              const docNo = rows.length ? rows[0].rts_no : null;
              const countRows = await query(
                `SELECT COUNT(*) AS c FROM inv_return_to_stores_details WHERE rts_id = :id`,
                { id },
              );
              const itemCount = Number(countRows?.[0]?.c || 0);
              return docNo
                ? `Return to Stores ${docNo} (${itemCount} items) requires your approval`
                : `Return to Stores #${id} (${itemCount} items) requires your approval`;
            })(),
            link: `/administration/workflows/approvals/${instanceId}`,
          },
        );
        const emailRes = await query(
          "SELECT email FROM adm_users WHERE id = :id",
          {
            id: assignedToUserId,
          },
        );
        if (emailRes.length && emailRes[0].email) {
          const to = emailRes[0].email;
          const subject = "Approval Required";
          const text = `Return to Stores #${id} requires your approval. View: ${req.protocol}://${req.headers.host}/administration/workflows/approvals/${instanceId}`;
          const html = `<p>Return to Stores #${id} requires your approval.</p><p><a href="/administration/workflows/approvals/${instanceId}">Open Approval</a></p>`;
          if (isMailerConfigured()) {
            try {
              await sendMail({ to, subject, text, html });
            } catch (e) {
              console.log(`[EMAIL ERROR] ${e?.message || e}`);
            }
          } else {
            console.log(
              `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`,
            );
          }
        }
        res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
        return;
      }
      let behavior = null;
      if (wfDefs.length) {
        const firstWf = wfDefs[0];
        if (Number(firstWf.is_active) === 0) {
          behavior = firstWf.default_behavior || null;
          if (!behavior) {
            behavior = "AUTO_APPROVE";
          }
        }
      }
      if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
        await query(
          `UPDATE inv_return_to_stores SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
          { id, companyId },
        );
        res.json({ status: "APPROVED" });
        return;
      }
      await query(
        `UPDATE inv_return_to_stores SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-to-stores/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.RETURN_TO_STORES.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureReturnToStoresInfrastructure();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT r.*
        FROM inv_return_to_stores r
        WHERE r.id = :id AND r.company_id = :companyId AND r.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Return to stores not found");

      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               i.uom,
               d.qty_returned,
               d.reason,
               d.condition,
               d.batch_serial,
               d.location,
               d.remarks
        FROM inv_return_to_stores_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.rts_id = :id
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

router.post(
  "/return-to-stores",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.RETURN_TO_STORES.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      await ensureReturnToStoresInfrastructure();
      const body = req.body || {};

      const rtsNo = body.rts_no || (await nextReturnNo(companyId, branchId));
      const rtsDate = toDateOnly(body.rts_date);
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const returnType = body.return_type || "EXCESS";
      const requisitionId = toNumber(body.requisition_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!rtsDate)
        throw httpError(400, "VALIDATION_ERROR", "rts_date is required");

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_return_to_stores
          (company_id, branch_id, rts_no, rts_date, warehouse_id, department_id, return_type, requisition_id, status, remarks, created_by)
        VALUES
          (:companyId, :branchId, :rtsNo, :rtsDate, :warehouseId, :departmentId, :returnType, :requisitionId, :status, :remarks, :createdBy)
        `,
        {
          companyId,
          branchId,
          rtsNo,
          rtsDate,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          returnType,
          requisitionId: requisitionId || null,
          status,
          remarks,
          createdBy,
        },
      );
      const rtsId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyReturned = Number(d.qty_returned);
        const reason = d.reason ? String(d.reason) : null;
        const condition = d.condition ? String(d.condition) : "GOOD";
        const batchSerial = d.batch_serial ? String(d.batch_serial) : null;
        const location = d.location ? String(d.location) : null;
        const remarks = d.remarks ? String(d.remarks) : null;

        if (!itemId || !Number.isFinite(qtyReturned)) continue;
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details (rts_id, item_id, qty_returned, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:rtsId, :itemId, :qtyReturned, :reason, :condition, :batchSerial, :location, :remarks)
          `,
          {
            rtsId,
            itemId,
            qtyReturned,
            reason,
            condition,
            batchSerial,
            location,
            remarks,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyReturned)
           ON DUPLICATE KEY UPDATE qty = qty + :qtyReturned`,
          { companyId, branchId, warehouseId, itemId, qtyReturned },
        );
      }

      await conn.commit();
      res.status(201).json({ id: rtsId, rts_no: rtsNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
  requirePermission("INV.RETURN_TO_STORES.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      await ensureReturnToStoresInfrastructure();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const rtsDate = toDateOnly(body.rts_date);
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const returnType = body.return_type || "EXCESS";
      const requisitionId = toNumber(body.requisition_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!rtsDate)
        throw httpError(400, "VALIDATION_ERROR", "rts_date is required");

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_return_to_stores
        SET rts_date = :rtsDate,
            warehouse_id = :warehouseId,
            department_id = :departmentId,
            return_type = :returnType,
            requisition_id = :requisitionId,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          rtsDate,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          returnType,
          requisitionId: requisitionId || null,
          status,
          remarks,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Return to stores not found");

      const prev = await query(
        `SELECT item_id, SUM(qty_returned) AS qty FROM inv_return_to_stores_details WHERE rts_id = :id GROUP BY item_id`,
        { id },
      );
      const prevMap = new Map();
      prev.forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      const newMap = new Map();
      await conn.execute(
        `DELETE FROM inv_return_to_stores_details WHERE rts_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyReturned = Number(d.qty_returned);
        const reason = d.reason ? String(d.reason) : null;
        const condition = d.condition ? String(d.condition) : "GOOD";
        const batchSerial = d.batch_serial ? String(d.batch_serial) : null;
        const location = d.location ? String(d.location) : null;
        const remarks = d.remarks ? String(d.remarks) : null;

        if (!itemId || !Number.isFinite(qtyReturned)) continue;
        newMap.set(
          itemId,
          Number(newMap.get(itemId) || 0) + Number(qtyReturned),
        );
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details (rts_id, item_id, qty_returned, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:id, :itemId, :qtyReturned, :reason, :condition, :batchSerial, :location, :remarks)
          `,
          {
            id,
            itemId,
            qtyReturned,
            reason,
            condition,
            batchSerial,
            location,
            remarks,
          },
        );
      }
      const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
      for (const itemId of keys) {
        const before = Number(prevMap.get(itemId) || 0);
        const after = Number(newMap.get(itemId) || 0);
        const delta = after - before;
        if (delta !== 0) {
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :delta)
             ON DUPLICATE KEY UPDATE qty = qty + :delta`,
            { companyId, branchId, warehouseId, itemId, delta },
          );
        }
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ISSUE_TO_REQUIREMENT.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureIssueDepartmentInfrastructure();
      const rows = await query(
        `
        SELECT h.id,
               h.issue_no,
               h.issue_date,
               h.warehouse_id,
               w.warehouse_name,
               h.issued_to,
               h.department_id,
               dept.name as department_name,
               h.issue_type,
               h.status,
               COUNT(d.id) AS item_count
        FROM inv_issue_to_requirement h
        LEFT JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
        LEFT JOIN inv_warehouses w ON w.id = h.warehouse_id
        LEFT JOIN adm_departments dept ON dept.id = h.department_id
        WHERE h.company_id = :companyId AND h.branch_id = :branchId
        GROUP BY h.id
        ORDER BY h.issue_date DESC, h.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ISSUE_TO_REQUIREMENT.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureIssueDepartmentInfrastructure();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT h.*
        FROM inv_issue_to_requirement h
        WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Issue to requirement not found");

      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               d.qty_issued,
               d.uom,
               d.batch_number,
               d.serial_number
        FROM inv_issue_to_requirement_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.issue_id = :id
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

router.post(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ISSUE_TO_REQUIREMENT.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureIssueDepartmentInfrastructure();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const issueNo = body.issue_no || (await nextIssueNo(companyId, branchId));
      const issueDate = toDateOnly(body.issue_date);
      const warehouseId = toNumber(body.warehouse_id);
      const issuedTo = body.issued_to || null;
      const departmentId = toNumber(body.department_id);
      const issueType = body.issue_type || "GENERAL";
      const requisitionId = toNumber(body.requisition_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!issueDate)
        throw httpError(400, "VALIDATION_ERROR", "issue_date is required");

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_issue_to_requirement
          (company_id, branch_id, issue_no, issue_date, warehouse_id, issued_to, department_id, issue_type, requisition_id, status, remarks, created_by)
        VALUES
          (:companyId, :branchId, :issueNo, :issueDate, :warehouseId, :issuedTo, :departmentId, :issueType, :requisitionId, :status, :remarks, :createdBy)
        `,
        {
          companyId,
          branchId,
          issueNo,
          issueDate,
          warehouseId: warehouseId || null,
          issuedTo,
          departmentId: departmentId || null,
          issueType,
          requisitionId: requisitionId || null,
          status,
          remarks,
          createdBy,
        },
      );
      const issueId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyIssued = Number(d.qty_issued);
        const uom = d.uom || "PCS";
        const batchNumber = d.batch_number || null;
        const serialNumber = d.serial_number || null;

        if (!itemId || !Number.isFinite(qtyIssued)) continue;
        await conn.execute(
          `
          INSERT INTO inv_issue_to_requirement_details (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
          VALUES (:issueId, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
          `,
          { issueId, itemId, qtyIssued, uom, batchNumber, serialNumber },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, -:qtyIssued)
           ON DUPLICATE KEY UPDATE qty = qty - :qtyIssued`,
          { companyId, branchId, warehouseId, itemId, qtyIssued },
        );
      }

      await conn.commit();
      res.status(201).json({ id: issueId, issue_no: issueNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ISSUE_TO_REQUIREMENT.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureIssueDepartmentInfrastructure();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const issueDate = toDateOnly(body.issue_date);
      const warehouseId = toNumber(body.warehouse_id);
      const issuedTo = body.issued_to || null;
      const departmentId = toNumber(body.department_id);
      const issueType = body.issue_type || "GENERAL";
      const requisitionId = toNumber(body.requisition_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!issueDate)
        throw httpError(400, "VALIDATION_ERROR", "issue_date is required");

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_issue_to_requirement
        SET issue_date = :issueDate,
            warehouse_id = :warehouseId,
            issued_to = :issuedTo,
            department_id = :departmentId,
            issue_type = :issueType,
            requisition_id = :requisitionId,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          issueDate,
          warehouseId: warehouseId || null,
          issuedTo,
          departmentId: departmentId || null,
          issueType,
          requisitionId: requisitionId || null,
          status,
          remarks,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Issue to requirement not found");

      const prev = await query(
        `SELECT item_id, SUM(qty_issued) AS qty FROM inv_issue_to_requirement_details WHERE issue_id = :id GROUP BY item_id`,
        { id },
      );
      const prevMap = new Map();
      prev.forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      const newMap = new Map();
      await conn.execute(
        `DELETE FROM inv_issue_to_requirement_details WHERE issue_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyIssued = Number(d.qty_issued);
        const uom = d.uom || "PCS";
        const batchNumber = d.batch_number || null;
        const serialNumber = d.serial_number || null;

        if (!itemId || !Number.isFinite(qtyIssued)) continue;
        newMap.set(itemId, Number(newMap.get(itemId) || 0) + Number(qtyIssued));
        await conn.execute(
          `
          INSERT INTO inv_issue_to_requirement_details (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
          VALUES (:id, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
          `,
          { id, itemId, qtyIssued, uom, batchNumber, serialNumber },
        );
      }
      const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
      for (const itemId of keys) {
        const before = Number(prevMap.get(itemId) || 0);
        const after = Number(newMap.get(itemId) || 0);
        const diff = after - before;
        if (diff !== 0) {
          const delta = -diff;
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :delta)
             ON DUPLICATE KEY UPDATE qty = qty + :delta`,
            { companyId, branchId, warehouseId, itemId, delta },
          );
        }
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.ADJUSTMENT.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureStockAdjustmentsInfrastructure();
      const rows = await query(
        `
        SELECT a.id,
               a.adjustment_no,
               a.adjustment_date,
               a.adjustment_type,
               a.warehouse_id,
               w.warehouse_name,
               a.start_date,
               a.end_date,
               a.status,
               COUNT(d.id) AS item_count
        FROM inv_stock_adjustments a
        LEFT JOIN inv_stock_adjustment_details d ON d.adjustment_id = a.id
        LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        WHERE a.company_id = :companyId AND a.branch_id = :branchId
        GROUP BY a.id, w.warehouse_name
        ORDER BY a.adjustment_date DESC, a.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock-adjustments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.ADJUSTMENT.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensureStockAdjustmentsInfrastructure();

      const rows = await query(
        `
        SELECT a.*, w.warehouse_name
        FROM inv_stock_adjustments a
        LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Stock adjustment not found");

      const details = await query(
        `
        SELECT d.id, d.item_id, i.item_code, i.item_name, d.qty, d.current_stock, d.adjusted_stock, d.unit_cost, d.remarks
        FROM inv_stock_adjustment_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.adjustment_id = :id
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

router.get(
  "/stock-adjustments/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.ADJUSTMENT.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureStockAdjustmentsInfrastructure();
      const nextNo = await nextStockUpdateNo(companyId, branchId);
      res.json({ next_no: nextNo });
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
  requirePermission("INV.STOCK.ADJUSTMENT.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const adjustmentNo =
        body.adjustment_no || (await nextStockUpdateNo(companyId, branchId));
      const adjustmentDate = body.adjustment_date;
      const warehouseId = toNumber(body.warehouse_id);
      const adjustmentType = body.adjustment_type;
      const startDate = body.start_date || null;
      const endDate = body.end_date || null;
      const referenceDoc = body.reference_doc
        ? String(body.reference_doc).trim()
        : null;
      const reason = body.reason || null;
      const status = body.status || "DRAFT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!adjustmentDate || !adjustmentType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "adjustment_date and adjustment_type are required",
        );
      }

      await ensureStockAdjustmentsInfrastructure();
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_adjustments
          (company_id, branch_id, adjustment_no, adjustment_date, warehouse_id, adjustment_type, start_date, end_date, reference_doc, reason, status, created_by)
        VALUES
          (:companyId, :branchId, :adjustmentNo, :adjustmentDate, :warehouseId, :adjustmentType, :startDate, :endDate, :referenceDoc, :reason, :status, :createdBy)
        `,
        {
          companyId,
          branchId,
          adjustmentNo,
          adjustmentDate,
          warehouseId: warehouseId || null,
          adjustmentType,
          startDate,
          endDate,
          referenceDoc,
          reason,
          status,
          createdBy,
        },
      );

      const adjustmentId = hdr.insertId;
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const currentStock = Number(d.current_stock || 0);
        const adjustedStock = Number(d.adjusted_stock || 0);
        const unitCost = Number(d.unit_cost || 0);
        const remarks = d.remarks ? String(d.remarks) : null;

        if (!itemId || !Number.isFinite(qty)) continue;
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details (adjustment_id, item_id, qty, current_stock, adjusted_stock, unit_cost, remarks)
          VALUES (:adjustmentId, :itemId, :qty, :currentStock, :adjustedStock, :unitCost, :remarks)
          `,
          {
            adjustmentId,
            itemId,
            qty,
            currentStock,
            adjustedStock,
            unitCost,
            remarks,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
           ON DUPLICATE KEY UPDATE qty = qty + :qty`,
          { companyId, branchId, warehouseId, itemId, qty },
        );
      }

      await conn.commit();
      res.status(201).json({ id: adjustmentId, adjustment_no: adjustmentNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TAKE.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockTakeTables();
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT t.id,
               t.stock_take_no,
               t.stock_take_date,
               t.warehouse_id,
               w.warehouse_name,
               t.status
        FROM inv_stock_takes t
        LEFT JOIN inv_warehouses w ON w.id = t.warehouse_id
        WHERE t.company_id = :companyId AND t.branch_id = :branchId
        ORDER BY t.stock_take_date DESC, t.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock-takes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TAKE.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockTakeTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT t.*
        FROM inv_stock_takes t
        WHERE t.id = :id AND t.company_id = :companyId AND t.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Stock take not found");

      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               d.system_qty,
               d.physical_qty,
               d.variance_qty
        FROM inv_stock_take_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.stock_take_id = :id
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

router.post(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TAKE.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTakeTables();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const stockTakeNo = body.stock_take_no || nextDocNo("STK");
      const stockTakeDate = body.stock_take_date;
      const warehouseId = toNumber(body.warehouse_id);
      const status = body.status || "DRAFT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!stockTakeDate)
        throw httpError(400, "VALIDATION_ERROR", "stock_take_date is required");

      await conn.beginTransaction();

      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_takes
          (company_id, branch_id, stock_take_no, stock_take_date, warehouse_id, status, created_by)
        VALUES
          (:companyId, :branchId, :stockTakeNo, :stockTakeDate, :warehouseId, :status, :createdBy)
        `,
        {
          companyId,
          branchId,
          stockTakeNo,
          stockTakeDate,
          warehouseId: warehouseId || null,
          status,
          createdBy,
        },
      );
      const stockTakeId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const physicalQty = Number(d.physical_qty);
        if (!itemId || !Number.isFinite(physicalQty)) continue;
        const systemQty = Number(d.system_qty);
        const safeSystemQty = Number.isFinite(systemQty) ? systemQty : 0;
        const varianceQty = Number.isFinite(Number(d.variance_qty))
          ? Number(d.variance_qty)
          : physicalQty - safeSystemQty;

        await conn.execute(
          `
          INSERT INTO inv_stock_take_details
            (stock_take_id, item_id, system_qty, physical_qty, variance_qty)
          VALUES
            (:stockTakeId, :itemId, :systemQty, :physicalQty, :varianceQty)
          `,
          {
            stockTakeId,
            itemId,
            systemQty: safeSystemQty,
            physicalQty,
            varianceQty,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: stockTakeId, stock_take_no: stockTakeNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
  requirePermission("INV.STOCK.TAKE.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTakeTables();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const stockTakeDate = body.stock_take_date;
      const warehouseId = toNumber(body.warehouse_id);
      const status = body.status || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      if (!stockTakeDate)
        throw httpError(400, "VALIDATION_ERROR", "stock_take_date is required");

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_takes
        SET stock_take_date = :stockTakeDate,
            warehouse_id = :warehouseId,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          stockTakeDate,
          warehouseId: warehouseId || null,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Stock take not found");

      await conn.execute(
        `DELETE FROM inv_stock_take_details WHERE stock_take_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const physicalQty = Number(d.physical_qty);
        if (!itemId || !Number.isFinite(physicalQty)) continue;
        const systemQty = Number(d.system_qty);
        const safeSystemQty = Number.isFinite(systemQty) ? systemQty : 0;
        const varianceQty = Number.isFinite(Number(d.variance_qty))
          ? Number(d.variance_qty)
          : physicalQty - safeSystemQty;

        await conn.execute(
          `
          INSERT INTO inv_stock_take_details
            (stock_take_id, item_id, system_qty, physical_qty, variance_qty)
          VALUES
            (:id, :itemId, :systemQty, :physicalQty, :varianceQty)
          `,
          {
            id,
            itemId,
            systemQty: safeSystemQty,
            physicalQty,
            varianceQty,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
  requirePermission("INV.STOCK.ADJUSTMENT.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const adjustmentDate = body.adjustment_date;
      const warehouseId = toNumber(body.warehouse_id);
      const adjustmentType = body.adjustment_type;
      const startDate = body.start_date || null;
      const endDate = body.end_date || null;
      const referenceDoc = body.reference_doc
        ? String(body.reference_doc).trim()
        : null;
      const reason = body.reason || null;
      const status = body.status || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();

      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_adjustments
        SET adjustment_date = :adjustmentDate,
            warehouse_id = :warehouseId,
            adjustment_type = :adjustmentType,
            start_date = :startDate,
            end_date = :endDate,
            reference_doc = :referenceDoc,
            reason = :reason,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          adjustmentDate,
          warehouseId: warehouseId || null,
          adjustmentType,
          startDate,
          endDate,
          referenceDoc,
          reason,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Stock adjustment not found");

      const prev = await query(
        `SELECT item_id, SUM(qty) AS qty FROM inv_stock_adjustment_details WHERE adjustment_id = :id GROUP BY item_id`,
        { id },
      );
      const prevMap = new Map();
      prev.forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      const newMap = new Map();
      await conn.execute(
        `DELETE FROM inv_stock_adjustment_details WHERE adjustment_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const currentStock = Number(d.current_stock || 0);
        const adjustedStock = Number(d.adjusted_stock || 0);
        const unitCost = Number(d.unit_cost || 0);
        const remarks = d.remarks ? String(d.remarks) : null;

        if (!itemId || !Number.isFinite(qty)) continue;
        newMap.set(itemId, Number(newMap.get(itemId) || 0) + Number(qty));
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details (adjustment_id, item_id, qty, current_stock, adjusted_stock, unit_cost, remarks)
          VALUES (:id, :itemId, :qty, :currentStock, :adjustedStock, :unitCost, :remarks)
          `,
          { id, itemId, qty, currentStock, adjustedStock, unitCost, remarks },
        );
      }
      const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
      for (const itemId of keys) {
        const before = Number(prevMap.get(itemId) || 0);
        const after = Number(newMap.get(itemId) || 0);
        const delta = after - before;
        if (delta !== 0) {
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :delta)
             ON DUPLICATE KEY UPDATE qty = qty + :delta`,
            { companyId, branchId, warehouseId, itemId, delta },
          );
        }
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const rows = await query(
        `
        SELECT t.id,
               t.transfer_no,
               t.transfer_date,
               t.transfer_type,
               fb.name AS from_branch,
               tb.name AS to_branch,
               t.status,
               COUNT(d.id) AS item_count
        FROM inv_stock_transfers t
        JOIN adm_branches fb ON fb.id = t.from_branch_id
        JOIN adm_branches tb ON tb.id = t.to_branch_id
        LEFT JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
        WHERE t.company_id = :companyId
        GROUP BY t.id
        ORDER BY t.transfer_date DESC, t.id DESC
        `,
        { companyId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock-transfers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT t.*
        FROM inv_stock_transfers t
        WHERE t.id = :id AND t.company_id = :companyId
        LIMIT 1
        `,
        { id, companyId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Stock transfer not found");

      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               d.qty,
               d.batch_number,
               d.remarks,
               d.received_qty,
               d.accepted_qty,
               d.rejected_qty,
               d.acceptance_remarks,
               COALESCE(sr.qty_reserved, 0) AS remaining_qty
        FROM inv_stock_transfer_details d
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_stock_reserves sr
               ON sr.transfer_id = d.transfer_id
              AND sr.item_id = d.item_id
        WHERE d.transfer_id = :id
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

router.post(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureTransferWarehouseColumns();
      await ensureStockReserveTable();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId } = req.scope;
      const body = req.body || {};

      const transferNo = body.transfer_no || (await nextTransferNo(companyId));
      const transferDate = body.transfer_date;
      const fromBranchId = toNumber(body.from_branch_id);
      const toBranchId = toNumber(body.to_branch_id);
      const fromWarehouseId = toNumber(body.from_warehouse_id);
      const toWarehouseId = toNumber(body.to_warehouse_id);
      const remarks = body.remarks || null;
      const status = "IN_TRANSIT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      const transferType = body.transfer_type || "Inter-Branch";
      const deliveryDate = body.delivery_date || null;
      const vehicleNo = body.vehicle_no || null;
      const driverName = body.driver_name || null;
      const contactNumber = body.contact_number || null;

      if (!transferDate || !fromBranchId || !toBranchId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "transfer_date, from_branch_id, to_branch_id are required",
        );
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_transfers
          (company_id, transfer_no, transfer_date, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, status, remarks, created_by,
           transfer_type, delivery_date, vehicle_no, driver_name, contact_number)
        VALUES
          (:companyId, :transferNo, :transferDate, :fromBranchId, :toBranchId, :fromWarehouseId, :toWarehouseId, :status, :remarks, :createdBy,
           :transferType, :deliveryDate, :vehicleNo, :driverName, :contactNumber)
        `,
        {
          companyId,
          transferNo,
          transferDate: toDateOnly(transferDate),
          fromBranchId,
          toBranchId,
          fromWarehouseId: fromWarehouseId || null,
          toWarehouseId: toWarehouseId || null,
          status,
          remarks,
          createdBy,
          transferType,
          deliveryDate: toDateOnly(deliveryDate),
          vehicleNo,
          driverName,
          contactNumber,
        },
      );
      const transferId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const batchNumber = d.batch_number || null;
        const itemRemarks = d.remarks || null;

        if (!itemId || !Number.isFinite(qty)) continue;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details (transfer_id, item_id, qty, batch_number, remarks)
          VALUES (:transferId, :itemId, :qty, :batchNumber, :itemRemarks)
          `,
          { transferId, itemId, qty, batchNumber, itemRemarks },
        );
        await conn.execute(
          `
          INSERT INTO inv_stock_reserves
            (company_id, transfer_id, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, item_id, qty_reserved, status)
          VALUES
            (:companyId, :transferId, :fromBranchId, :toBranchId, :fromWarehouseId, :toWarehouseId, :itemId, :qtyReserved, 'IN_TRANSIT')
          `,
          {
            companyId,
            transferId,
            fromBranchId,
            toBranchId,
            fromWarehouseId: fromWarehouseId || null,
            toWarehouseId: toWarehouseId || null,
            itemId,
            qtyReserved: qty,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :fromBranchId, :fromWarehouseId, :itemId, -:qty)
           ON DUPLICATE KEY UPDATE qty = qty - :qty`,
          { companyId, fromBranchId, fromWarehouseId, itemId, qty },
        );
      }

      await conn.commit();
      res.status(201).json({ id: transferId, transfer_no: transferNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
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
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const transferDate = body.transfer_date;
      const fromBranchId = toNumber(body.from_branch_id);
      const toBranchId = toNumber(body.to_branch_id);
      const remarks = body.remarks || null;
      const status = body.status || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      const transferType = body.transfer_type || "Inter-Branch";
      const deliveryDate = body.delivery_date || null;
      const vehicleNo = body.vehicle_no || null;
      const driverName = body.driver_name || null;
      const contactNumber = body.contact_number || null;

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_transfers
        SET transfer_date = :transferDate,
            from_branch_id = :fromBranchId,
            to_branch_id = :toBranchId,
            remarks = :remarks,
            status = :status,
            transfer_type = :transferType,
            delivery_date = :deliveryDate,
            vehicle_no = :vehicleNo,
            driver_name = :driverName,
            contact_number = :contactNumber
        WHERE id = :id AND company_id = :companyId
        `,
        {
          id,
          companyId,
          transferDate: toDateOnly(transferDate),
          fromBranchId,
          toBranchId,
          remarks,
          status,
          transferType,
          deliveryDate: toDateOnly(deliveryDate),
          vehicleNo,
          driverName,
          contactNumber,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Stock transfer not found");

      await conn.execute(
        `DELETE FROM inv_stock_transfer_details WHERE transfer_id = :id`,
        { id },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const batchNumber = d.batch_number || null;
        const itemRemarks = d.remarks || null;

        if (!itemId || !Number.isFinite(qty)) continue;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details (transfer_id, item_id, qty, batch_number, remarks)
          VALUES (:id, :itemId, :qty, :batchNumber, :itemRemarks)
          `,
          { id, itemId, qty, batchNumber, itemRemarks },
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/transfer-acceptance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const status = String(req.query.status || "")
        .trim()
        .toUpperCase();
      const statusFilter = status ? status : "IN_TRANSIT";

      const rows = await query(
        `
        SELECT t.id,
               t.transfer_no,
               t.transfer_date,
               t.from_branch_id,
               fb.name AS from_branch_name,
               t.from_warehouse_id,
               fw.warehouse_name AS from_warehouse_name,
               t.to_branch_id,
               tb.name AS to_branch_name,
               t.to_warehouse_id,
               tw.warehouse_name AS to_warehouse_name,
               t.status
        FROM inv_stock_transfers t
        JOIN adm_branches fb ON fb.id = t.from_branch_id
        JOIN adm_branches tb ON tb.id = t.to_branch_id
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.company_id = :companyId
          AND t.to_branch_id = :branchId
          AND (:statusFilter IS NULL OR t.status = :statusFilter)
        ORDER BY t.transfer_date DESC, t.id DESC
        `,
        { companyId, branchId, statusFilter: statusFilter || null },
      );

      res.json({ items: rows });
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
  requirePermission("INV.STOCK.TRANSFER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT t.*,
               fb.name AS from_branch_name,
               tb.name AS to_branch_name,
               fw.warehouse_name AS from_warehouse_name,
               tw.warehouse_name AS to_warehouse_name
        FROM inv_stock_transfers t
        JOIN adm_branches fb ON fb.id = t.from_branch_id
        JOIN adm_branches tb ON tb.id = t.to_branch_id
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.id = :id
          AND t.company_id = :companyId
          AND t.to_branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Stock transfer not found");

      const details = await query(
        `
        SELECT d.id, d.item_id, i.item_code, i.item_name, d.qty,
               d.batch_number, d.remarks,
               d.received_qty, d.accepted_qty, d.rejected_qty, d.acceptance_remarks
        FROM inv_stock_transfer_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.transfer_id = :id
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

router.put(
  "/transfer-acceptance/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockReserveTable();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const receivedDate = body.received_date || new Date();
      const receivedBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      const hdrRows = await query(
        `
        SELECT from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, status
        FROM inv_stock_transfers
        WHERE id = :id AND company_id = :companyId AND to_branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdrRows.length)
        throw httpError(404, "NOT_FOUND", "Transfer not found for acceptance");
      const fromBranchId = Number(hdrRows[0].from_branch_id);
      const toBranchId = Number(hdrRows[0].to_branch_id);
      const fromWarehouseId = hdrRows[0].from_warehouse_id
        ? Number(hdrRows[0].from_warehouse_id)
        : null;
      const toWarehouseId = hdrRows[0].to_warehouse_id
        ? Number(hdrRows[0].to_warehouse_id)
        : null;
      const currentStatus = String(hdrRows[0].status || "");
      if (currentStatus === "RECEIVED") {
        throw httpError(
          400,
          "INVALID_STATE",
          "Transfer is already fully received",
        );
      }

      await conn.beginTransaction();

      const [updHdr] = await conn.execute(
        `
        UPDATE inv_stock_transfers
        SET received_date = :receivedDate,
            received_by = :receivedBy
        WHERE id = :id
          AND company_id = :companyId
          AND to_branch_id = :branchId
          AND status IN ('IN_TRANSIT','PARTIALLY_RECEIVED')
        `,
        { id, companyId, branchId, receivedDate, receivedBy },
      );
      if (!updHdr.affectedRows && currentStatus !== "PARTIALLY_RECEIVED") {
        throw httpError(
          400,
          "INVALID_STATE",
          "Transfer is not available for acceptance or already received",
        );
      }

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const receivedQtyWanted = Number(d.received_qty) || 0;
        const acceptedQtyWanted = Number(d.accepted_qty) || 0;
        const rejectedQtyWanted = Number(d.rejected_qty) || 0;
        const acceptanceRemarks = d.acceptance_remarks || null;

        if (itemId) {
          const [resRows] = await conn.execute(
            `
            SELECT qty_reserved
            FROM inv_stock_reserves
            WHERE company_id = :companyId AND transfer_id = :id AND item_id = :itemId
            LIMIT 1
            `,
            { companyId, id, itemId },
          );
          const remainingRes = Number(resRows?.[0]?.qty_reserved || 0);
          let acceptedQty = Math.max(
            0,
            Math.min(acceptedQtyWanted || receivedQtyWanted, remainingRes),
          );
          let rejectedQty = Math.max(
            0,
            Math.min(
              rejectedQtyWanted,
              Math.max(0, remainingRes - acceptedQty),
            ),
          );
          const processedQty = acceptedQty + rejectedQty;
          if (processedQty <= 0) {
            continue;
          }
          await conn.execute(
            `
                UPDATE inv_stock_transfer_details
                SET received_qty = COALESCE(received_qty, 0) + :processedQty,
                    accepted_qty = COALESCE(accepted_qty, 0) + :acceptedQty,
                    rejected_qty = COALESCE(rejected_qty, 0) + :rejectedQty,
                    acceptance_remarks = :acceptanceRemarks
                WHERE transfer_id = :id AND item_id = :itemId
            `,
            {
              id,
              itemId,
              processedQty,
              acceptedQty,
              rejectedQty,
              acceptanceRemarks,
            },
          );

          if (acceptedQty > 0) {
            await conn.execute(
              `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                VALUES (:companyId, :toBranchId, :toWarehouseId, :itemId, :acceptedQty)
                ON DUPLICATE KEY UPDATE qty = qty + :acceptedQty`,
              { companyId, toBranchId, toWarehouseId, itemId, acceptedQty },
            );
          }
          if (rejectedQty > 0) {
            await conn.execute(
              `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
                VALUES (:companyId, :fromBranchId, :fromWarehouseId, :itemId, :rejectedQty)
                ON DUPLICATE KEY UPDATE qty = qty + :rejectedQty`,
              { companyId, fromBranchId, fromWarehouseId, itemId, rejectedQty },
            );
          }
          const totalProcessed = acceptedQty + rejectedQty;
          if (totalProcessed > 0) {
            await conn.execute(
              `
              UPDATE inv_stock_reserves
              SET qty_reserved = GREATEST(qty_reserved - :totalProcessed, 0),
                  status = CASE WHEN qty_reserved - :totalProcessed <= 0 THEN 'RECEIVED' ELSE status END
              WHERE company_id = :companyId AND transfer_id = :id AND item_id = :itemId
              `,
              { companyId, id, itemId, totalProcessed },
            );
          }
        }
      }

      const [remRows] = await conn.execute(
        `
        SELECT SUM(qty_reserved) AS total_remaining
        FROM inv_stock_reserves
        WHERE company_id = :companyId AND transfer_id = :id
        `,
        { companyId, id },
      );
      const totalRemaining = Number(remRows?.[0]?.total_remaining || 0);
      const finalStatus =
        totalRemaining > 0 ? "PARTIALLY_RECEIVED" : "RECEIVED";
      await conn.execute(
        `
        UPDATE inv_stock_transfers
        SET status = :finalStatus
        WHERE id = :id AND company_id = :companyId AND to_branch_id = :branchId
        `,
        { finalStatus, id, companyId, branchId },
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

router.get(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureGRNTables();
      const grnType = String(req.query.grn_type || "")
        .trim()
        .toUpperCase();
      const typeFilter =
        grnType === "LOCAL" || grnType === "IMPORT" ? grnType : null;

      const rows = await query(
        `
        SELECT g.id,
               g.grn_no,
               g.grn_date,
               g.grn_type,
               g.status,
               g.remarks,
               g.supplier_id,
               s.supplier_name,
               g.warehouse_id,
               w.warehouse_name
        FROM inv_goods_receipt_notes g
        JOIN pur_suppliers s ON s.id = g.supplier_id
        LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
        WHERE g.company_id = :companyId
          AND g.branch_id = :branchId
          AND (:typeFilter IS NULL OR g.grn_type = :typeFilter)
        ORDER BY g.grn_date DESC, g.id DESC
        `,
        { companyId, branchId, typeFilter },
      );

      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT g.*
        FROM inv_goods_receipt_notes g
        WHERE g.id = :id AND g.company_id = :companyId AND g.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "GRN not found");

      const details = await query(
        `
        SELECT d.id, d.item_id, i.item_code, i.item_name, d.qty_ordered, d.qty_received
        FROM inv_goods_receipt_note_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.grn_id = :id
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

router.get(
  "/grn/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const type = String(req.query.type || "LOCAL").toUpperCase();
      await ensureGRNTables();
      const nextNo = await nextGRNNo(companyId, branchId, type);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const grnType = String(body.grn_type || "LOCAL")
        .trim()
        .toUpperCase();
      const grnNo =
        body.grn_no || (await nextGRNNo(companyId, branchId, grnType));
      const grnDate = body.grn_date;
      const poId = toNumber(body.po_id);
      const supplierId = toNumber(body.supplier_id);
      const warehouseId = toNumber(body.warehouse_id);
      const portClearanceId = toNumber(body.port_clearance_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!grnDate || !supplierId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_date and supplier_id are required",
        );
      }
      if (grnType !== "LOCAL" && grnType !== "IMPORT") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_type must be LOCAL or IMPORT",
        );
      }

      const normalizedDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyOrdered = Number(d.qty_ordered);
        const qtyReceived = Number(d.qty_received);
        if (
          !itemId ||
          !Number.isFinite(qtyOrdered) ||
          !Number.isFinite(qtyReceived)
        )
          continue;
        normalizedDetails.push({ itemId, qtyOrdered, qtyReceived });
      }

      await ensureGRNTables();
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_goods_receipt_notes
          (company_id, branch_id, grn_no, grn_date, grn_type, po_id, supplier_id, warehouse_id, port_clearance_id, status, remarks, created_by)
        VALUES
          (:companyId, :branchId, :grnNo, :grnDate, :grnType, :poId, :supplierId, :warehouseId, :portClearanceId, :status, :remarks, :createdBy)
        `,
        {
          companyId,
          branchId,
          grnNo,
          grnDate,
          grnType,
          poId,
          supplierId,
          warehouseId,
          portClearanceId,
          status,
          remarks,
          createdBy,
        },
      );

      const grnId = hdr.insertId;
      for (const nd of normalizedDetails) {
        await conn.execute(
          `
          INSERT INTO inv_goods_receipt_note_details
            (grn_id, item_id, qty_ordered, qty_received)
          VALUES
            (:grnId, :itemId, :qtyOrdered, :qtyReceived)
          `,
          {
            grnId,
            itemId: nd.itemId,
            qtyOrdered: nd.qtyOrdered,
            qtyReceived: nd.qtyReceived,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyReceived)
           ON DUPLICATE KEY UPDATE qty = qty + :qtyReceived`,
          {
            companyId,
            branchId,
            warehouseId,
            itemId: nd.itemId,
            qtyReceived: nd.qtyReceived,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: grnId, grn_no: grnNo });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};

      const grnDate = body.grn_date;
      const grnType = String(body.grn_type || "LOCAL")
        .trim()
        .toUpperCase();
      const poId = toNumber(body.po_id);
      const supplierId = toNumber(body.supplier_id);
      const warehouseId = toNumber(body.warehouse_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!grnDate || !supplierId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_date and supplier_id are required",
        );
      }
      if (grnType !== "LOCAL" && grnType !== "IMPORT") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_type must be LOCAL or IMPORT",
        );
      }

      const normalizedDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyOrdered = Number(d.qty_ordered);
        const qtyReceived = Number(d.qty_received);
        if (
          !itemId ||
          !Number.isFinite(qtyOrdered) ||
          !Number.isFinite(qtyReceived)
        )
          continue;
        normalizedDetails.push({ itemId, qtyOrdered, qtyReceived });
      }

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_goods_receipt_notes
        SET grn_date = :grnDate,
            grn_type = :grnType,
            po_id = :poId,
            supplier_id = :supplierId,
            warehouse_id = :warehouseId,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          grnDate,
          grnType,
          poId,
          supplierId,
          warehouseId,
          status,
          remarks,
        },
      );
      if (!upd.affectedRows) throw httpError(404, "NOT_FOUND", "GRN not found");

      await conn.execute(
        `DELETE FROM inv_goods_receipt_note_details WHERE grn_id = :id`,
        { id },
      );
      const prev = await query(
        `SELECT item_id, SUM(qty_received) AS qty FROM inv_goods_receipt_note_details WHERE grn_id = :id GROUP BY item_id`,
        { id },
      );
      const prevMap = new Map();
      prev.forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      const newMap = new Map();
      for (const nd of normalizedDetails) {
        newMap.set(
          nd.itemId,
          Number(newMap.get(nd.itemId) || 0) + Number(nd.qtyReceived),
        );
        await conn.execute(
          `
          INSERT INTO inv_goods_receipt_note_details
            (grn_id, item_id, qty_ordered, qty_received)
          VALUES
            (:id, :itemId, :qtyOrdered, :qtyReceived)
          `,
          {
            id,
            itemId: nd.itemId,
            qtyOrdered: nd.qtyOrdered,
            qtyReceived: nd.qtyReceived,
          },
        );
      }
      const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
      for (const itemId of keys) {
        const before = Number(prevMap.get(itemId) || 0);
        const after = Number(newMap.get(itemId) || 0);
        const delta = after - before;
        if (delta !== 0) {
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :delta)
             ON DUPLICATE KEY UPDATE qty = qty + :delta`,
            { companyId, branchId, warehouseId, itemId, delta },
          );
        }
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/service-confirmations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.SERVICE_CONFIRMATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT c.id,
               c.sc_no,
               c.sc_date,
               c.status,
               c.total_amount,
               s.supplier_name
        FROM inv_service_confirmations c
        JOIN pur_suppliers s ON s.id = c.supplier_id
        WHERE c.company_id = :companyId
          AND c.branch_id = :branchId
        ORDER BY c.sc_date DESC, c.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-confirmations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.SERVICE_CONFIRMATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT c.*
        FROM inv_service_confirmations c
        WHERE c.id = :id AND c.company_id = :companyId AND c.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Service confirmation not found");

      const details = await query(
        `
        SELECT d.id, d.description, d.qty, d.unit_price, d.line_total
        FROM inv_service_confirmation_details d
        WHERE d.confirmation_id = :id
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

router.post(
  "/service-confirmations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.SERVICE_CONFIRMATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      const scNo = body.sc_no || nextDocNo("SC");
      const scDate = body.sc_date;
      const supplierId = toNumber(body.supplier_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!scDate || !supplierId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "sc_date and supplier_id are required",
        );
      }

      let totalAmount = 0;
      const normalizedDetails = [];
      for (const d of details) {
        const description = String(d.description || "").trim();
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (
          !description ||
          !Number.isFinite(qty) ||
          !Number.isFinite(unitPrice)
        )
          continue;
        const lineTotal = Number.isFinite(Number(d.line_total))
          ? Number(d.line_total)
          : qty * unitPrice;
        totalAmount += lineTotal;
        normalizedDetails.push({ description, qty, unitPrice, lineTotal });
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_service_confirmations
          (company_id, branch_id, sc_no, sc_date, supplier_id, total_amount, status, remarks, created_by)
        VALUES
          (:companyId, :branchId, :scNo, :scDate, :supplierId, :totalAmount, :status, :remarks, :createdBy)
        `,
        {
          companyId,
          branchId,
          scNo,
          scDate,
          supplierId,
          totalAmount,
          status,
          remarks,
          createdBy,
        },
      );

      const confirmationId = hdr.insertId;
      for (const nd of normalizedDetails) {
        await conn.execute(
          `
          INSERT INTO inv_service_confirmation_details
            (confirmation_id, description, qty, unit_price, line_total)
          VALUES
            (:confirmationId, :description, :qty, :unitPrice, :lineTotal)
          `,
          {
            confirmationId,
            description: nd.description,
            qty: nd.qty,
            unitPrice: nd.unitPrice,
            lineTotal: nd.lineTotal,
          },
        );
      }

      await conn.commit();
      res
        .status(201)
        .json({ id: confirmationId, sc_no: scNo, total_amount: totalAmount });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/service-confirmations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.SERVICE_CONFIRMATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};

      const scDate = body.sc_date;
      const supplierId = toNumber(body.supplier_id);
      const status = body.status || "DRAFT";
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!scDate || !supplierId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "sc_date and supplier_id are required",
        );
      }

      let totalAmount = 0;
      const normalizedDetails = [];
      for (const d of details) {
        const description = String(d.description || "").trim();
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (
          !description ||
          !Number.isFinite(qty) ||
          !Number.isFinite(unitPrice)
        )
          continue;
        const lineTotal = Number.isFinite(Number(d.line_total))
          ? Number(d.line_total)
          : qty * unitPrice;
        totalAmount += lineTotal;
        normalizedDetails.push({ description, qty, unitPrice, lineTotal });
      }

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_service_confirmations
        SET sc_date = :scDate,
            supplier_id = :supplierId,
            total_amount = :totalAmount,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          scDate,
          supplierId,
          totalAmount,
          status,
          remarks,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Service confirmation not found");

      await conn.execute(
        `DELETE FROM inv_service_confirmation_details WHERE confirmation_id = :id`,
        { id },
      );
      for (const nd of normalizedDetails) {
        await conn.execute(
          `
          INSERT INTO inv_service_confirmation_details
            (confirmation_id, description, qty, unit_price, line_total)
          VALUES
            (:id, :description, :qty, :unitPrice, :lineTotal)
          `,
          {
            id,
            description: nd.description,
            qty: nd.qty,
            unitPrice: nd.unitPrice,
            lineTotal: nd.lineTotal,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true, total_amount: totalAmount });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/stock",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  (req, res) => {
    res.json({ items: [] });
  },
);

router.get(
  "/alerts/low-stock",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
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
        LIMIT 50
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/alerts/low-stock/debug",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
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
        ORDER BY i.item_name ASC
        LIMIT 200
        `,
        { companyId, branchId },
      );
      res.json({ items: rows });
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
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const userId = Number(req.user?.sub || req.user?.id);
      const items = await query(
        `
        SELECT 
          i.id, i.item_code, i.item_name, i.uom,
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
        LIMIT 50
        `,
        { companyId, branchId },
      );
      const uRows = await query(
        `SELECT email FROM adm_users WHERE id = :id LIMIT 1`,
        { id: userId },
      );
      const to = uRows.length ? uRows[0].email : null;
      const count = items.length;
      if (count === 0) {
        return res.json({ message: "No low stock items to notify" });
      }
      const subject = `Low Stock Alert (${count} items)`;
      const lines = items
        .slice(0, 20)
        .map(
          (it) =>
            `${it.item_code} ${it.item_name} — qty ${Number(
              it.qty || 0,
            )}, reorder ${Number(it.reorder_level || 0)}`,
        )
        .join("\n");
      const text = `${count} items are at or below reorder levels.\n\n${lines}\n\nOpen: /inventory/alerts/low-stock`;
      const htmlRows = items
        .slice(0, 20)
        .map(
          (it) =>
            `<tr><td>${it.item_code}</td><td>${it.item_name}</td><td style="text-align:right">${Number(
              it.qty || 0,
            )}</td><td style="text-align:right">${Number(
              it.reorder_level || 0,
            )}</td></tr>`,
        )
        .join("");
      const html = `<p>${count} items are at or below reorder levels.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${htmlRows}</tbody></table><p><a href="/inventory/alerts/low-stock">Open Alerts</a></p>`;
      if (to && isMailerConfigured()) {
        try {
          await sendMail({ to, subject, text, html });
        } catch (e) {
          console.log(`[EMAIL ERROR] ${e?.message || e}`);
        }
      } else {
        console.log(
          `[MOCK EMAIL] To: ${to || "(none)"} | Subject: ${subject} | Body: ${text}`,
        );
      }
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId,
          title: "Low Stock Alert",
          message:
            count <= 5
              ? "Items are at or below reorder levels"
              : `${count} items are at or below reorder levels`,
          link: "/inventory/alerts/low-stock",
        },
      );
      res.json({ message: "Notification queued" });
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
  requirePermission("INV.STOCK.VIEW"),
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
      const [rows] = await pool.execute(
        `SELECT qty FROM inv_stock_balances 
         WHERE company_id = :companyId AND branch_id = :branchId AND warehouse_id = :warehouseId AND item_id = :itemId
         LIMIT 1`,
        { companyId, branchId, warehouseId, itemId },
      );
      const qty = Number(rows?.[0]?.qty || 0);
      res.json({ qty });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/health-monitor",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const warehouseId = toNumber(req.query.warehouseId);
      const rawDays = toNumber(req.query.thresholdDays, 30);
      const periodDays =
        Number.isFinite(rawDays) && rawDays > 0
          ? Math.min(365, Math.floor(rawDays))
          : 30;
      const asOfDate = toDateOnly(new Date());
      const params = { companyId, branchId, asOfDate, periodDays };
      let warehouseFilter = "";
      if (warehouseId) {
        params.warehouseId = warehouseId;
        warehouseFilter = " AND warehouse_id = :warehouseId";
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(sb.qty, 0) AS available_qty,
          COALESCE(i.reorder_level, 0) AS reorder_level,
          COALESCE(iss.issued_qty, 0) AS issued_qty,
          CASE 
            WHEN COALESCE(iss.issued_qty, 0) > 0
              THEN ROUND(COALESCE(sb.qty, 0) / (COALESCE(iss.issued_qty, 0) / :periodDays), 2)
            ELSE NULL
          END AS days_of_cover,
          CASE
            WHEN COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0) THEN 'LOW'
            WHEN COALESCE(iss.issued_qty, 0) = 0 THEN 'OK'
            WHEN (COALESCE(sb.qty, 0) / NULLIF(COALESCE(iss.issued_qty, 0) / :periodDays, 0)) < :periodDays THEN 'RISK'
            ELSE 'OK'
          END AS status
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId${warehouseFilter}
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id, SUM(d.qty_issued) AS issued_qty
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId
            AND h.branch_id = :branchId
            AND h.issue_date >= DATE_SUB(:asOfDate, INTERVAL ${periodDays} DAY)
            AND h.issue_date <= :asOfDate
          GROUP BY d.item_id
        ) iss ON iss.item_id = i.id
        WHERE i.company_id = :companyId
        ORDER BY i.item_name ASC
        `,
        params,
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/periodical-stock-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(sb.qty, 0) AS current_qty,
          COALESCE(rec.receipts_qty, 0) AS receipts_qty,
          COALESCE(rec.receipts_from_on, 0) AS receipts_from_on,
          COALESCE(iss.issues_qty, 0) AS issues_qty,
          COALESCE(iss.issues_from_on, 0) AS issues_from_on
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id,
            SUM(CASE WHEN g.grn_date >= :fromDate AND g.grn_date <= :toDate THEN d.qty_accepted ELSE 0 END) AS receipts_qty,
            SUM(CASE WHEN g.grn_date >= :fromDate THEN d.qty_accepted ELSE 0 END) AS receipts_from_on
          FROM inv_goods_receipt_notes g
          JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
          WHERE g.company_id = :companyId AND g.branch_id = :branchId
          GROUP BY d.item_id
        ) rec ON rec.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id,
            SUM(CASE WHEN h.issue_date >= :fromDate AND h.issue_date <= :toDate THEN d.qty_issued ELSE 0 END) AS issues_qty,
            SUM(CASE WHEN h.issue_date >= :fromDate THEN d.qty_issued ELSE 0 END) AS issues_from_on
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId AND h.branch_id = :branchId
          GROUP BY d.item_id
        ) iss ON iss.item_id = i.id
        WHERE i.company_id = :companyId
        ORDER BY i.item_name ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      const items = rows.map((r) => {
        const currentQty = Number(r.current_qty || 0);
        const receiptsFromOn = Number(r.receipts_from_on || 0);
        const issuesFromOn = Number(r.issues_from_on || 0);
        const opening = currentQty - receiptsFromOn + issuesFromOn;
        const receipts = Number(r.receipts_qty || 0);
        const issues = Number(r.issues_qty || 0);
        const closing = opening + receipts - issues;
        return {
          item_id: r.item_id,
          item_code: r.item_code,
          item_name: r.item_name,
          opening_qty: opening,
          receipts_qty: receipts,
          issues_qty: issues,
          closing_qty: closing,
        };
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/periodical-stock-statement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const openingRows = await query(
        `
        SELECT 
          i.id AS item_id,
          COALESCE(sb.qty, 0) AS current_qty,
          COALESCE(rec.receipts_from_on, 0) AS receipts_from_on,
          COALESCE(iss.issues_from_on, 0) AS issues_from_on
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id,
            SUM(CASE WHEN g.grn_date >= :fromDate THEN d.qty_accepted ELSE 0 END) AS receipts_from_on
          FROM inv_goods_receipt_notes g
          JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
          WHERE g.company_id = :companyId AND g.branch_id = :branchId
          GROUP BY d.item_id
        ) rec ON rec.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id,
            SUM(CASE WHEN h.issue_date >= :fromDate THEN d.qty_issued ELSE 0 END) AS issues_from_on
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId AND h.branch_id = :branchId
          GROUP BY d.item_id
        ) iss ON iss.item_id = i.id
        WHERE i.company_id = :companyId
        `,
        { companyId, branchId, fromDate },
      );
      const openingMap = new Map();
      openingRows.forEach((r) => {
        const currentQty = Number(r.current_qty || 0);
        const receiptsFromOn = Number(r.receipts_from_on || 0);
        const issuesFromOn = Number(r.issues_from_on || 0);
        const opening = currentQty - receiptsFromOn + issuesFromOn;
        openingMap.set(Number(r.item_id), opening);
      });
      const movements = await query(
        `
        SELECT 
          m.item_id,
          m.txn_date,
          m.doc_no,
          m.qty_in,
          m.qty_out,
          m.sort_id,
          i.item_code,
          i.item_name
        FROM (
          SELECT d.item_id,
                 g.grn_date AS txn_date,
                 g.grn_no AS doc_no,
                 d.qty_accepted AS qty_in,
                 0 AS qty_out,
                 d.id AS sort_id
          FROM inv_goods_receipt_notes g
          JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
          WHERE g.company_id = :companyId
            AND g.branch_id = :branchId
            AND g.grn_date >= :fromDate
            AND g.grn_date <= :toDate
          UNION ALL
          SELECT d.item_id,
                 h.issue_date AS txn_date,
                 h.issue_no AS doc_no,
                 0 AS qty_in,
                 d.qty_issued AS qty_out,
                 d.id AS sort_id
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId
            AND h.branch_id = :branchId
            AND h.issue_date >= :fromDate
            AND h.issue_date <= :toDate
          UNION ALL
          SELECT d.item_id,
                 t.transfer_date AS txn_date,
                 t.transfer_no AS doc_no,
                 d.qty AS qty_in,
                 0 AS qty_out,
                 d.id AS sort_id
          FROM inv_stock_transfers t
          JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
          WHERE t.company_id = :companyId
            AND t.to_branch_id = :branchId
            AND t.transfer_date >= :fromDate
            AND t.transfer_date <= :toDate
          UNION ALL
          SELECT d.item_id,
                 t.transfer_date AS txn_date,
                 t.transfer_no AS doc_no,
                 0 AS qty_in,
                 d.qty AS qty_out,
                 d.id AS sort_id
          FROM inv_stock_transfers t
          JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
          WHERE t.company_id = :companyId
            AND t.from_branch_id = :branchId
            AND t.transfer_date >= :fromDate
            AND t.transfer_date <= :toDate
        ) m
        JOIN inv_items i ON i.id = m.item_id
        ORDER BY m.txn_date ASC, m.sort_id ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      const running = new Map(openingMap);
      const items = movements.map((r) => {
        const prev = Number(running.get(Number(r.item_id)) || 0);
        const nextBal = prev + Number(r.qty_in || 0) - Number(r.qty_out || 0);
        running.set(Number(r.item_id), nextBal);
        return {
          item_id: r.item_id,
          item_code: r.item_code,
          item_name: r.item_name,
          txn_date: r.txn_date,
          doc_no: r.doc_no,
          qty_in: Number(r.qty_in || 0),
          qty_out: Number(r.qty_out || 0),
          balance_qty: nextBal,
        };
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/issue-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          d.id,
          h.issue_date,
          h.issue_no,
          dept.name AS department_name,
          i.item_code,
          i.item_name,
          d.qty_issued AS qty
        FROM inv_issue_to_requirement h
        JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_departments dept ON dept.id = h.department_id
        WHERE h.company_id = :companyId
          AND h.branch_id = :branchId
          AND h.issue_date >= :fromDate
          AND h.issue_date <= :toDate
        ORDER BY h.issue_date DESC, h.issue_no DESC, d.id ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/stock-transfer-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          d.id,
          t.transfer_date,
          t.transfer_no,
          fw.warehouse_name AS from_warehouse_name,
          tw.warehouse_name AS to_warehouse_name,
          i.item_code,
          i.item_name,
          d.qty
        FROM inv_stock_transfers t
        JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        WHERE t.company_id = :companyId
          AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
          AND t.transfer_date >= :fromDate
          AND t.transfer_date <= :toDate
        ORDER BY t.transfer_date DESC, t.transfer_no DESC, d.id ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockTakeTables();
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          d.id,
          t.stock_take_date AS verify_date,
          t.stock_take_no AS verify_no,
          t.status,
          w.warehouse_name,
          i.item_code,
          i.item_name,
          d.system_qty,
          d.physical_qty,
          d.variance_qty
        FROM inv_stock_takes t
        JOIN inv_stock_take_details d ON d.stock_take_id = t.id
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses w ON w.id = t.warehouse_id
        WHERE t.company_id = :companyId
          AND t.branch_id = :branchId
          AND t.stock_take_date >= :fromDate
          AND t.stock_take_date <= :toDate
        ORDER BY t.stock_take_date DESC, t.stock_take_no DESC, d.id ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/slow-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 90);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(iss.issued_qty, 0) AS issued_qty,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0
              THEN ROUND(COALESCE(iss.issued_qty, 0) / NULLIF(COALESCE(sb.qty, 0), 0), 2)
            ELSE 0
          END AS turnover
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id, SUM(d.qty_issued) AS issued_qty
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId
            AND h.branch_id = :branchId
            AND h.issue_date >= :fromDate
            AND h.issue_date <= :toDate
          GROUP BY d.item_id
        ) iss ON iss.item_id = i.id
        WHERE i.company_id = :companyId
        ORDER BY issued_qty ASC, i.item_name ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/fast-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const toDate = toDateOnly(req.query.to) || toDateOnly(new Date());
      const toDateObj = new Date(toDate);
      const defaultFrom = new Date(toDateObj);
      defaultFrom.setDate(defaultFrom.getDate() - 90);
      const fromDate = toDateOnly(req.query.from) || toDateOnly(defaultFrom);
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(iss.issued_qty, 0) AS issued_qty,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0
              THEN ROUND(COALESCE(iss.issued_qty, 0) / NULLIF(COALESCE(sb.qty, 0), 0), 2)
            ELSE 0
          END AS turnover
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN (
          SELECT d.item_id, SUM(d.qty_issued) AS issued_qty
          FROM inv_issue_to_requirement h
          JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
          WHERE h.company_id = :companyId
            AND h.branch_id = :branchId
            AND h.issue_date >= :fromDate
            AND h.issue_date <= :toDate
          GROUP BY d.item_id
        ) iss ON iss.item_id = i.id
        WHERE i.company_id = :companyId
          AND COALESCE(iss.issued_qty, 0) > 0
        ORDER BY issued_qty DESC, i.item_name ASC
        `,
        { companyId, branchId, fromDate, toDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/non-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const asOfDate = toDateOnly(req.query.asOf) || toDateOnly(new Date());
      const thresholdDays = 90;
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(sb.qty, 0) AS available_qty,
          TIMESTAMPDIFF(
            DAY,
            COALESCE(
              GREATEST(
                COALESCE((
                  SELECT MAX(g.grn_date)
                  FROM inv_goods_receipt_notes g
                  JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                  WHERE g.company_id = :companyId
                    AND g.branch_id = :branchId
                    AND d.item_id = i.id
                ), '1970-01-01'),
                COALESCE((
                  SELECT MAX(h.issue_date)
                  FROM inv_issue_to_requirement h
                  JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                  WHERE h.company_id = :companyId
                    AND h.branch_id = :branchId
                    AND d.item_id = i.id
                ), '1970-01-01'),
                COALESCE((
                  SELECT MAX(t.transfer_date)
                  FROM inv_stock_transfers t
                  JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                  WHERE t.company_id = :companyId
                    AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                    AND d.item_id = i.id
                ), '1970-01-01')
              ),
              '1970-01-01'
            ),
            :asOfDate
          ) AS days_since_last
        FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId AND branch_id = :branchId
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        WHERE i.company_id = :companyId
          AND COALESCE(sb.qty, 0) > 0
        HAVING days_since_last >= :thresholdDays
        ORDER BY days_since_last DESC, i.item_name ASC
        `,
        { companyId, branchId, asOfDate, thresholdDays },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/stock-aging-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const asOfRaw = req.query.asOf;
      const asOfDate = toDateOnly(asOfRaw) || toDateOnly(new Date());
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(sb.qty, 0) AS available_qty,
          TIMESTAMPDIFF(
            DAY,
            COALESCE(
              GREATEST(
                COALESCE((
                  SELECT MAX(g.grn_date)
                  FROM inv_goods_receipt_notes g
                  JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                  WHERE g.company_id = :companyId
                    AND g.branch_id = :branchId
                    AND d.item_id = i.id
                ), '1970-01-01'),
                COALESCE((
                  SELECT MAX(h.issue_date)
                  FROM inv_issue_to_requirement h
                  JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                  WHERE h.company_id = :companyId
                    AND h.branch_id = :branchId
                    AND d.item_id = i.id
                ), '1970-01-01'),
                COALESCE((
                  SELECT MAX(t.transfer_date)
                  FROM inv_stock_transfers t
                  JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                  WHERE t.company_id = :companyId
                    AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                    AND d.item_id = i.id
                ), '1970-01-01')
              ),
              '1970-01-01'
            ),
            :asOfDate
          ) AS age_days,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0 AND TIMESTAMPDIFF(
              DAY,
              COALESCE(
                GREATEST(
                  COALESCE((
                    SELECT MAX(g.grn_date)
                    FROM inv_goods_receipt_notes g
                    JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                    WHERE g.company_id = :companyId
                      AND g.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(h.issue_date)
                    FROM inv_issue_to_requirement h
                    JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                    WHERE h.company_id = :companyId
                      AND h.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(t.transfer_date)
                    FROM inv_stock_transfers t
                    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                    WHERE t.company_id = :companyId
                      AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                      AND d.item_id = i.id
                  ), '1970-01-01')
                ),
                '1970-01-01'
              ),
              :asOfDate
            ) BETWEEN 0 AND 30 
            THEN COALESCE(sb.qty, 0) ELSE 0 
          END AS bucket_0_30,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0 AND TIMESTAMPDIFF(
              DAY,
              COALESCE(
                GREATEST(
                  COALESCE((
                    SELECT MAX(g.grn_date)
                    FROM inv_goods_receipt_notes g
                    JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                    WHERE g.company_id = :companyId
                      AND g.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(h.issue_date)
                    FROM inv_issue_to_requirement h
                    JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                    WHERE h.company_id = :companyId
                      AND h.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(t.transfer_date)
                    FROM inv_stock_transfers t
                    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                    WHERE t.company_id = :companyId
                      AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                      AND d.item_id = i.id
                  ), '1970-01-01')
                ),
                '1970-01-01'
              ),
              :asOfDate
            ) BETWEEN 31 AND 60 
            THEN COALESCE(sb.qty, 0) ELSE 0 
          END AS bucket_31_60,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0 AND TIMESTAMPDIFF(
              DAY,
              COALESCE(
                GREATEST(
                  COALESCE((
                    SELECT MAX(g.grn_date)
                    FROM inv_goods_receipt_notes g
                    JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                    WHERE g.company_id = :companyId
                      AND g.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(h.issue_date)
                    FROM inv_issue_to_requirement h
                    JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                    WHERE h.company_id = :companyId
                      AND h.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(t.transfer_date)
                    FROM inv_stock_transfers t
                    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                    WHERE t.company_id = :companyId
                      AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                      AND d.item_id = i.id
                  ), '1970-01-01')
                ),
                '1970-01-01'
              ),
              :asOfDate
            ) BETWEEN 61 AND 90 
            THEN COALESCE(sb.qty, 0) ELSE 0 
          END AS bucket_61_90,
          CASE 
            WHEN COALESCE(sb.qty, 0) > 0 AND TIMESTAMPDIFF(
              DAY,
              COALESCE(
                GREATEST(
                  COALESCE((
                    SELECT MAX(g.grn_date)
                    FROM inv_goods_receipt_notes g
                    JOIN inv_goods_receipt_note_details d ON d.grn_id = g.id
                    WHERE g.company_id = :companyId
                      AND g.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(h.issue_date)
                    FROM inv_issue_to_requirement h
                    JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id
                    WHERE h.company_id = :companyId
                      AND h.branch_id = :branchId
                      AND d.item_id = i.id
                  ), '1970-01-01'),
                  COALESCE((
                    SELECT MAX(t.transfer_date)
                    FROM inv_stock_transfers t
                    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
                    WHERE t.company_id = :companyId
                      AND (t.from_branch_id = :branchId OR t.to_branch_id = :branchId)
                      AND d.item_id = i.id
                  ), '1970-01-01')
                ),
                '1970-01-01'
              ),
              :asOfDate
            ) > 90 
            THEN COALESCE(sb.qty, 0) ELSE 0 
          END AS bucket_90_plus
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
          AND COALESCE(sb.qty, 0) > 0
        ORDER BY i.item_name ASC
        `,
        { companyId, branchId, asOfDate },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

// ==========================================
// Stock Reorder Points
// ==========================================

router.get(
  "/reorder-points",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { warehouseId, status, search } = req.query;

      let sql = `
        SELECT rp.*, 
               i.item_code, i.item_name, i.uom,
               w.warehouse_name,
               s.supplier_name,
               COALESCE(sb.qty, 0) as current_stock
        FROM inv_reorder_points rp
        JOIN inv_items i ON i.id = rp.item_id
        JOIN inv_warehouses w ON w.id = rp.warehouse_id
        LEFT JOIN pur_suppliers s ON s.id = rp.supplier_id
        LEFT JOIN inv_stock_balances sb ON sb.company_id = rp.company_id 
                                       AND sb.branch_id = rp.branch_id 
                                       AND sb.warehouse_id = rp.warehouse_id 
                                       AND sb.item_id = rp.item_id
        WHERE rp.company_id = :companyId AND rp.branch_id = :branchId
      `;

      const params = { companyId, branchId };

      if (warehouseId) {
        sql += " AND rp.warehouse_id = :warehouseId";
        params.warehouseId = warehouseId;
      }

      if (search) {
        sql += " AND (i.item_name LIKE :search OR i.item_code LIKE :search)";
        params.search = `%${search}%`;
      }

      sql += " ORDER BY i.item_name ASC";

      const rows = await query(sql, params);

      // Post-process for status filter
      let items = rows.map((r) => {
        const stock = Number(r.current_stock);
        const min = Number(r.min_stock);
        let stockStatus = "normal";
        if (stock < min) stockStatus = "critical";
        else if (stock < min * 1.2) stockStatus = "low";

        return { ...r, stock_status: stockStatus };
      });

      if (status) {
        items = items.filter((i) => i.stock_status === status);
      }

      res.json({ items });
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
  requirePermission("INV.ITEMS.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body;

      const warehouseId = toNumber(body.warehouse_id);
      const itemId = toNumber(body.item_id);

      if (!warehouseId || !itemId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Warehouse and Item are required",
        );
      }

      await query(
        `INSERT INTO inv_reorder_points 
         (company_id, branch_id, warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, supplier_id, is_active)
         VALUES
         (:companyId, :branchId, :warehouseId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, :supplierId, 1)
         ON DUPLICATE KEY UPDATE
           min_stock = VALUES(min_stock),
           max_stock = VALUES(max_stock),
           reorder_qty = VALUES(reorder_qty),
           lead_time = VALUES(lead_time),
           supplier_id = VALUES(supplier_id)
        `,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          minStock: Number(body.min_stock) || 0,
          maxStock: Number(body.max_stock) || 0,
          reorderQty: Number(body.reorder_qty) || 0,
          leadTime: Number(body.lead_time) || 0,
          supplierId: toNumber(body.supplier_id),
        },
      );

      res.json({ message: "Reorder point saved" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/reorder-points/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.ITEMS.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);

      await query(
        "DELETE FROM inv_reorder_points WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id, companyId, branchId },
      );

      res.json({ message: "Reorder point deleted" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
