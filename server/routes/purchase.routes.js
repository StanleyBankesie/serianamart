import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import {
  requirePermission,
  requireAnyPermission,
} from "../middleware/requirePermission.js";
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  listServiceConfirmations,
  getServiceConfirmationById,
  createServiceConfirmation,
  updateServiceConfirmation,
  listServiceRequests,
  getServiceRequestById,
  getNextServiceRequestNo,
  createServiceRequest,
  updateServiceRequest,
  listServiceBills,
  getServiceBillById,
  getNextServiceBillNo,
  createServiceBill,
  updateServiceBill,
  listShippingAdvices,
  getShippingAdviceById,
  getNextShippingAdviceNo,
  createShippingAdvice,
  updateShippingAdvice,
  listPortClearances,
  getPortClearanceById,
  getNextPortClearanceNo,
  createPortClearance,
  updatePortClearance,
} from "../controllers/purchase.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nextDocNo(prefix) {
  return `${prefix}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${Math.floor(Math.random() * 10000)}`;
}

async function nextServiceExecutionNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT execution_no
    FROM pur_service_executions
    WHERE company_id = :companyId AND branch_id = :branchId
      AND execution_no REGEXP '^SVEX-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(execution_no, 6) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].execution_no || "");
    const numPart = prev.slice(5);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `SVEX-${String(nextNum).padStart(6, "0")}`;
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

async function ensureSupplierTypeColumn() {
  if (!(await hasColumn("pur_suppliers", "supplier_type"))) {
    await pool.query(
      "ALTER TABLE pur_suppliers ADD COLUMN supplier_type VARCHAR(10) NOT NULL DEFAULT 'LOCAL'",
    );
  }
}

async function ensureSupplierCurrencyColumn() {
  if (!(await hasColumn("pur_suppliers", "currency_id"))) {
    await pool.query(
      "ALTER TABLE pur_suppliers ADD COLUMN currency_id BIGINT UNSIGNED NULL",
    );
  }
}

async function ensureSupplierServiceContractorColumn() {
  if (!(await hasColumn("pur_suppliers", "service_contractor"))) {
    await pool.query(
      "ALTER TABLE pur_suppliers ADD COLUMN service_contractor ENUM('Y','N') NOT NULL DEFAULT 'N'",
    );
  }
}

async function ensureGrnUomConversionColumns() {
  if (!(await hasColumn("inv_goods_receipt_note_details", "input_uom"))) {
    await pool.query(
      "ALTER TABLE inv_goods_receipt_note_details ADD COLUMN input_uom VARCHAR(20) NULL",
    );
  }
  if (!(await hasColumn("inv_goods_receipt_note_details", "input_qty"))) {
    await pool.query(
      "ALTER TABLE inv_goods_receipt_note_details ADD COLUMN input_qty DECIMAL(18,3) NULL",
    );
  }
}

async function ensureUnitConversionsTable() {
  if (!(await hasTable("inv_unit_conversions"))) {
    await pool.query(`
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
    `);
  }
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

async function ensureServiceConfirmationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inv_service_confirmations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      sc_no VARCHAR(50) NOT NULL,
      sc_date DATE NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sc_scope_no (company_id, branch_id, sc_no),
      KEY idx_sc_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inv_service_confirmation_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      confirmation_id BIGINT UNSIGNED NOT NULL,
      description VARCHAR(255) NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      unit_price DECIMAL(18,2) NOT NULL,
      line_total DECIMAL(18,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_scd_confirmation (confirmation_id),
      CONSTRAINT fk_scd_confirmation FOREIGN KEY (confirmation_id) REFERENCES inv_service_confirmations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceRequestTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      request_no VARCHAR(50) NOT NULL,
      request_date DATE NOT NULL,
      requester_full_name VARCHAR(100) NOT NULL,
      requester_email VARCHAR(150) NOT NULL,
      requester_phone VARCHAR(50) NOT NULL,
      requester_company VARCHAR(150) NULL,
      requester_address VARCHAR(255) NULL,
      service_type VARCHAR(50) NOT NULL,
      department VARCHAR(50) NULL,
      request_title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'low',
      preferred_date DATE NULL,
      preferred_time VARCHAR(30) NULL,
      contact_method ENUM('email','phone','sms') NOT NULL DEFAULT 'email',
      recurring ENUM('yes','no') NOT NULL DEFAULT 'no',
      additional_notes TEXT NULL,
      agreed_terms TINYINT(1) NOT NULL DEFAULT 0,
      attachments_json JSON NULL,
      status ENUM('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sr_scope_no (company_id, branch_id, request_no),
      KEY idx_sr_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceBillTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_bills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      bill_no VARCHAR(50) NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      service_date DATE NULL,
      status ENUM('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
      payment VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
      client_name VARCHAR(150) NULL,
      client_company VARCHAR(150) NULL,
      client_address VARCHAR(255) NULL,
      client_phone VARCHAR(50) NULL,
      client_email VARCHAR(150) NULL,
      payment_method VARCHAR(30) NULL,
      payment_reference VARCHAR(100) NULL,
      payment_terms TEXT NULL,
      notes TEXT NULL,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sb_scope_no (company_id, branch_id, bill_no),
      KEY idx_sb_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pur_service_bills", "payment"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN payment VARCHAR(30) NOT NULL DEFAULT 'UNPAID' AFTER status",
    );
  }
  const rows = await query(
    `SELECT column_type, column_default
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'pur_service_bills'
       AND column_name = 'status'`,
  );
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasPending = colType.includes("'PENDING'");
  const hasPaid = colType.includes("'PAID'");
  const hasOverdue = colType.includes("'OVERDUE'");
  const hasCompleted = colType.includes("'COMPLETED'");
  const desiredOk = hasPending && hasOverdue && (hasCompleted || hasPaid);
  if (!hasCompleted) {
    await pool.query(
      "ALTER TABLE pur_service_bills MODIFY COLUMN status ENUM('PENDING','COMPLETED','OVERDUE','PAID') NOT NULL DEFAULT 'PENDING'",
    );
  } else if (!desiredOk) {
    await pool.query(
      "ALTER TABLE pur_service_bills MODIFY COLUMN status ENUM('PENDING','COMPLETED','OVERDUE','PAID') NOT NULL DEFAULT 'PENDING'",
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_bill_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bill_id BIGINT UNSIGNED NOT NULL,
      description VARCHAR(255) NOT NULL,
      category VARCHAR(50) NULL,
      qty DECIMAL(18,3) NOT NULL,
      rate DECIMAL(18,2) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_sbd_bill (bill_id),
      CONSTRAINT fk_sbd_bill FOREIGN KEY (bill_id) REFERENCES pur_service_bills(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceSetupTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS svc_work_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_loc_scope_name (company_id, name),
      KEY idx_loc_scope (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS svc_service_types (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_type_scope_name (company_id, name),
      KEY idx_type_scope (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS svc_service_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cat_scope_name (company_id, name),
      KEY idx_cat_scope (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS svc_supervisors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      username VARCHAR(150) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sup_scope_user (company_id, user_id),
      KEY idx_sup_scope (company_id),
      CONSTRAINT fk_sup_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceOrderTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      order_no VARCHAR(50) NOT NULL,
      order_date DATE NOT NULL,
      order_type ENUM('INTERNAL','EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
      customer_name VARCHAR(150) NULL,
      customer_email VARCHAR(150) NULL,
      customer_phone VARCHAR(50) NULL,
      service_category VARCHAR(100) NULL,
      schedule_address VARCHAR(255) NULL,
      schedule_date DATE NULL,
      schedule_time VARCHAR(30) NULL,
      payment_method VARCHAR(30) NULL,
      department VARCHAR(100) NULL,
      cost_center VARCHAR(50) NULL,
      requestor_name VARCHAR(100) NULL,
      requestor_title VARCHAR(100) NULL,
      requestor_email VARCHAR(150) NULL,
      requestor_phone VARCHAR(50) NULL,
      contractor_name VARCHAR(150) NULL,
      contractor_code VARCHAR(50) NULL,
      contractor_email VARCHAR(150) NULL,
      contractor_phone VARCHAR(50) NULL,
      ext_category VARCHAR(100) NULL,
      scope_of_work TEXT NULL,
      work_location TEXT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      estimated_cost DECIMAL(18,2) NULL,
      currency_code VARCHAR(10) NULL,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
      assigned_supervisor_user_id BIGINT UNSIGNED NULL,
      assigned_supervisor_username VARCHAR(150) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_so_scope_no (company_id, branch_id, order_no),
      KEY idx_so_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_order_lines (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      line_no INT NOT NULL DEFAULT 1,
      item_id BIGINT UNSIGNED NULL,
      item_name VARCHAR(200) NULL,
      description VARCHAR(255) NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_sol_order (order_id),
      CONSTRAINT fk_sol_order FOREIGN KEY (order_id) REFERENCES pur_service_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceOrderColumns() {
  // pur_service_orders: assigned supervisor fields
  if (!(await hasColumn("pur_service_orders", "assigned_supervisor_user_id"))) {
    try {
      await pool.query(
        "ALTER TABLE pur_service_orders ADD COLUMN assigned_supervisor_user_id BIGINT UNSIGNED NULL AFTER status",
      );
    } catch {}
  }
  if (
    !(await hasColumn("pur_service_orders", "assigned_supervisor_username"))
  ) {
    try {
      await pool.query(
        "ALTER TABLE pur_service_orders ADD COLUMN assigned_supervisor_username VARCHAR(150) NULL AFTER assigned_supervisor_user_id",
      );
    } catch {}
  }
}
async function ensureServiceExecutionTables() {
  if (!(await hasTable("pur_service_executions"))) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pur_service_executions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        execution_no VARCHAR(50) NOT NULL,
        execution_date DATE NULL,
        scheduled_time VARCHAR(10) NULL,
        assigned_supervisor_user_id BIGINT UNSIGNED NULL,
        assigned_supervisor_username VARCHAR(150) NULL,
        requisition_notes TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_exec_no (company_id, branch_id, execution_no),
        KEY idx_exec_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
  if (!(await hasTable("pur_service_execution_materials"))) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pur_service_execution_materials (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        execution_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NULL,
        name VARCHAR(255) NULL,
        unit VARCHAR(20) NULL,
        qty DECIMAL(18,3) NULL,
        note VARCHAR(255) NULL,
        PRIMARY KEY (id),
        KEY idx_exec_mat (execution_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  const id = Number(rows?.[0]?.id || 0);
  return id || 0;
}
async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT id, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId FOR UPDATE",
    { companyId, voucherTypeId },
  );
  const vt = rows?.[0];
  if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
  const voucherNo = `${vt.prefix}-${vt.next_number}`;
  await conn.execute(
    "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
    { companyId, voucherTypeId },
  );
  return voucherNo;
}
async function ensureJournalVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "JV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'JV', 'Journal Voucher', 'JOURNAL', 'JV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "JV" });
  return id || 0;
}
async function resolveOpenFiscalYearId(conn, { companyId }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND is_open = 1 ORDER BY start_date DESC LIMIT 1",
    { companyId },
  );
  const id = Number(rows?.[0]?.id || 0);
  if (id) return id;
  const today = new Date();
  const todayYmd = toYmd(today);
  if (!todayYmd) return 0;
  const [inRangeRows] = await conn.execute(
    `SELECT id, is_open
     FROM fin_fiscal_years
     WHERE company_id = :companyId
       AND :todayYmd >= start_date
       AND :todayYmd <= end_date
     ORDER BY start_date DESC
     LIMIT 1`,
    { companyId, todayYmd },
  );
  const inRange = inRangeRows?.[0] || null;
  const inRangeId = Number(inRange?.id || 0) || 0;
  if (inRangeId) {
    if (Number(inRange?.is_open) !== 1) {
      await conn.execute(
        "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
        { companyId, id: inRangeId },
      );
    }
    return inRangeId;
  }
  const [companyRows] = await conn.execute(
    "SELECT fiscal_year_start_month FROM adm_companies WHERE id = :companyId LIMIT 1",
    { companyId },
  );
  let startMonth = Number(companyRows?.[0]?.fiscal_year_start_month || 1);
  if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) {
    startMonth = 1;
  }
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const startYear = currentMonth >= startMonth ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const startDateObj = new Date(startYear, startMonth - 1, 1);
  const nextStartObj = new Date(endYear, startMonth - 1, 1);
  const endDateObj = new Date(nextStartObj);
  endDateObj.setDate(endDateObj.getDate() - 1);
  const startDate = toYmd(startDateObj);
  const endDate = toYmd(endDateObj);
  if (!startDate || !endDate) return 0;
  const codeBase =
    startMonth === 1
      ? `FY${startYear}`
      : `FY${startYear}/${String(endYear).slice(-2)}`;
  let code = codeBase;
  for (let i = 0; i < 5; i += 1) {
    const [existsRows] = await conn.execute(
      "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    if (!existsRows?.length) break;
    code = `${codeBase}-${i + 1}`;
  }
  const [ins] = await conn.execute(
    `INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
     VALUES (:companyId, :code, :startDate, :endDate, 1)`,
    { companyId, code, startDate, endDate },
  );
  const newId = Number(ins?.insertId || 0) || 0;
  return newId;
}
async function resolveFinAccountId(conn, { companyId, accountRef }) {
  const raw = String(accountRef || "").trim();
  if (!raw) return 0;
  const asId = Number(raw);
  if (Number.isFinite(asId) && asId > 0) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: asId },
    );
    return Number(rows?.[0]?.id || 0) || 0;
  }
  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: raw },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function ensureSupplierFinAccountIdTx(conn, { companyId, supplierId }) {
  const [supRows] = await conn.execute(
    "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: supplierId },
  );
  const sup = supRows?.[0] || null;
  if (!sup) return 0;
  let code =
    sup.supplier_code && String(sup.supplier_code).trim()
      ? String(sup.supplier_code).trim()
      : `SU-${String(Number(sup.id || 0)).padStart(6, "0")}`;
  const [accRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
  if (accIdExisting) return accIdExisting;
  const [grpRows] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = 'CREDITORS' LIMIT 1",
    { companyId },
  );
  const creditorsGroupId = Number(grpRows?.[0]?.id || 0) || 0;
  if (!creditorsGroupId) return 0;
  let currencyId = sup.currency_id || null;
  if (!currencyId) {
    const [curRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    currencyId = Number(curRows?.[0]?.id || 0) || null;
  }
  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
     VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
    {
      companyId,
      groupId: creditorsGroupId,
      code,
      name: sup.supplier_name,
      currencyId,
    },
  );
  return Number(ins?.insertId || 0) || 0;
}
async function resolveGrnClearingAccountIdAuto(conn, { companyId, grnNo }) {
  const [codeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = '2100'
     LIMIT 1`,
    { companyId },
  );
  const codeAccId = Number(codeRows?.[0]?.id || 0) || 0;
  if (codeAccId) return codeAccId;
  const ref = String(grnNo || "").trim();
  if (ref) {
    const [clrRows] = await conn.execute(
      `SELECT account_id
       FROM fin_voucher_lines
       WHERE company_id = :companyId
         AND reference_no = :ref
         AND LOWER(description) LIKE '%clearing%'
       ORDER BY id DESC
       LIMIT 1`,
      { companyId, ref },
    );
    const accId = Number(clrRows?.[0]?.account_id || 0) || 0;
    if (accId) return accId;
  }
  const [accRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'LIABILITY'
       AND (
         LOWER(a.name) LIKE '%grn%' OR
         LOWER(a.name) LIKE '%grni%' OR
         LOWER(a.name) LIKE '%goods received%' OR
         LOWER(a.name) LIKE '%goods receipt%' OR
         LOWER(a.name) LIKE '%clearing%'
       )
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(accRows?.[0]?.id || 0) || 0;
}
async function resolveVatInputAccountIdAuto(conn, { companyId }) {
  const [codeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = '2200'
     LIMIT 1`,
    { companyId },
  );
  const codeId = Number(codeRows?.[0]?.id || 0) || 0;
  if (codeId) return codeId;
  const [rows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND (LOWER(a.name) LIKE '%vat%' OR LOWER(a.name) LIKE '%tax%')
       AND (LOWER(a.name) LIKE '%input%' OR LOWER(a.name) LIKE '%recoverable%' OR LOWER(a.name) LIKE '%claim%')
     ORDER BY 
       CASE WHEN LOWER(a.name) LIKE '%vat%' THEN 0 ELSE 1 END,
       a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function resolveChargesExpenseAccountIdAuto(conn, { companyId }) {
  const [codeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = '5020'
     LIMIT 1`,
    { companyId },
  );
  const codeId = Number(codeRows?.[0]?.id || 0) || 0;
  if (codeId) return codeId;
  const [rows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
     ORDER BY 
       CASE
         WHEN LOWER(a.name) LIKE '%freight%' THEN 0
         WHEN LOWER(a.name) LIKE '%transport%' THEN 1
         WHEN LOWER(a.name) LIKE '%carriage%' THEN 2
         WHEN LOWER(a.name) LIKE '%charges%' THEN 3
         WHEN LOWER(a.name) LIKE '%purchase%' THEN 4
         ELSE 5
       END,
       a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function resolveFxGainLossAccountsAuto(conn, { companyId }) {
  const [gainCodeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = 'FX_GAIN'
     LIMIT 1`,
    { companyId },
  );
  const [lossCodeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = 'FX_LOSS'
     LIMIT 1`,
    { companyId },
  );
  const gainCodeId = Number(gainCodeRows?.[0]?.id || 0) || 0;
  const lossCodeId = Number(lossCodeRows?.[0]?.id || 0) || 0;
  if (gainCodeId && lossCodeId) {
    return { fxGainAccountId: gainCodeId, fxLossAccountId: lossCodeId };
  }
  const [gainRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'INCOME'
       AND (LOWER(a.name) LIKE '%fx%' OR LOWER(a.name) LIKE '%exchange%')
       AND LOWER(a.name) LIKE '%gain%'
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  const [lossRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
       AND (LOWER(a.name) LIKE '%fx%' OR LOWER(a.name) LIKE '%exchange%')
       AND LOWER(a.name) LIKE '%loss%'
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return {
    fxGainAccountId: Number(gainRows?.[0]?.id || 0) || 0,
    fxLossAccountId: Number(lossRows?.[0]?.id || 0) || 0,
  };
}
async function postGrnAccrualTx(
  conn,
  { companyId, branchId, grnId, inventoryAccountRef, grnClearingAccountRef },
) {
  async function resolveInventoryAccountIdAuto(conn, { companyId }) {
    const [codeRows] = await conn.execute(
      `SELECT id
       FROM fin_accounts
       WHERE company_id = :companyId
         AND is_active = 1
         AND is_postable = 1
         AND code = '1200'
       LIMIT 1`,
      { companyId },
    );
    const codeAccId = Number(codeRows?.[0]?.id || 0) || 0;
    if (codeAccId) return codeAccId;
    const [accRows] = await conn.execute(
      `SELECT a.id
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND a.is_postable = 1
         AND g.nature = 'ASSET'
         AND (
           LOWER(a.name) LIKE '%inventory%' OR
           LOWER(a.name) LIKE '%stock%' OR
           LOWER(a.name) LIKE '%merchandise%'
         )
       ORDER BY a.code ASC
       LIMIT 1`,
      { companyId },
    );
    return Number(accRows?.[0]?.id || 0) || 0;
  }
  const [hdrRows] = await conn.execute(
    "SELECT grn_no, grn_type, po_id, supplier_id, port_clearance_id, clearing_id FROM inv_goods_receipt_notes WHERE company_id = :companyId AND branch_id = :branchId AND id = :id LIMIT 1",
    { companyId, branchId, id: grnId },
  );
  const hdr = hdrRows?.[0] || null;
  if (!hdr) throw httpError(404, "NOT_FOUND", "GRN not found");
  const grnType = String(hdr.grn_type || "").toUpperCase();
  if (!hdr.po_id && grnType !== "LOCAL") {
    throw httpError(400, "VALIDATION_ERROR", "GRN requires a referenced PO");
  }
  const [detRows] = await conn.execute(
    "SELECT qty_accepted, unit_price, line_amount FROM inv_goods_receipt_note_details WHERE grn_id = :id",
    { id: grnId },
  );
  let goodsBase = 0;
  for (const r of detRows || []) {
    const amount =
      Number(r.line_amount || 0) ||
      Number(r.qty_accepted || 0) * Number(r.unit_price || 0);
    goodsBase += Number(amount || 0);
  }
  let landingBase = 0;
  const clearanceId =
    Number(hdr.clearing_id || hdr.port_clearance_id || 0) || 0;
  if (clearanceId) {
    const [pcRows] = await conn.execute(
      "SELECT duty_amount, other_charges FROM pur_port_clearances WHERE company_id = :companyId AND branch_id = :branchId AND id = :id LIMIT 1",
      { companyId, branchId, id: clearanceId },
    );
    const pc = pcRows?.[0] || null;
    if (pc)
      landingBase = Number(pc.duty_amount || 0) + Number(pc.other_charges || 0);
  }
  const inventoryValue = Math.round((goodsBase + landingBase) * 100) / 100;
  const inventoryAccountId = await resolveFinAccountId(conn, {
    companyId,
    accountRef: inventoryAccountRef,
  });
  const grnClearingAccountId = await resolveFinAccountId(conn, {
    companyId,
    accountRef: grnClearingAccountRef,
  });
  let resolvedInventoryId = inventoryAccountId;
  if (!resolvedInventoryId) {
    resolvedInventoryId = await resolveInventoryAccountIdAuto(conn, {
      companyId,
    });
  }
  let resolvedClearingId = grnClearingAccountId;
  if (!resolvedClearingId) {
    resolvedClearingId = await resolveGrnClearingAccountIdAuto(conn, {
      companyId,
      grnNo: String(hdr.grn_no || ""),
    });
  }
  if (!resolvedInventoryId || !resolvedClearingId) {
    throw httpError(
      400,
      "VALIDATION_ERROR",
      "Missing inventory or GRN clearing account",
    );
  }
  const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
  const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, { companyId });
  const voucherNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId });
  const voucherDate = toYmd(new Date());
  const [vIns] = await conn.execute(
    `INSERT INTO fin_vouchers
      (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
     VALUES
      (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
    {
      companyId,
      branchId,
      fiscalYearId,
      voucherTypeId,
      voucherNo,
      voucherDate,
      narration: `GRN ${hdr.grn_no} inventory accrual`,
      totalDebit: inventoryValue,
      totalCredit: inventoryValue,
      createdBy: null,
      approvedBy: null,
      postedBy: null,
    },
  );
  const voucherId = Number(vIns?.insertId || 0) || 0;
  await conn.execute(
    `INSERT INTO fin_voucher_lines
      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
     VALUES
      (:companyId, :voucherId, 1, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
    {
      companyId,
      voucherId,
      accountId: resolvedInventoryId,
      description: `GRN ${hdr.grn_no} inventory`,
      debit: inventoryValue,
      referenceNo: String(hdr.grn_no || ""),
    },
  );
  await conn.execute(
    `INSERT INTO fin_voucher_lines
      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
     VALUES
      (:companyId, :voucherId, 2, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
    {
      companyId,
      voucherId,
      accountId: resolvedClearingId,
      description: `GRN ${hdr.grn_no} clearing`,
      credit: inventoryValue,
      referenceNo: String(hdr.grn_no || ""),
    },
  );
  return { voucherId, voucherNo, amount: inventoryValue };
}

async function nextSequentialNo(table, column, prefix) {
  const rows = await query(
    `
    SELECT ${column} AS no
    FROM ${table}
    WHERE ${column} REGEXP '^${prefix}-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(${column}, ${prefix.length + 2}) AS UNSIGNED) DESC
    LIMIT 1
    `,
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].no || "");
    const numPart = prev.slice(prefix.length + 1);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `${prefix}-${String(nextNum).padStart(6, "0")}`;
}

// ==========================================
// Service Confirmations (moved from Inventory)
// ==========================================

router.get(
  "/service-confirmations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_CONFIRMATION.VIEW",
    "INV.SERVICE_CONFIRMATION.VIEW",
  ]),
  (req, res, next) => listServiceConfirmations(req, res, next),
);

router.get(
  "/direct-purchases/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.ORDER.MANAGE",
    "PURCHASE.GRN.MANAGE",
    "PURCHASE.BILL.MANAGE",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensureDirectPurchaseTables();
      const [hdrRows] = await pool.execute(
        `SELECT h.*, s.supplier_name
           FROM pur_direct_purchase_hdr h
           LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
          WHERE h.id = :id AND h.company_id = :companyId AND h.branch_id = :branchId
          LIMIT 1`,
        { id, companyId, branchId },
      );
      const hdr = hdrRows?.[0] || null;
      if (!hdr) throw httpError(404, "NOT_FOUND", "Direct purchase not found");
      const [dtlRows] = await pool.execute(
        `SELECT id, item_id, qty, uom, unit_price, discount_percent, tax_percent, line_total
           FROM pur_direct_purchase_dtl
          WHERE hdr_id = :id`,
        { id },
      );
      res.json({
        id: hdr.id,
        dp_no: hdr.dp_no,
        dp_date: hdr.dp_date,
        supplier_id: hdr.supplier_id,
        supplier_name: hdr.supplier_name,
        warehouse_id: hdr.warehouse_id,
        currency_id: hdr.currency_id,
        exchange_rate: hdr.exchange_rate,
        payment_terms: hdr.payment_terms,
        remarks: hdr.remarks,
        subtotal: hdr.subtotal,
        discount_amount: hdr.discount_amount,
        tax_amount: hdr.tax_amount,
        net_amount: hdr.net_amount,
        status: hdr.status,
        grn_id: hdr.grn_id,
        bill_id: hdr.bill_id,
        details: Array.isArray(dtlRows) ? dtlRows : [],
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/direct-purchases/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.ORDER.MANAGE",
    "PURCHASE.GRN.MANAGE",
    "PURCHASE.BILL.MANAGE",
  ]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const status = String(body.status || "DRAFT").toUpperCase();
      function normalizeYmd(input) {
        if (!input) return toYmd(new Date());
        if (input instanceof Date && !Number.isNaN(input.getTime()))
          return toYmd(input);
        const s = String(input).trim();
        const dateOnly = s.split("T")[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return toYmd(d);
        return toYmd(new Date());
      }
      const dpDateYmd = normalizeYmd(body.purchase_date);
      const supplierId = toNumber(body.supplier_id);
      const warehouseId = toNumber(body.warehouse_id);
      const currencyId = toNumber(body.currency_id) || null;
      const exchangeRate = Number(body.exchange_rate || 1) || 1;
      const paymentTerms = toNumber(body.payment_terms) || null;
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];
      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "supplier_id required");
      if (!warehouseId)
        throw httpError(400, "VALIDATION_ERROR", "warehouse_id required");
      if (!details.length)
        throw httpError(400, "VALIDATION_ERROR", "details required");
      await ensureDirectPurchaseTables();
      const [hdrRows] = await conn.execute(
        `SELECT id, dp_no, status, grn_id, bill_id
           FROM pur_direct_purchase_hdr
          WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
          LIMIT 1`,
        { id, companyId, branchId },
      );
      const hdr = hdrRows?.[0] || null;
      if (!hdr) throw httpError(404, "NOT_FOUND", "Direct purchase not found");
      if (String(hdr.status) === "POSTED")
        throw httpError(400, "VALIDATION_ERROR", "Cannot edit POSTED document");

      // Recompute totals
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      const cleanDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty || 0);
        const unitPrice = Number(d.unit_price || 0);
        const discountPercent = Number(d.discount_percent || 0);
        const taxPercent = Number(d.tax_percent || 0);
        if (!itemId || !(qty > 0) || !(unitPrice >= 0)) continue;
        const gross = qty * unitPrice;
        const disc = Math.round(gross * discountPercent) / 100;
        const base = Math.max(0, gross - disc);
        const tax = Math.round(base * taxPercent) / 100;
        const lineTotal = Math.round((base + tax) * 100) / 100;
        subtotal += gross;
        totalDiscount += disc;
        totalTax += tax;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          discountPercent,
          taxPercent,
          lineTotal,
          uom: String(d.uom || "PCS"),
        });
      }
      const netAmount =
        Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE pur_direct_purchase_hdr
            SET dp_date = :dpDate, supplier_id = :supplierId, warehouse_id = :warehouseId,
                currency_id = :currencyId, exchange_rate = :exchangeRate, payment_terms = :paymentTerms,
                remarks = :remarks, subtotal = :subtotal, discount_amount = :discountAmount,
                tax_amount = :taxAmount, net_amount = :netAmount
          WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          dpDate: dpDateYmd,
          supplierId,
          warehouseId,
          currencyId,
          exchangeRate,
          paymentTerms,
          remarks,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          netAmount,
          id,
          companyId,
          branchId,
        },
      );
      await conn.execute(
        "DELETE FROM pur_direct_purchase_dtl WHERE hdr_id = :id",
        { id },
      );
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_direct_purchase_dtl
            (hdr_id, item_id, qty, uom, unit_price, discount_percent, tax_percent, line_total)
           VALUES
            (:hdrId, :itemId, :qty, :uom, :unitPrice, :discountPercent, :taxPercent, :lineTotal)`,
          { hdrId: id, ...d },
        );
      }
      if (status === "DRAFT") {
        await conn.commit();
        return res.json({
          id,
          dp_no: hdr.dp_no,
          status: "DRAFT",
          net_amount: netAmount,
        });
      }
      // Post the updated DP (same as POST branch)
      const grnNo = await nextSequentialNo(
        "inv_goods_receipt_notes",
        "grn_no",
        "GRN",
      );
      const [grnHdr] = await conn.execute(
        `INSERT INTO inv_goods_receipt_notes
         (company_id, branch_id, grn_no, grn_date, grn_type, po_id, supplier_id, warehouse_id, status, remarks, created_by)
         VALUES
         (:companyId, :branchId, :grnNo, :grnDate, 'LOCAL', NULL, :supplierId, :warehouseId, 'APPROVED', :remarks, :createdBy)`,
        {
          companyId,
          branchId,
          grnNo,
          grnDate: dpDateYmd,
          supplierId,
          warehouseId,
          remarks,
          createdBy: req.user?.sub || null,
        },
      );
      const grnId = Number(grnHdr.insertId);
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
           (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount)
           VALUES
           (:grnId, :itemId, :qty, :qty, :qty, 0, :uom, :unitPrice, :lineTotal)`,
          {
            grnId,
            itemId: d.itemId,
            qty: d.qty,
            uom: d.uom,
            unitPrice: d.unitPrice,
            lineTotal: d.lineTotal,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
           ON DUPLICATE KEY UPDATE qty = qty + :qty`,
          { companyId, branchId, warehouseId, itemId: d.itemId, qty: d.qty },
        );
      }
      const { voucherId: grnVoucherId, voucherNo: grnVoucherNo } =
        await postGrnAccrualTx(conn, {
          companyId,
          branchId,
          grnId,
          inventoryAccountRef: "1200",
          grnClearingAccountRef: "2100",
        });
      const billNo = await nextSequentialNo("pur_bills", "bill_no", "PB");
      const [billHdr] = await conn.execute(
        `INSERT INTO pur_bills
          (company_id, branch_id, bill_no, bill_date, supplier_id, po_id, grn_id, bill_type,
           due_date, currency_id, exchange_rate, payment_terms,
           total_amount, discount_amount, tax_amount, freight_charges, other_charges, net_amount,
           status, created_by)
         VALUES
          (:companyId, :branchId, :billNo, :billDate, :supplierId, NULL, :grnId, 'LOCAL',
           :dueDate, :currencyId, :exchangeRate, :paymentTerms,
           :totalAmount, :discountAmount, :taxAmount, 0, 0, :netAmount,
           'DRAFT', :createdBy)`,
        {
          companyId,
          branchId,
          billNo,
          billDate: dpDateYmd,
          supplierId,
          grnId,
          dueDate: null,
          currencyId,
          exchangeRate,
          paymentTerms,
          totalAmount: subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          netAmount,
          createdBy: req.user?.sub || null,
        },
      );
      const billId = Number(billHdr.insertId);
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_bill_details
            (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total)
           VALUES
            (:billId, :itemId, NULL, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal)`,
          {
            billId,
            itemId: d.itemId,
            qty: d.qty,
            unitPrice: d.unitPrice,
            discountPercent: d.discountPercent,
            taxAmount:
              Math.round(
                (d.lineTotal -
                  d.qty * d.unitPrice +
                  (d.discountPercent
                    ? (d.qty * d.unitPrice * d.discountPercent) / 100
                    : 0)) *
                  100,
              ) / 100,
            lineTotal: d.lineTotal,
          },
        );
      }
      const rate = Number(exchangeRate || 1);
      const goodsExclusive = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.max(0, totalTax);
      const goodsBase = Math.round(goodsExclusive * rate * 100) / 100;
      const vatBase = Math.round(vatAmount * rate * 100) / 100;
      const [grnDetRows] = await conn.execute(
        "SELECT SUM(qty_accepted * unit_price) AS goods_base FROM inv_goods_receipt_note_details WHERE grn_id = :grnId",
        { grnId },
      );
      const grnGoodsBase =
        Math.round(Number(grnDetRows?.[0]?.goods_base || 0) * 100) / 100;
      const grnClearingAccountId = await resolveGrnClearingAccountIdAuto(conn, {
        companyId,
        grnNo,
      });
      let vatInputAccountId = 0;
      if (vatBase > 0) {
        vatInputAccountId = await resolveVatInputAccountIdAuto(conn, {
          companyId,
        });
      }
      const chargesBase = 0;
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, {
        companyId,
      });
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = toYmd(new Date());
      const apCredit =
        Math.round((goodsBase + vatBase + chargesBase) * 100) / 100;
      const totalDebit = grnGoodsBase + (vatBase > 0 ? vatBase : 0);
      const totalCredit = apCredit;
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration: `Purchase Bill ${billNo} posting`,
          totalDebit,
          totalCredit,
          createdBy: req.user?.sub || null,
          approvedBy: req.user?.sub || null,
          postedBy: req.user?.sub || null,
        },
      );
      const billVoucherId = Number(vIns?.insertId || 0) || 0;
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId: billVoucherId,
          lineNo: lineNo++,
          accountId: grnClearingAccountId,
          description: `GRN ${grnNo} clearing`,
          debit: grnGoodsBase,
          referenceNo: billNo,
        },
      );
      if (vatBase > 0 && vatInputAccountId) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId: billVoucherId,
            lineNo: lineNo++,
            accountId: vatInputAccountId,
            description: `VAT input on ${billNo}`,
            debit: vatBase,
            referenceNo: billNo,
          },
        );
      }
      const [apRows] = await conn.execute(
        `SELECT id
         FROM fin_accounts
         WHERE company_id = :companyId
           AND is_active = 1
           AND is_postable = 1
           AND code = '2001'
         LIMIT 1`,
        { companyId },
      );
      const supplierAccId = Number(apRows?.[0]?.id || 0) || 0;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId: billVoucherId,
          lineNo: lineNo++,
          accountId: supplierAccId,
          description: `AP for ${billNo}`,
          credit: apCredit,
          referenceNo: billNo,
        },
      );
      await conn.execute(
        "UPDATE pur_bills SET status = 'POSTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id: billId, companyId, branchId },
      );
      await conn.execute(
        `UPDATE pur_direct_purchase_hdr
           SET status = 'POSTED',
               grn_id = :grnId,
               bill_id = :billId,
               grn_voucher_id = :grnVoucherId,
               bill_voucher_id = :billVoucherId,
               approved_by = :userId,
               posted_by = :userId
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          grnId,
          billId,
          grnVoucherId,
          billVoucherId,
          userId: req.user?.sub || null,
        },
      );
      await conn.commit();
      res.json({
        id,
        dp_no: hdr.dp_no,
        status: "POSTED",
        grn_id: grnId,
        bill_id: billId,
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
  "/service-confirmations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_CONFIRMATION.VIEW",
    "INV.SERVICE_CONFIRMATION.VIEW",
  ]),
  (req, res, next) => getServiceConfirmationById(req, res, next),
);

router.post(
  "/service-confirmations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_CONFIRMATION.MANAGE",
    "INV.SERVICE_CONFIRMATION.MANAGE",
  ]),
  (req, res, next) => createServiceConfirmation(req, res, next),
);

router.put(
  "/service-confirmations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_CONFIRMATION.MANAGE",
    "INV.SERVICE_CONFIRMATION.MANAGE",
  ]),
  (req, res, next) => updateServiceConfirmation(req, res, next),
);

// ==========================================
// Service Requests
// ==========================================

router.get(
  "/service-requests",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_REQUEST.VIEW",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_REQUEST.VIEW",
  ]),
  (req, res, next) => listServiceRequests(req, res, next),
);

router.get(
  "/service-requests/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_REQUEST.VIEW",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_REQUEST.VIEW",
  ]),
  (req, res, next) => getServiceRequestById(req, res, next),
);

router.get(
  "/service-requests/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  (req, res, next) => getNextServiceRequestNo(req, res, next),
);

router.post(
  "/service-requests",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_REQUEST.MANAGE",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_REQUEST.MANAGE",
  ]),
  (req, res, next) => createServiceRequest(req, res, next),
);

router.put(
  "/service-requests/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_REQUEST.MANAGE",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_REQUEST.MANAGE",
  ]),
  (req, res, next) => updateServiceRequest(req, res, next),
);

// ==========================================
// Service Bills
// ==========================================

router.get(
  "/service-bills",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_BILL.VIEW",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_BILL.VIEW",
  ]),
  (req, res, next) => listServiceBills(req, res, next),
);

router.get(
  "/service-bills/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_BILL.VIEW",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_BILL.VIEW",
  ]),
  (req, res, next) => getServiceBillById(req, res, next),
);

router.get(
  "/service-bills/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  (req, res, next) => getNextServiceBillNo(req, res, next),
);

router.post(
  "/service-bills",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_BILL.MANAGE",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_BILL.MANAGE",
  ]),
  (req, res, next) => createServiceBill(req, res, next),
);

router.put(
  "/service-bills/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.SERVICE_BILL.MANAGE",
    "PURCHASE.ORDER.MANAGE",
    "INV.SERVICE_BILL.MANAGE",
  ]),
  (req, res, next) => updateServiceBill(req, res, next),
);
router.get(
  "/service-setup/work-locations",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      await ensureServiceSetupTables();
      const items = await query(
        "SELECT id, name FROM svc_work_locations WHERE company_id = :companyId ORDER BY name ASC",
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/direct-purchases",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.ORDER.MANAGE",
    "PURCHASE.GRN.MANAGE",
    "PURCHASE.BILL.MANAGE",
  ]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureDirectPurchaseTables();
      const items =
        (await query(
          `
          SELECT 
            h.id,
            h.dp_no,
            h.dp_date AS purchase_date,
            h.supplier_id,
            s.supplier_name,
            h.net_amount AS grand_total,
            h.grn_id,
            g.grn_no,
            h.bill_id,
            b.bill_no
          FROM pur_direct_purchase_hdr h
          LEFT JOIN pur_suppliers s ON s.id = h.supplier_id
          LEFT JOIN inv_goods_receipt_notes g ON g.id = h.grn_id
          LEFT JOIN pur_bills b ON b.id = h.bill_id
         WHERE h.company_id = :companyId
           AND h.branch_id = :branchId
         ORDER BY h.dp_date DESC, h.id DESC
          `,
          { companyId, branchId },
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-setup/supervisors",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      await ensureServiceSetupTables();
      const items = await query(
        "SELECT id, user_id, username FROM svc_supervisors WHERE company_id = :companyId ORDER BY username ASC",
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/service-setup/users",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const items = await query(
        `
        SELECT 
          u.id, u.username, u.full_name, u.email
        FROM adm_users u
        WHERE u.company_id = :companyId
          AND u.is_active = 1
        ORDER BY u.username ASC
        `,
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/service-setup/supervisors",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const userId = Number(req.body?.user_id || 0);
      if (!userId) throw httpError(400, "VALIDATION_ERROR", "user_id required");
      await ensureServiceSetupTables();
      const rows = await query(
        "SELECT id, username FROM adm_users WHERE id = :id LIMIT 1",
        { id: userId },
      );
      const u = rows?.[0];
      if (!u) throw httpError(404, "NOT_FOUND", "User not found");
      const username = String(u.username || "").trim() || String(u.email || "");
      const [result] = await pool.execute(
        "INSERT INTO svc_supervisors (company_id, user_id, username) VALUES (:companyId, :userId, :username)",
        { companyId, userId, username },
      );
      const id = Number(result?.insertId || 0);
      res.json({ item: { id, user_id: userId, username } });
    } catch (err) {
      next(err);
    }
  },
);
router.delete(
  "/service-setup/supervisors/:id",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id, 0);
      await ensureServiceSetupTables();
      await pool.execute(
        "DELETE FROM svc_supervisors WHERE id = :id AND company_id = :companyId",
        { id, companyId },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/service-setup/work-locations",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const name = String(req.body?.name || "").trim();
      if (!name) throw httpError(400, "VALIDATION_ERROR", "Name required");
      await ensureServiceSetupTables();
      const [result] = await pool.execute(
        "INSERT INTO svc_work_locations (company_id, name) VALUES (:companyId, :name)",
        { companyId, name },
      );
      const id = Number(result?.insertId || 0);
      res.json({ item: { id, name } });
    } catch (err) {
      next(err);
    }
  },
);
router.delete(
  "/service-setup/work-locations/:id",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id, 0);
      await ensureServiceSetupTables();
      await pool.execute(
        "DELETE FROM svc_work_locations WHERE id = :id AND company_id = :companyId",
        { id, companyId },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-setup/service-types",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      await ensureServiceSetupTables();
      const items = await query(
        "SELECT id, name FROM svc_service_types WHERE company_id = :companyId ORDER BY name ASC",
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/service-setup/service-types",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const name = String(req.body?.name || "").trim();
      if (!name) throw httpError(400, "VALIDATION_ERROR", "Name required");
      await ensureServiceSetupTables();
      const [result] = await pool.execute(
        "INSERT INTO svc_service_types (company_id, name) VALUES (:companyId, :name)",
        { companyId, name },
      );
      const id = Number(result?.insertId || 0);
      res.json({ item: { id, name } });
    } catch (err) {
      next(err);
    }
  },
);
router.delete(
  "/service-setup/service-types/:id",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id, 0);
      await ensureServiceSetupTables();
      await pool.execute(
        "DELETE FROM svc_service_types WHERE id = :id AND company_id = :companyId",
        { id, companyId },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-setup/categories",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      await ensureServiceSetupTables();
      const items = await query(
        "SELECT id, name FROM svc_service_categories WHERE company_id = :companyId ORDER BY name ASC",
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/service-setup/categories",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const name = String(req.body?.name || "").trim();
      if (!name) throw httpError(400, "VALIDATION_ERROR", "Name required");
      await ensureServiceSetupTables();
      const [result] = await pool.execute(
        "INSERT INTO svc_service_categories (company_id, name) VALUES (:companyId, :name)",
        { companyId, name },
      );
      const id = Number(result?.insertId || 0);
      res.json({ item: { id, name } });
    } catch (err) {
      next(err);
    }
  },
);
router.delete(
  "/service-setup/categories/:id",
  requireAuth,
  requireCompanyScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id, 0);
      await ensureServiceSetupTables();
      await pool.execute(
        "DELETE FROM svc_service_categories WHERE id = :id AND company_id = :companyId",
        { id, companyId },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureServiceOrderTables();
      await ensureServiceOrderColumns();
      const type =
        req.query.type &&
        ["INTERNAL", "EXTERNAL"].includes(String(req.query.type).toUpperCase())
          ? String(req.query.type).toUpperCase()
          : null;
      const items = await query(
        `SELECT 
           id, order_no, order_date, order_type,
           customer_name, service_category AS service_type,
           status, work_location, total_amount,
           assigned_supervisor_user_id, assigned_supervisor_username
         FROM pur_service_orders 
         WHERE company_id = :companyId AND branch_id = :branchId
           ${type ? "AND order_type = :type" : ""}
         ORDER BY order_date DESC, id DESC
         LIMIT 200`,
        { companyId, branchId, type },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id, 0);
      await ensureServiceOrderTables();
      await ensureServiceOrderColumns();
      const [order] = await query(
        "SELECT * FROM pur_service_orders WHERE id = :id LIMIT 1",
        { id },
      );
      if (!order) throw httpError(404, "NOT_FOUND", "Service order not found");
      const lines = await query(
        "SELECT line_no, item_id, item_name, description, qty, unit_price, line_total FROM pur_service_order_lines WHERE order_id = :id ORDER BY line_no ASC",
        { id },
      );
      res.json({ item: order, lines });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/service-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, userId } = req.scope;
      const body = req.body || {};
      await ensureServiceOrderTables();
      await ensureServiceOrderColumns();
      await conn.beginTransaction();
      const orderNo =
        String(body.order_no || "").trim() ||
        (await nextSequentialNo("pur_service_orders", "order_no", "SVO"));
      const orderDate =
        String(body.order_date || "").trim() || toYmd(new Date());
      const orderType = String(body.order_type || "INTERNAL").toUpperCase();
      const totalAmount = Number(body.total_amount || 0);
      const [resOrder] = await conn.execute(
        `INSERT INTO pur_service_orders (
           company_id, branch_id, order_no, order_date, order_type,
           customer_name, customer_email, customer_phone, service_category,
           schedule_address, schedule_date, schedule_time, payment_method,
           department, cost_center, requestor_name, requestor_title, requestor_email, requestor_phone,
           contractor_name, contractor_code, contractor_email, contractor_phone,
           ext_category, scope_of_work, work_location, start_date, end_date, estimated_cost, currency_code,
           total_amount, status, assigned_supervisor_user_id, assigned_supervisor_username, created_by
         ) VALUES (
           :companyId, :branchId, :orderNo, :orderDate, :orderType,
           :customer_name, :customer_email, :customer_phone, :service_category,
           :schedule_address, :schedule_date, :schedule_time, :payment_method,
           :department, :cost_center, :requestor_name, :requestor_title, :requestor_email, :requestor_phone,
           :contractor_name, :contractor_code, :contractor_email, :contractor_phone,
           :ext_category, :scope_of_work, :work_location, :start_date, :end_date, :estimated_cost, :currency_code,
           :total_amount, 'SUBMITTED', :assigned_supervisor_user_id, :assigned_supervisor_username, :created_by
         )`,
        {
          companyId,
          branchId,
          orderNo,
          orderDate,
          orderType,
          customer_name: body.customer_name || null,
          customer_email: body.customer_email || null,
          customer_phone: body.customer_phone || null,
          service_category: body.service_category || null,
          schedule_address: body.schedule_address || null,
          schedule_date: body.schedule_date || null,
          schedule_time: body.schedule_time || null,
          payment_method: body.payment_method || null,
          department: body.department || null,
          cost_center: body.cost_center || null,
          requestor_name: body.requestor_name || null,
          requestor_title: body.requestor_title || null,
          requestor_email: body.requestor_email || null,
          requestor_phone: body.requestor_phone || null,
          contractor_name: body.contractor_name || null,
          contractor_code: body.contractor_code || null,
          contractor_email: body.contractor_email || null,
          contractor_phone: body.contractor_phone || null,
          ext_category: body.ext_category || null,
          scope_of_work: body.scope_of_work || null,
          work_location: body.work_location || null,
          start_date: body.start_date || null,
          end_date: body.end_date || null,
          estimated_cost: body.estimated_cost || null,
          currency_code: body.currency_code || null,
          total_amount: totalAmount || 0,
          assigned_supervisor_user_id:
            body.assigned_supervisor_user_id === undefined
              ? null
              : Number(body.assigned_supervisor_user_id || 0) || null,
          assigned_supervisor_username:
            body.assigned_supervisor_username || null,
          created_by: userId || null,
        },
      );
      const orderId = Number(resOrder?.insertId || 0);
      const lines = Array.isArray(body.lines) ? body.lines : [];
      let lineNo = 0;
      for (const ln of lines) {
        lineNo++;
        const qty = Number(ln.qty || 0);
        const unitPrice = Number(ln.unit_price || 0);
        const lineTotal = Number(ln.line_total || qty * unitPrice);
        await conn.execute(
          `INSERT INTO pur_service_order_lines (
             order_id, line_no, item_id, item_name, description, qty, unit_price, line_total
           ) VALUES (
             :orderId, :line_no, :item_id, :item_name, :description, :qty, :unit_price, :line_total
           )`,
          {
            orderId,
            line_no: lineNo,
            item_id: ln.item_id || null,
            item_name: ln.item_name || null,
            description: ln.description || null,
            qty,
            unit_price: unitPrice,
            line_total: lineTotal,
          },
        );
      }
      await conn.commit();
      res.json({ id: orderId, order_no: orderNo });
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
  "/service-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id, 0);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      await ensureServiceOrderTables();
      await ensureServiceOrderColumns();
      await conn.beginTransaction();
      const [exists] = await conn.execute(
        `SELECT id FROM pur_service_orders 
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!Array.isArray(exists) || !exists.length)
        throw httpError(404, "NOT_FOUND", "Service order not found");
      await conn.execute(
        `UPDATE pur_service_orders SET
           order_date = COALESCE(:orderDate, order_date),
           order_type = COALESCE(:orderType, order_type),
           customer_name = COALESCE(:customer_name, customer_name),
           customer_email = COALESCE(:customer_email, customer_email),
           customer_phone = COALESCE(:customer_phone, customer_phone),
           service_category = COALESCE(:service_category, service_category),
           schedule_address = COALESCE(:schedule_address, schedule_address),
           schedule_date = COALESCE(:schedule_date, schedule_date),
           schedule_time = COALESCE(:schedule_time, schedule_time),
           payment_method = COALESCE(:payment_method, payment_method),
           department = COALESCE(:department, department),
           cost_center = COALESCE(:cost_center, cost_center),
           requestor_name = COALESCE(:requestor_name, requestor_name),
           requestor_title = COALESCE(:requestor_title, requestor_title),
           requestor_email = COALESCE(:requestor_email, requestor_email),
           requestor_phone = COALESCE(:requestor_phone, requestor_phone),
           contractor_name = COALESCE(:contractor_name, contractor_name),
           contractor_code = COALESCE(:contractor_code, contractor_code),
           contractor_email = COALESCE(:contractor_email, contractor_email),
           contractor_phone = COALESCE(:contractor_phone, contractor_phone),
           ext_category = COALESCE(:ext_category, ext_category),
           scope_of_work = COALESCE(:scope_of_work, scope_of_work),
           work_location = COALESCE(:work_location, work_location),
           start_date = COALESCE(:start_date, start_date),
           end_date = COALESCE(:end_date, end_date),
           estimated_cost = COALESCE(:estimated_cost, estimated_cost),
           currency_code = COALESCE(:currency_code, currency_code),
           total_amount = COALESCE(:total_amount, total_amount),
           assigned_supervisor_user_id = COALESCE(:assigned_supervisor_user_id, assigned_supervisor_user_id),
           assigned_supervisor_username = COALESCE(:assigned_supervisor_username, assigned_supervisor_username)
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          orderDate: body.order_date || null,
          orderType:
            body.order_type === undefined
              ? null
              : String(body.order_type || "").toUpperCase(),
          customer_name: body.customer_name || null,
          customer_email: body.customer_email || null,
          customer_phone: body.customer_phone || null,
          service_category: body.service_category || null,
          schedule_address: body.schedule_address || null,
          schedule_date: body.schedule_date || null,
          schedule_time: body.schedule_time || null,
          payment_method: body.payment_method || null,
          department: body.department || null,
          cost_center: body.cost_center || null,
          requestor_name: body.requestor_name || null,
          requestor_title: body.requestor_title || null,
          requestor_email: body.requestor_email || null,
          requestor_phone: body.requestor_phone || null,
          contractor_name: body.contractor_name || null,
          contractor_code: body.contractor_code || null,
          contractor_email: body.contractor_email || null,
          contractor_phone: body.contractor_phone || null,
          ext_category: body.ext_category || null,
          scope_of_work: body.scope_of_work || null,
          work_location: body.work_location || null,
          start_date: body.start_date || null,
          end_date: body.end_date || null,
          estimated_cost: body.estimated_cost || null,
          currency_code: body.currency_code || null,
          total_amount:
            body.total_amount === undefined
              ? null
              : Number(body.total_amount || 0),
          assigned_supervisor_user_id:
            body.assigned_supervisor_user_id === undefined
              ? null
              : Number(body.assigned_supervisor_user_id || 0) || null,
          assigned_supervisor_username:
            body.assigned_supervisor_username || null,
        },
      );
      await conn.execute(
        "DELETE FROM pur_service_order_lines WHERE order_id = :orderId",
        { orderId: id },
      );
      const lines = Array.isArray(body.lines) ? body.lines : [];
      let lineNo = 0;
      for (const ln of lines) {
        lineNo++;
        const qty = Number(ln.qty || 0);
        const unitPrice = Number(ln.unit_price || 0);
        const lineTotal = Number(ln.line_total || qty * unitPrice);
        await conn.execute(
          `INSERT INTO pur_service_order_lines (
             order_id, line_no, item_id, item_name, description, qty, unit_price, line_total
           ) VALUES (
             :orderId, :line_no, :item_id, :item_name, :description, :qty, :unit_price, :line_total
           )`,
          {
            orderId: id,
            line_no: lineNo,
            item_id: ln.item_id || null,
            item_name: ln.item_name || null,
            description: ln.description || null,
            qty,
            unit_price: unitPrice,
            line_total: lineTotal,
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
async function ensureStockBalancesWarehouseInfrastructure() {
  if (!(await hasColumn("inv_stock_balances", "warehouse_id"))) {
    await pool.query(
      "ALTER TABLE inv_stock_balances ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
    );
    try {
      await pool.query(
        "ALTER TABLE inv_stock_balances DROP INDEX uq_stock_scope_item",
      );
    } catch {}
    try {
      await pool.query(
        "ALTER TABLE inv_stock_balances ADD CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id)",
      );
    } catch {}
    try {
      await pool.query(
        "ALTER TABLE inv_stock_balances ADD UNIQUE KEY uq_stock_scope_wh_item (company_id, branch_id, warehouse_id, item_id)",
      );
    } catch {}
  }
}

async function ensurePurchaseReturnTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pur_returns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      return_no VARCHAR(50) NOT NULL,
      return_date DATE NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      ref_type VARCHAR(20) NULL,
      ref_id BIGINT UNSIGNED NULL,
      status VARCHAR(20) DEFAULT 'DRAFT',
      remarks TEXT,
      sub_total DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      total_amount DECIMAL(18,2) DEFAULT 0,
      created_by BIGINT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pur_return_no (company_id, branch_id, return_no),
      INDEX idx_pur_return_scope (company_id, branch_id)
    )
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS pur_return_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      return_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_returned DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      reason_code VARCHAR(50),
      remarks TEXT,
      PRIMARY KEY (id),
      INDEX idx_pur_return (return_id),
      CONSTRAINT fk_pur_return_details_header FOREIGN KEY (return_id) REFERENCES pur_returns(id) ON DELETE CASCADE
    )
  `).catch(() => null);
}
async function nextPurchaseReturnNo(companyId, branchId) {
  const rows = await query(
    `SELECT return_no
     FROM pur_returns
     WHERE company_id = :companyId AND branch_id = :branchId
       AND return_no REGEXP '^PR-[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(return_no, 4) AS UNSIGNED) DESC
     LIMIT 1`,
    { companyId, branchId },
  ).catch(() => []);
  let nextNum = 1;
  if (rows.length) {
    const prev = String(rows[0].return_no || "");
    const num = parseInt(prev.slice(3), 10);
    if (Number.isFinite(num)) nextNum = num + 1;
  }
  return `PR-${String(nextNum).padStart(6, "0")}`;
}
async function ensureDebitNoteVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "DN",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'DN', 'Debit Note', 'DEBIT_NOTE', 'DN', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "DN" });
  return id || 0;
}
async function resolveDefaultInventoryAccountId(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature = 'ASSET'
      AND (LOWER(a.name) LIKE '%inventory%' OR a.code IN ('1300','130000'))
    ORDER BY a.code ASC
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function ensureShippingAdviceStatusEnum() {
  const rows = await query(
    `SELECT column_type, column_default
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'pur_shipping_advices'
       AND column_name = 'status'`,
  );
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasDesired =
    colType.includes("'DRAFT'") &&
    colType.includes("'IN_TRANSIT'") &&
    colType.includes("'ARRIVED'") &&
    colType.includes("'CANCELLED'") &&
    colType.includes("'CLEARED'");
  if (!hasDesired) {
    await pool.query(
      "ALTER TABLE pur_shipping_advices MODIFY COLUMN status ENUM('DRAFT','IN_TRANSIT','ARRIVED','CANCELLED','CLEARED') NOT NULL DEFAULT 'IN_TRANSIT'",
    );
  } else {
    const defVal = String(rows?.[0]?.column_default || "").toUpperCase();
    if (defVal !== "IN_TRANSIT" && defVal !== "'IN_TRANSIT'") {
      await pool.query(
        "ALTER TABLE pur_shipping_advices MODIFY COLUMN status ENUM('DRAFT','IN_TRANSIT','ARRIVED','CANCELLED','CLEARED') NOT NULL DEFAULT 'IN_TRANSIT'",
      );
    }
  }
}

async function ensureShippingAdviceETDColumn() {
  const hasEtd = await hasColumn("pur_shipping_advices", "etd_date");
  if (!hasEtd) {
    try {
      await pool.query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN etd_date DATE NULL AFTER container_no",
      );
    } catch {}
  }
}

async function ensurePortClearanceStatusEnum() {
  const rows = await query(
    `SELECT column_type, column_default
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'pur_port_clearances'
       AND column_name = 'status'`,
  );
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasPending = colType.includes("'PENDING'");
  const hasInProgress = colType.includes("'IN_PROGRESS'");
  const hasCleared = colType.includes("'CLEARED'");
  const hasCancelled = colType.includes("'CANCELLED'");
  // Preserve legacy 'DRAFT' if present to avoid breaking existing rows
  const desired = "ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT')";
  const hasDesired = hasPending && hasInProgress && hasCleared && hasCancelled;
  if (!hasDesired || !colType.includes("'DRAFT'")) {
    await pool.query(
      "ALTER TABLE pur_port_clearances MODIFY COLUMN status ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT') NOT NULL DEFAULT 'PENDING'",
    );
  } else {
    const defVal = String(rows?.[0]?.column_default || "").toUpperCase();
    if (defVal !== "PENDING" && defVal !== "'PENDING'") {
      await pool.query(
        "ALTER TABLE pur_port_clearances MODIFY COLUMN status ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT') NOT NULL DEFAULT 'PENDING'",
      );
    }
  }
}

// --- SUPPLIERS ---

router.get(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE", "PURCHASE.RFQ.VIEW"]),
  async (req, res, next) => {
    try {
      await ensurePurchaseReturnTables();
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT r.id, r.return_no, r.return_date, r.status, r.total_amount,
               s.supplier_name, r.supplier_id
        FROM pur_returns r
        LEFT JOIN pur_suppliers s
          ON s.id = r.supplier_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        ORDER BY r.return_date DESC, r.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/returns/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE", "PURCHASE.RFQ.VIEW"]),
  async (req, res, next) => {
    try {
      await ensurePurchaseReturnTables();
      const { companyId, branchId } = req.scope;
      const nextNo = await nextPurchaseReturnNo(companyId, branchId);
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensurePurchaseReturnTables();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const return_no =
        String(body.return_no || "").trim() ||
        (await nextPurchaseReturnNo(companyId, branchId));
      const return_date = body.return_date
        ? String(body.return_date).slice(0, 10)
        : toYmd(new Date());
      const supplier_id = Number(body.supplier_id || 0);
      const warehouse_id =
        body.warehouse_id == null
          ? null
          : Number(body.warehouse_id || 0) || null;
      const remarks = body.remarks || null;
      const items = Array.isArray(body.items) ? body.items : [];
      if (!Number.isFinite(supplier_id) || supplier_id <= 0 || !items.length) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      let sub_total = 0;
      let tax_total = 0;
      const ids = Array.from(
        new Set(
          (items || [])
            .map((x) => Number(x?.item_id || x?.itemId || 0))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      );
      let rateMap = new Map();
      if (ids.length) {
        const placeholders = ids.map((_, i) => `:i${i}`).join(", ");
        const params = { companyId };
        ids.forEach((v, i) => (params[`i${i}`] = v));
        const rows = await query(
          `
          SELECT it.id AS item_id,
                 it.vat_on_purchase_id AS tax_id,
                 COALESCE(tc.rate_percent, 0) AS rate_percent
          FROM inv_items it
          LEFT JOIN fin_tax_codes tc
            ON tc.company_id = it.company_id
           AND tc.id = it.vat_on_purchase_id
          WHERE it.company_id = :companyId
            AND it.id IN (${placeholders})
          `,
          params,
        ).catch(() => []);
        for (const r of rows || []) {
          rateMap.set(Number(r.item_id), Number(r.rate_percent || 0));
        }
      }
      const normalized = [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.qty_returned || it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const reason_code = String(it?.reason_code || "").trim() || null;
        const lineRemarks = it?.remarks || null;
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        const line_total = Math.round(qty * unit_price * 100) / 100;
        const rate = Number(rateMap.get(item_id) || 0);
        const line_tax =
          Math.round(((qty * unit_price * rate) / 100) * 100) / 100;
        sub_total += line_total;
        tax_total += line_tax;
        normalized.push({
          item_id,
          qty,
          unit_price,
          total_amount: line_total,
          tax_amount: line_tax,
          reason_code,
          remarks: lineRemarks,
        });
      }
      const total_amount = Math.round((sub_total + tax_total) * 100) / 100;
      const created_by = req.user?.sub || null;
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO pur_returns
          (company_id, branch_id, return_no, return_date, supplier_id, warehouse_id, remarks, sub_total, tax_amount, total_amount, created_by)
        VALUES
          (:companyId, :branchId, :return_no, :return_date, :supplier_id, :warehouse_id, :remarks, :sub_total, :tax_amount, :total_amount, :created_by)
        `,
        {
          companyId,
          branchId,
          return_no,
          return_date,
          supplier_id,
          warehouse_id,
          remarks,
          sub_total,
          tax_amount: tax_total,
          total_amount,
          created_by,
        },
      );
      const return_id = Number(hdr?.insertId || 0) || 0;
      for (const ln of normalized) {
        await conn.execute(
          `
          INSERT INTO pur_return_details
            (return_id, item_id, qty_returned, unit_price, total_amount, tax_amount, reason_code, remarks)
          VALUES
            (:return_id, :item_id, :qty_returned, :unit_price, :total_amount, :tax_amount, :reason_code, :remarks)
          `,
          {
            return_id,
            item_id: ln.item_id,
            qty_returned: ln.qty,
            unit_price: ln.unit_price,
            total_amount: ln.total_amount,
            tax_amount: ln.tax_amount,
            reason_code: ln.reason_code,
            remarks: ln.remarks,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouse_id, :item_id, :qty)
           ON DUPLICATE KEY UPDATE qty = GREATEST(0, qty - :qty)`,
          {
            companyId,
            branchId,
            warehouse_id,
            item_id: ln.item_id,
            qty: ln.qty,
          },
        );
      }
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      const voucherTypeId = await ensureDebitNoteVoucherTypeIdTx(conn, {
        companyId,
      });
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = return_date || toYmd(new Date());
      const supplierAccId = await ensureSupplierFinAccountIdTx(conn, {
        companyId,
        supplierId: supplier_id,
      });
      const inventoryAccId =
        (await resolveFinAccountId(conn, {
          companyId,
          accountRef: "130000",
        })) || (await resolveDefaultInventoryAccountId(conn, { companyId }));
      const vatInputAccId = await resolveVatInputAccountIdAuto(conn, {
        companyId,
      });
      if (!supplierAccId || !inventoryAccId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Required Finance accounts not found for posting",
        );
      }
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration: `Purchase Return ${return_no} debit note`,
          totalDebit: total_amount,
          totalCredit: total_amount,
          createdBy: created_by,
          approvedBy: created_by,
          postedBy: created_by,
        },
      );
      const voucherId = Number(vIns?.insertId || 0) || 0;
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: supplierAccId,
          description: `Debit note supplier`,
          debit: Math.round(total_amount * 100) / 100,
          referenceNo: return_no,
        },
      );
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: inventoryAccId,
          description: `Inventory reduction on ${return_no}`,
          credit: Math.round(sub_total * 100) / 100,
          referenceNo: return_no,
        },
      );
      if (tax_total > 0 && vatInputAccId) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: vatInputAccId,
            description: `VAT input reversal on ${return_no}`,
            credit: Math.round(tax_total * 100) / 100,
            referenceNo: return_no,
          },
        );
      }
      await conn.commit();
      res.status(201).json({
        id: return_id,
        return_no,
        total_amount,
        voucher_id: voucherId,
        voucher_no: voucherNo,
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
  "/suppliers/next-code",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      // Find the max number from existing SU-xxxxxx codes across suppliers and fin_accounts
      const [supRows] = await query(
        `SELECT MAX(CAST(SUBSTRING(supplier_code, 4) AS UNSIGNED)) AS maxnum
         FROM pur_suppliers
         WHERE company_id = :companyId
           AND supplier_code REGEXP '^SU-[0-9]{6}$'`,
        { companyId },
      );
      const [accRows] = await query(
        `SELECT MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)) AS maxnum
         FROM fin_accounts
         WHERE company_id = :companyId
           AND code REGEXP '^SU-[0-9]{6}$'`,
        { companyId },
      );
      const maxnum = Math.max(
        Number(supRows?.[0]?.maxnum || 0),
        Number(accRows?.[0]?.maxnum || 0),
      );
      const nextNum = maxnum + 1;
      const code = `SU-${String(nextNum).padStart(6, "0")}`;
      res.json({ code });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/service-executions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureServiceExecutionTables();
      const type =
        req.query.type &&
        ["INTERNAL", "EXTERNAL"].includes(String(req.query.type).toUpperCase())
          ? String(req.query.type).toUpperCase()
          : null;
      const items = await query(
        `
        SELECT 
          e.id, e.execution_no, e.execution_date, e.scheduled_time, e.status,
          e.assigned_supervisor_user_id, e.assigned_supervisor_username,
          o.order_no, o.order_type, o.customer_name, o.service_category AS service_type
        FROM pur_service_executions e
        JOIN pur_service_orders o ON o.id = e.order_id
        WHERE e.company_id = :companyId AND e.branch_id = :branchId
          ${type ? "AND o.order_type = :type" : ""}
        ORDER BY e.id DESC
        LIMIT 200
        `,
        { companyId, branchId, type },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.post(
  "/service-executions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, userId } = req.scope;
      const body = req.body || {};
      await ensureServiceExecutionTables();
      await conn.beginTransaction();
      const execNo =
        String(body.execution_no || "").trim() ||
        (await nextServiceExecutionNo(companyId, branchId));
      const [resExec] = await conn.execute(
        `
        INSERT INTO pur_service_executions (
          company_id, branch_id, order_id, execution_no, execution_date, scheduled_time,
          assigned_supervisor_user_id, assigned_supervisor_username, requisition_notes, status, created_by
        ) VALUES (
          :companyId, :branchId, :order_id, :execution_no, :execution_date, :scheduled_time,
          :assigned_supervisor_user_id, :assigned_supervisor_username, :requisition_notes, :status, :created_by
        )
        `,
        {
          companyId,
          branchId,
          order_id: Number(body.order_id || 0) || null,
          execution_no: execNo,
          execution_date: body.execution_date || null,
          scheduled_time: body.scheduled_time || null,
          assigned_supervisor_user_id:
            body.assigned_supervisor_user_id === undefined
              ? null
              : Number(body.assigned_supervisor_user_id || 0) || null,
          assigned_supervisor_username:
            body.assigned_supervisor_username || null,
          requisition_notes: body.requisition_notes || null,
          status: body.status || "PENDING",
          created_by: userId || null,
        },
      );
      const execId = Number(resExec?.insertId || 0);
      const materials = Array.isArray(body.materials) ? body.materials : [];
      for (const m of materials) {
        await conn.execute(
          `
          INSERT INTO pur_service_execution_materials (
            execution_id, item_id, name, unit, qty, note
          ) VALUES (
            :execution_id, :item_id, :name, :unit, :qty, :note
          )
          `,
          {
            execution_id: execId,
            item_id: m.code ? Number(m.code) || null : null,
            name: m.name || null,
            unit: m.unit || null,
            qty: Number(m.qty || 0) || null,
            note: m.note || null,
          },
        );
      }
      await conn.commit();
      res.json({ id: execId, execution_no: execNo });
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
  "/service-executions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["PURCHASE.ORDER.MANAGE"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensureServiceExecutionTables();
      const rows = await query(
        `
        SELECT 
          e.id, e.execution_no, e.execution_date, e.scheduled_time, e.status,
          e.assigned_supervisor_user_id, e.assigned_supervisor_username,
          e.requisition_notes,
          o.order_no, o.order_type
        FROM pur_service_executions e
        JOIN pur_service_orders o ON o.id = e.order_id
        WHERE e.company_id = :companyId AND e.branch_id = :branchId AND e.id = :id
        LIMIT 1
        `,
        { companyId, branchId, id },
      );
      const base = rows?.[0] || null;
      if (!base)
        throw httpError(404, "NOT_FOUND", "Service execution not found");
      const materials = await query(
        `
        SELECT 
          item_id AS code,
          name,
          unit,
          qty,
          note
        FROM pur_service_execution_materials
        WHERE execution_id = :id
        ORDER BY id ASC
        `,
        { id },
      );
      res.json({ item: { ...base, materials } });
    } catch (err) {
      next(err);
    }
  },
);
router.put(
  "/shipping-advices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const adviceDate = body.advice_date || new Date();
      const poId = toNumber(body.po_id);
      const supplierId = toNumber(body.supplier_id);
      if (!poId || !supplierId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "PO and Supplier are required",
        );

      await ensureShippingAdviceStatusEnum();
      await ensureShippingAdviceETDColumn();
      await conn.beginTransaction();

      const [exists] = await conn.execute(
        `SELECT id FROM pur_shipping_advices 
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!Array.isArray(exists) || !exists.length) {
        throw httpError(404, "NOT_FOUND", "Shipping Advice not found");
      }

      await conn.execute(
        `UPDATE pur_shipping_advices SET
           advice_date = :adviceDate,
           po_id = :poId,
           supplier_id = :supplierId,
           bill_of_lading = :bl,
           vessel_name = :vessel,
           container_no = :container,
           etd_date = :etd,
           eta_date = :eta,
           status = :status,
           remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          adviceDate,
          poId,
          supplierId,
          bl: body.bill_of_lading ?? null,
          vessel: body.vessel_name ?? null,
          container: body.container_no ?? null,
          etd: body.etd_date ?? null,
          eta: body.eta_date ?? null,
          status: body.status || "IN_TRANSIT",
          remarks: body.remarks ?? null,
        },
      );

      await conn.execute(
        `DELETE FROM pur_shipping_advice_details WHERE advice_id = :id`,
        { id },
      );
      const details = Array.isArray(body.details) ? body.details : [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty_shipped);
        if (!itemId || !qty) continue;
        await conn.execute(
          `INSERT INTO pur_shipping_advice_details (advice_id, item_id, qty_shipped, remarks)
           VALUES (:adviceId, :itemId, :qty, :remarks)`,
          { adviceId: id, itemId, qty, remarks: d.remarks || null },
        );
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
router.get(
  "/supplier-quotations/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;

      const sql = `SELECT MAX(CAST(SUBSTRING(quotation_no, 4) AS UNSIGNED)) AS maxnum
         FROM pur_supplier_quotations
         WHERE company_id = :companyId
           AND branch_id = :branchId
           AND quotation_no REGEXP '^SQ-[0-9]{6}$'`;

      const rows = await query(sql, { companyId, branchId });
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      const nextNo = `SQ-${String(next).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/suppliers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const { active, contractor } = req.query;

      await ensureSupplierTypeColumn();
      await ensureSupplierCurrencyColumn();
      await ensureSupplierServiceContractorColumn();

      let sql = "SELECT * FROM pur_suppliers WHERE company_id = :companyId";
      const params = { companyId };

      if (active === "true") {
        sql += " AND is_active = 1";
      } else if (active === "false") {
        sql += " AND is_active = 0";
      }
      if (contractor === "Y") {
        sql += " AND service_contractor = 'Y'";
      } else if (contractor === "N") {
        sql += " AND service_contractor = 'N'";
      }

      sql += " ORDER BY supplier_name ASC";

      const rows = await query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/suppliers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensureSupplierTypeColumn();
      await ensureSupplierCurrencyColumn();
      await ensureSupplierServiceContractorColumn();
      const rows = await query(
        "SELECT * FROM pur_suppliers WHERE id = :id AND company_id = :companyId",
        { id, companyId },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Supplier not found");
      res.json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/suppliers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId } = req.scope;
      const body = req.body || {};

      await ensureSupplierTypeColumn();
      await ensureSupplierCurrencyColumn();
      await ensureSupplierServiceContractorColumn();

      await conn.beginTransaction();
      let supplierCode =
        body.supplier_code && String(body.supplier_code).trim()
          ? String(body.supplier_code).trim()
          : null;
      if (supplierCode) {
        const [dupSup] = await conn.execute(
          "SELECT id FROM pur_suppliers WHERE company_id = :companyId AND supplier_code = :code LIMIT 1",
          { companyId, code: supplierCode },
        );
        const [dupAcc] = await conn.execute(
          "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
          { companyId, code: supplierCode },
        );
        if (dupSup.length || dupAcc.length) {
          supplierCode = null;
        }
      }
      if (!supplierCode) {
        const [mxRows] = await conn.execute(
          `
          SELECT MAX(CAST(SUBSTRING(supplier_code, 4) AS UNSIGNED)) AS maxnum
          FROM pur_suppliers
          WHERE company_id = :companyId
            AND supplier_code REGEXP '^SU-[0-9]{6}$'
          `,
          { companyId },
        );
        const [mxAccRows] = await conn.execute(
          `
          SELECT MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)) AS maxnum
          FROM fin_accounts
          WHERE company_id = :companyId
            AND code REGEXP '^SU-[0-9]{6}$'
          `,
          { companyId },
        );
        const currentMax = Math.max(
          Number(mxRows?.[0]?.maxnum || 0),
          Number(mxAccRows?.[0]?.maxnum || 0),
        );
        const nextNum = currentMax + 1;
        supplierCode = `SU-${String(nextNum).padStart(6, "0")}`;
      }

      const [resHeader] = await conn.execute(
        `INSERT INTO pur_suppliers (company_id, supplier_code, supplier_name, contact_person, email, phone, address, payment_terms, supplier_type, currency_id, service_contractor, is_active)
         VALUES (:companyId, :supplierCode, :supplierName, :contactPerson, :email, :phone, :address, :paymentTerms, :supplierType, :currencyId, :serviceContractor, :isActive)`,
        {
          companyId,
          supplierCode,
          supplierName: body.supplier_name,
          contactPerson: body.contact_person || null,
          email: body.email || null,
          phone: body.phone || null,
          address: body.address || null,
          paymentTerms: body.payment_terms || null,
          supplierType: body.supplier_type || "LOCAL",
          currencyId:
            body.currency_id === undefined || body.currency_id === null
              ? null
              : Number(body.currency_id || 0) || null,
          serviceContractor:
            String(body.service_contractor || "").toUpperCase() === "Y"
              ? "Y"
              : "N",
          isActive:
            body.is_active !== undefined ? Boolean(body.is_active) : true,
        },
      );
      const [grpByCode] = await conn.execute(
        "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = 'CREDITORS' LIMIT 1",
        { companyId },
      );
      let groupId = Number(grpByCode?.[0]?.id || 0);
      if (!groupId) {
        try {
          const [insGrp] = await conn.execute(
            "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (:companyId, 'CREDITORS', 'Creditors', 'LIABILITY', NULL, 1)",
            { companyId },
          );
          groupId = Number(insGrp.insertId || 0);
        } catch {
          const [retry] = await conn.execute(
            "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND (code = 'CREDITORS' OR name = 'Creditors') LIMIT 1",
            { companyId },
          );
          groupId = Number(retry?.[0]?.id || 0);
        }
      }
      if (groupId) {
        const finCode = supplierCode;
        const [exists] = await conn.execute(
          "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
          { companyId, code: finCode },
        );
        if (!Array.isArray(exists) || !exists.length) {
          await conn.execute(
            `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
             VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
            {
              companyId,
              groupId,
              code: finCode,
              name: body.supplier_name,
              currencyId:
                body.currency_id === undefined || body.currency_id === null
                  ? null
                  : Number(body.currency_id || 0) || null,
            },
          );
        }
      }
      await conn.commit();
      res.status(201).json({ id: resHeader.insertId });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/suppliers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};

      await ensureSupplierTypeColumn();
      await ensureSupplierCurrencyColumn();
      await ensureSupplierServiceContractorColumn();

      await conn.execute(
        `UPDATE pur_suppliers SET
         supplier_code = :supplierCode,
         supplier_name = :supplierName,
         contact_person = :contactPerson,
         email = :email,
         phone = :phone,
         address = :address,
         payment_terms = :paymentTerms,
         supplier_type = :supplierType,
         currency_id = :currencyId,
         service_contractor = :serviceContractor,
         is_active = :isActive
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          supplierCode: body.supplier_code || null,
          supplierName: body.supplier_name,
          contactPerson: body.contact_person || null,
          email: body.email || null,
          phone: body.phone || null,
          address: body.address || null,
          paymentTerms: body.payment_terms || null,
          supplierType: body.supplier_type || "LOCAL",
          currencyId:
            body.currency_id === undefined || body.currency_id === null
              ? null
              : Number(body.currency_id || 0) || null,
          serviceContractor:
            String(body.service_contractor || "").toUpperCase() === "Y"
              ? "Y"
              : "N",
          isActive:
            body.is_active !== undefined ? Boolean(body.is_active) : true,
        },
      );
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

// --- RFQs ---

router.get(
  "/rfqs/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;

      const sql = `SELECT MAX(CAST(SUBSTRING(rfq_no, 4) AS UNSIGNED)) AS maxnum
         FROM pur_rfqs
         WHERE company_id = :companyId
           AND branch_id = :branchId
           AND rfq_no REGEXP '^RQ-[0-9]{6}$'`;

      const rows = await query(sql, { companyId, branchId });
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      const nextNo = `RQ-${String(next).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/rfqs",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `SELECT r.*, COALESCE(s.cnt, 0) AS supplier_count
         FROM pur_rfqs r
         LEFT JOIN (
           SELECT rfq_id, COUNT(*) AS cnt
           FROM pur_rfq_suppliers
           GROUP BY rfq_id
         ) s ON s.rfq_id = r.id
         WHERE r.company_id = :companyId AND r.branch_id = :branchId
         ORDER BY r.rfq_date DESC, r.id DESC`,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/grns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      const body = req.body || {};
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureGrnUomConversionColumns();
      await ensureUnitConversionsTable();

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
      const itemUomCache = new Map();
      const conversionCache = new Map();

      const resolveItemUom = async (itemId) => {
        if (itemUomCache.has(itemId)) return itemUomCache.get(itemId);
        const [rows] = await conn.execute(
          "SELECT uom FROM inv_items WHERE company_id = :companyId AND id = :itemId LIMIT 1",
          { companyId, itemId },
        );
        const uom = rows?.[0]?.uom ? String(rows[0].uom) : "";
        itemUomCache.set(itemId, uom);
        return uom;
      };

      const resolveConversionFactor = async (itemId, fromUom, toUom) => {
        const key = `${itemId}|${fromUom}|${toUom}`;
        if (conversionCache.has(key)) return conversionCache.get(key);
        const [rows] = await conn.execute(
          `SELECT conversion_factor
           FROM inv_unit_conversions
           WHERE company_id = :companyId
             AND item_id = :itemId
             AND from_uom = :fromUom
             AND to_uom = :toUom
             AND is_active = 1
           LIMIT 1`,
          { companyId, itemId, fromUom, toUom },
        );
        const factor = Number(rows?.[0]?.conversion_factor || 0);
        const value = Number.isFinite(factor) && factor > 0 ? factor : null;
        conversionCache.set(key, value);
        return value;
      };

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const inputQty =
          d.input_qty === "" || d.input_qty == null
            ? Number(d.qty_received)
            : Number(d.input_qty);
        if (!itemId || !Number.isFinite(inputQty)) continue;
        const defaultUom = await resolveItemUom(itemId);
        const inputUom = String(
          d.input_uom || d.uom || defaultUom || "",
        ).trim();
        let baseQty = inputQty;
        if (inputUom && defaultUom && String(inputUom) !== String(defaultUom)) {
          const factor = await resolveConversionFactor(
            itemId,
            String(inputUom),
            String(defaultUom),
          );
          if (!factor) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Missing unit conversion for item ${itemId}: ${inputUom} -> ${defaultUom}`,
            );
          }
          baseQty = inputQty * factor;
        }
        const qtyReceived = baseQty;
        const qtyAccepted = Number.isFinite(Number(d.qty_accepted))
          ? Number(d.qty_accepted)
          : qtyReceived;

        cleanDetails.push({
          itemId,
          qtyOrdered: Number(d.qty_ordered) || 0,
          qtyReceived,
          qtyAccepted,
          qtyRejected: Number(d.qty_rejected) || 0,
          uom: defaultUom || inputUom || "PCS",
          unitPrice: Number(d.unit_price) || 0,
          lineAmount: Number(d.line_amount) || 0,
          remarks: d.remarks || null,
          inputUom: inputUom || null,
          inputQty,
        });
      }

      await ensureStockBalancesWarehouseInfrastructure();
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
          invoiceAmount: body.invoice_amount || 0,
          invoiceDueDate: body.invoice_due_date || null,
          billOfLading: body.bill_of_lading || null,
          customsEntryNo: body.customs_entry_no || null,
          shippingCompany: body.shipping_company || null,
          portOfEntry: body.port_of_entry || null,
          remarks: body.remarks || null,
        },
      );

      const prev = await query(
        `SELECT item_id, SUM(qty_accepted) AS qty
         FROM inv_goods_receipt_note_details
         WHERE grn_id = :id
         GROUP BY item_id`,
        { id },
      );
      const prevMap = new Map();
      prev.forEach((r) => prevMap.set(Number(r.item_id), Number(r.qty)));
      const newMap = new Map();
      await conn.execute(
        "DELETE FROM inv_goods_receipt_note_details WHERE grn_id = ?",
        [id],
      );
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
           (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount, remarks, input_uom, input_qty)
           VALUES
           (:grnId, :itemId, :qtyOrdered, :qtyReceived, :qtyAccepted, :qtyRejected, :uom, :unitPrice, :lineAmount, :remarks, :inputUom, :inputQty)`,
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
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.get(
  "/rfqs/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `SELECT * FROM pur_rfqs WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "RFQ not found");
      const details = await query(
        `SELECT d.*, i.item_name, i.item_code FROM pur_rfq_details d JOIN inv_items i ON i.id = d.item_id WHERE d.rfq_id = :id`,
        { id },
      );
      const supplierRows = await query(
        `SELECT rs.supplier_id, s.supplier_name, s.email, s.phone
         FROM pur_rfq_suppliers rs
         JOIN pur_suppliers s ON s.id = rs.supplier_id
         WHERE rs.rfq_id = :id`,
        { id },
      );
      res.json({
        item: rows[0],
        items: details,
        suppliers: supplierRows,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/rfqs",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      await ensureGrnUomConversionColumns();
      await ensureGrnUomConversionColumns();
      const rfqNo = body.rfq_no || nextDocNo("RQ");
      const rfqDate = body.rfq_date || new Date();
      const expiryDate = body.expiry_date || null;

      const items = Array.isArray(body.items) ? body.items : [];
      const supplierIds = Array.isArray(body.supplier_ids)
        ? body.supplier_ids.map((x) => toNumber(x)).filter(Boolean)
        : [];

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `INSERT INTO pur_rfqs (company_id, branch_id, rfq_no, rfq_date, expiry_date, status, delivery_terms, terms_conditions, remarks, created_by)
         VALUES (:companyId, :branchId, :rfqNo, :rfqDate, :expiryDate, :status, :deliveryTerms, :termsConditions, :remarks, :createdBy)`,
        {
          companyId,
          branchId,
          rfqNo,
          rfqDate,
          expiryDate,
          status: body.status || "DRAFT",
          deliveryTerms: body.delivery_terms || null,
          termsConditions: body.terms_conditions || null,
          remarks: body.remarks || null,
          createdBy: req.user.sub,
        },
      );
      const rfqId = hdr.insertId;

      for (const d of items) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        if (!itemId || !qty) continue;
        await conn.execute(
          `INSERT INTO pur_rfq_details (rfq_id, item_id, qty, required_date) VALUES (:rfqId, :itemId, :qty, :reqDate)`,
          {
            rfqId,
            itemId,
            qty,
            reqDate: d.required_date || null,
          },
        );
      }

      for (const supplierId of supplierIds) {
        await conn.execute(
          `INSERT INTO pur_rfq_suppliers (rfq_id, supplier_id) VALUES (:rfqId, :supplierId)`,
          { rfqId, supplierId },
        );
      }
      await conn.commit();
      res.status(201).json({ id: rfqId, rfq_no: rfqNo });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/rfqs/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.RFQ.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const rfqDate = body.rfq_date || new Date();
      const expiryDate = body.expiry_date || null;
      const items = Array.isArray(body.items) ? body.items : [];
      const supplierIds = Array.isArray(body.supplier_ids)
        ? body.supplier_ids.map((x) => toNumber(x)).filter(Boolean)
        : [];

      const [existing] = await conn.execute(
        "SELECT status FROM pur_rfqs WHERE id = ? AND company_id = ? AND branch_id = ?",
        [id, companyId, branchId],
      );
      if (!existing.length) throw httpError(404, "NOT_FOUND", "RFQ not found");

      await conn.beginTransaction();

      await conn.execute(
        `UPDATE pur_rfqs SET
           rfq_date = :rfqDate,
           expiry_date = :expiryDate,
           status = :status,
           delivery_terms = :deliveryTerms,
           terms_conditions = :termsConditions,
           remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          rfqDate,
          expiryDate,
          status: body.status || existing[0].status,
          deliveryTerms: body.delivery_terms || null,
          termsConditions: body.terms_conditions || null,
          remarks: body.remarks || null,
        },
      );

      await conn.execute("DELETE FROM pur_rfq_details WHERE rfq_id = ?", [id]);
      for (const d of items) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        if (!itemId || !qty) continue;
        await conn.execute(
          `INSERT INTO pur_rfq_details (rfq_id, item_id, qty, required_date) VALUES (:rfqId, :itemId, :qty, :reqDate)`,
          {
            rfqId: id,
            itemId,
            qty,
            reqDate: d.required_date || null,
          },
        );
      }

      await conn.execute("DELETE FROM pur_rfq_suppliers WHERE rfq_id = ?", [
        id,
      ]);
      for (const supplierId of supplierIds) {
        await conn.execute(
          `INSERT INTO pur_rfq_suppliers (rfq_id, supplier_id) VALUES (:rfqId, :supplierId)`,
          { rfqId: id, supplierId },
        );
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

// --- SUPPLIER QUOTATIONS ---

router.get(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensureSupplierTypeColumn();
      const rows = await query(
        `SELECT q.*, s.supplier_name, s.supplier_type 
         FROM pur_supplier_quotations q 
         JOIN pur_suppliers s ON s.id = q.supplier_id 
         WHERE q.company_id = :companyId AND q.branch_id = :branchId 
         ORDER BY q.quotation_date DESC, q.id DESC`,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/supplier-quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `SELECT q.*, s.supplier_name 
         FROM pur_supplier_quotations q 
         JOIN pur_suppliers s ON s.id = q.supplier_id 
         WHERE q.company_id = :companyId AND q.branch_id = :branchId 
         ORDER BY q.quotation_date DESC, q.id DESC`,
        { companyId, branchId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensureSupplierTypeColumn();

      const rows = await query(
        `SELECT q.*, s.supplier_name 
         FROM pur_supplier_quotations q 
         JOIN pur_suppliers s ON s.id = q.supplier_id 
         WHERE q.id = :id AND q.company_id = :companyId AND q.branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Quotation not found");

      const details = await query(
        `SELECT d.*, i.item_name, i.item_code 
         FROM pur_supplier_quotation_details d 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE d.quotation_id = :id`,
        { id },
      );
      res.json({ item: { ...rows[0], details }, details });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/supplier-quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `SELECT q.*, s.supplier_name 
         FROM pur_supplier_quotations q 
         JOIN pur_suppliers s ON s.id = q.supplier_id 
         WHERE q.id = :id AND q.company_id = :companyId AND q.branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Quotation not found");

      const details = await query(
        `SELECT d.*, i.item_name, i.item_code 
         FROM pur_supplier_quotation_details d 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE d.quotation_id = :id`,
        { id },
      );
      res.json({ item: { ...rows[0], details }, details });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const quotationNo = body.quotation_no || nextDocNo("SQ");
      const quotationDate = body.quotation_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      const rfqId = toNumber(body.rfq_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const details = Array.isArray(body.details) ? body.details : [];
      let totalAmount = 0;

      const cleanDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (!itemId || !qty) continue;

        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTotal,
          discountPercent: d.discount_percent || 0,
        });
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `INSERT INTO pur_supplier_quotations 
         (company_id, branch_id, quotation_no, quotation_date, supplier_id, rfq_id, 
          valid_until, total_amount, status, remarks, currency_id, exchange_rate, created_by)
         VALUES 
         (:companyId, :branchId, :quotationNo, :quotationDate, :supplierId, :rfqId,
          :validUntil, :totalAmount, 'DRAFT', :remarks, :currencyId, :exchangeRate, :createdBy)`,
        {
          companyId,
          branchId,
          quotationNo,
          quotationDate,
          supplierId,
          rfqId: rfqId || null,
          validUntil: body.valid_until || null,
          totalAmount,
          remarks: body.remarks,
          currencyId: body.currency_id || null,
          exchangeRate:
            body.exchange_rate === undefined || body.exchange_rate === null
              ? 1
              : Number(body.exchange_rate || 1),
          createdBy: req.user.sub,
        },
      );
      const quotationId = hdr.insertId;

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_supplier_quotation_details 
               (quotation_id, item_id, qty, unit_price, line_total, discount_percent)
               VALUES (:quotationId, :itemId, :qty, :unitPrice, :lineTotal, :discountPercent)`,
          { quotationId, ...d },
        );
      }
      await conn.commit();
      res.status(201).json({ id: quotationId, quotation_no: quotationNo });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.post(
  "/supplier-quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const quotationNo = body.quotation_no || nextDocNo("SQ");
      const quotationDate = body.quotation_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      const rfqId = toNumber(body.rfq_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const details = Array.isArray(body.details) ? body.details : [];
      let totalAmount = 0;

      const cleanDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (!itemId || !qty) continue;

        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTotal,
          discountPercent: d.discount_percent || 0,
        });
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `INSERT INTO pur_supplier_quotations 
         (company_id, branch_id, quotation_no, quotation_date, supplier_id, rfq_id, 
          valid_until, total_amount, status, remarks, currency_id, exchange_rate, created_by)
         VALUES 
         (:companyId, :branchId, :quotationNo, :quotationDate, :supplierId, :rfqId,
          :validUntil, :totalAmount, 'DRAFT', :remarks, :currencyId, :exchangeRate, :createdBy)`,
        {
          companyId,
          branchId,
          quotationNo,
          quotationDate,
          supplierId,
          rfqId: rfqId || null,
          validUntil: body.valid_until || null,
          totalAmount,
          remarks: body.remarks,
          currencyId: body.currency_id || null,
          exchangeRate:
            body.exchange_rate === undefined || body.exchange_rate === null
              ? 1
              : Number(body.exchange_rate || 1),
          createdBy: req.user.sub,
        },
      );
      const quotationId = hdr.insertId;

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_supplier_quotation_details 
               (quotation_id, item_id, qty, unit_price, line_total, discount_percent)
               VALUES (:quotationId, :itemId, :qty, :unitPrice, :lineTotal, :discountPercent)`,
          { quotationId, ...d },
        );
      }
      await conn.commit();
      res.status(201).json({ id: quotationId, quotation_no: quotationNo });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const supplierId = toNumber(body.supplier_id);
      const rfqId = toNumber(body.rfq_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const details = Array.isArray(body.details) ? body.details : [];
      let totalAmount = 0;
      const cleanDetails = [];

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (!itemId || !qty) continue;

        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTotal,
          discountPercent: d.discount_percent || 0,
        });
      }

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE pur_supplier_quotations
         SET quotation_no = :quotationNo,
             quotation_date = :quotationDate,
             supplier_id = :supplierId,
             rfq_id = :rfqId,
             valid_until = :validUntil,
             total_amount = :totalAmount,
             status = :status,
             remarks = :remarks,
             currency_id = :currencyId,
             exchange_rate = :exchangeRate
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          quotationNo: body.quotation_no,
          quotationDate: body.quotation_date || new Date(),
          supplierId,
          rfqId: rfqId || null,
          validUntil: body.valid_until || null,
          totalAmount,
          status: body.status || "DRAFT",
          remarks: body.remarks,
          currencyId: body.currency_id || null,
          exchangeRate:
            body.exchange_rate === undefined || body.exchange_rate === null
              ? 1
              : Number(body.exchange_rate || 1),
        },
      );

      await conn.execute(
        "DELETE FROM pur_supplier_quotation_details WHERE quotation_id = ?",
        [id],
      );

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_supplier_quotation_details 
             (quotation_id, item_id, qty, unit_price, line_total, discount_percent)
             VALUES (:quotationId, :itemId, :qty, :unitPrice, :lineTotal, :discountPercent)`,
          { quotationId: id, ...d },
        );
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

router.put(
  "/supplier-quotations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.QUOTATION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const supplierId = toNumber(body.supplier_id);
      const rfqId = toNumber(body.rfq_id);

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const details = Array.isArray(body.details) ? body.details : [];
      let totalAmount = 0;
      const cleanDetails = [];

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (!itemId || !qty) continue;

        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTotal,
          discountPercent: d.discount_percent || 0,
        });
      }

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE pur_supplier_quotations
         SET quotation_no = :quotationNo,
             quotation_date = :quotationDate,
             supplier_id = :supplierId,
             rfq_id = :rfqId,
             valid_until = :validUntil,
             total_amount = :totalAmount,
             status = :status,
             remarks = :remarks,
             currency_id = :currencyId,
             exchange_rate = :exchangeRate
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          quotationNo: body.quotation_no,
          quotationDate: body.quotation_date || new Date(),
          supplierId,
          rfqId: rfqId || null,
          validUntil: body.valid_until || null,
          totalAmount,
          status: body.status || "DRAFT",
          remarks: body.remarks,
          currencyId: body.currency_id || null,
          exchangeRate:
            body.exchange_rate === undefined || body.exchange_rate === null
              ? 1
              : Number(body.exchange_rate || 1),
        },
      );

      await conn.execute(
        "DELETE FROM pur_supplier_quotation_details WHERE quotation_id = ?",
        [id],
      );

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_supplier_quotation_details 
             (quotation_id, item_id, qty, unit_price, line_total, discount_percent)
             VALUES (:quotationId, :itemId, :qty, :unitPrice, :lineTotal, :discountPercent)`,
          { quotationId: id, ...d },
        );
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

// --- SHIPPING ADVICES ---

router.get(
  "/shipping-advices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  (req, res, next) => listShippingAdvices(req, res, next),
);

router.get(
  "/shipping-advices/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  (req, res, next) => getNextShippingAdviceNo(req, res, next),
);

router.get(
  "/shipping-advices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  (req, res, next) => getShippingAdviceById(req, res, next),
);

router.post(
  "/shipping-advices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  (req, res, next) => createShippingAdvice(req, res, next),
);

router.put(
  "/shipping-advices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  (req, res, next) => updateShippingAdvice(req, res, next),
);

// --- PORT CLEARANCES ---

router.get(
  "/port-clearances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  (req, res, next) => listPortClearances(req, res, next),
);

router.get(
  "/port-clearances/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  (req, res, next) => getNextPortClearanceNo(req, res, next),
);

router.get(
  "/port-clearances/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  (req, res, next) => getPortClearanceById(req, res, next),
);

router.post(
  "/port-clearances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  (req, res, next) => createPortClearance(req, res, next),
);

router.put(
  "/port-clearances/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  (req, res, next) => updatePortClearance(req, res, next),
);

// --- PURCHASE ORDERS ---

router.get(
  "/orders/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const poType = String(req.query.po_type || "").toUpperCase();

      let prefix = "PO";
      if (poType === "IMPORT") prefix = "IP";
      else if (poType === "LOCAL") prefix = "LP";

      const sql = `SELECT MAX(CAST(SUBSTRING(po_no, 4) AS UNSIGNED)) AS maxnum
         FROM pur_orders
         WHERE company_id = :companyId
           AND branch_id = :branchId
           AND po_no REGEXP '^${prefix}-[0-9]{6}$'`;

      const rows = await query(sql, { companyId, branchId });
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      const nextNo = `${prefix}-${String(next).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { status } = req.query;
      let sql = `
        SELECT p.id, p.po_no, p.po_date, p.supplier_id, s.supplier_name, 
               p.total_amount, p.status, p.po_type
        FROM pur_orders p
        JOIN pur_suppliers s ON s.id = p.supplier_id
        WHERE p.company_id = :companyId AND p.branch_id = :branchId
      `;
      if (status) sql += " AND p.status = :status";
      sql += " ORDER BY p.po_date DESC, p.id DESC";
      const rows = await query(sql, { companyId, branchId, status });
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/grns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      await ensureGrnUomConversionColumns();
      await ensureUnitConversionsTable();

      const grnNo = body.grn_no || nextDocNo("GRN");
      const grnDate = body.grn_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      const poId = toNumber(body.po_id);
      const warehouseId = toNumber(body.warehouse_id);
      const portClearanceId = toNumber(body.port_clearance_id);
      const grnType = body.grn_type || "LOCAL";

      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");
      if (!poId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "GRN requires a referenced PO",
        );

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
      const itemUomCache = new Map();
      const conversionCache = new Map();

      const resolveItemUom = async (itemId) => {
        if (itemUomCache.has(itemId)) return itemUomCache.get(itemId);
        const [rows] = await conn.execute(
          "SELECT uom FROM inv_items WHERE company_id = :companyId AND id = :itemId LIMIT 1",
          { companyId, itemId },
        );
        const uom = rows?.[0]?.uom ? String(rows[0].uom) : "";
        itemUomCache.set(itemId, uom);
        return uom;
      };

      const resolveConversionFactor = async (itemId, fromUom, toUom) => {
        const key = `${itemId}|${fromUom}|${toUom}`;
        if (conversionCache.has(key)) return conversionCache.get(key);
        const [rows] = await conn.execute(
          `SELECT conversion_factor
           FROM inv_unit_conversions
           WHERE company_id = :companyId
             AND item_id = :itemId
             AND from_uom = :fromUom
             AND to_uom = :toUom
             AND is_active = 1
           LIMIT 1`,
          { companyId, itemId, fromUom, toUom },
        );
        const factor = Number(rows?.[0]?.conversion_factor || 0);
        const value = Number.isFinite(factor) && factor > 0 ? factor : null;
        conversionCache.set(key, value);
        return value;
      };

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const inputQty =
          d.input_qty === "" || d.input_qty == null
            ? Number(d.qty_received)
            : Number(d.input_qty);
        if (!itemId || !Number.isFinite(inputQty)) continue;
        const defaultUom = await resolveItemUom(itemId);
        const inputUom = String(
          d.input_uom || d.uom || defaultUom || "",
        ).trim();
        let baseQty = inputQty;
        if (inputUom && defaultUom && String(inputUom) !== String(defaultUom)) {
          const factor = await resolveConversionFactor(
            itemId,
            String(inputUom),
            String(defaultUom),
          );
          if (!factor) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Missing unit conversion for item ${itemId}: ${inputUom} -> ${defaultUom}`,
            );
          }
          baseQty = inputQty * factor;
        }
        const qtyReceived = baseQty;
        const qtyAccepted = Number.isFinite(Number(d.qty_accepted))
          ? Number(d.qty_accepted)
          : qtyReceived;

        cleanDetails.push({
          itemId,
          qtyOrdered: Number(d.qty_ordered) || 0,
          qtyReceived,
          qtyAccepted,
          qtyRejected: Number(d.qty_rejected) || 0,
          uom: defaultUom || inputUom || "PCS",
          unitPrice: Number(d.unit_price) || 0,
          lineAmount: Number(d.line_amount) || 0,
          remarks: d.remarks || null,
          inputUom: inputUom || null,
          inputQty,
        });
      }

      await conn.beginTransaction();

      const [resHeader] = await conn.execute(
        `INSERT INTO inv_goods_receipt_notes 
         (company_id, branch_id, grn_no, grn_date, grn_type, po_id, supplier_id, warehouse_id, port_clearance_id,
          invoice_no, invoice_date, invoice_amount, invoice_due_date, bill_of_lading, customs_entry_no, shipping_company, port_of_entry,
          status, remarks, created_by)
         VALUES 
         (:companyId, :branchId, :grnNo, :grnDate, :grnType, :poId, :supplierId, :warehouseId, :portClearanceId,
          :invoiceNo, :invoiceDate, :invoiceAmount, :invoiceDueDate, :billOfLading, :customsEntryNo, :shippingCompany, :portOfEntry,
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
          invoiceAmount: body.invoice_amount || 0,
          invoiceDueDate: body.invoice_due_date || null,
          billOfLading: body.bill_of_lading || null,
          customsEntryNo: body.customs_entry_no || null,
          shippingCompany: body.shipping_company || null,
          portOfEntry: body.port_of_entry || null,
          remarks: body.remarks || null,
          createdBy: req.user.sub,
        },
      );
      const grnId = resHeader.insertId;

      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
           (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount, remarks, input_uom, input_qty)
           VALUES
           (:grnId, :itemId, :qtyOrdered, :qtyReceived, :qtyAccepted, :qtyRejected, :uom, :unitPrice, :lineAmount, :remarks, :inputUom, :inputQty)`,
          { grnId, ...d },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qtyAccepted)
           ON DUPLICATE KEY UPDATE qty = qty + :qtyAccepted`,
          {
            companyId,
            branchId,
            warehouseId,
            itemId: d.itemId,
            qtyAccepted: d.qtyAccepted,
          },
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

router.post(
  "/grns/:id/post",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.GRN.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const [hdrRows] = await conn.execute(
        "SELECT grn_no, status FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
        { id, companyId, branchId },
      );
      if (!hdrRows.length) throw httpError(404, "NOT_FOUND", "GRN not found");
      const status = String(hdrRows[0].status || "DRAFT");
      if (status !== "DRAFT" && status !== "APPROVED") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Only DRAFT/APPROVED GRNs can be posted",
        );
      }
      await conn.beginTransaction();
      const { voucherId, voucherNo, amount } = await postGrnAccrualTx(conn, {
        companyId,
        branchId,
        grnId: id,
        inventoryAccountRef: "1200",
        grnClearingAccountRef: "2100",
      });
      await conn.execute(
        "UPDATE inv_goods_receipt_notes SET status = 'POSTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id, companyId, branchId },
      );
      await conn.commit();
      res.json({
        id,
        status: "POSTED",
        voucher_id: voucherId,
        voucher_no: voucherNo,
        amount,
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

router.post(
  "/bills/:id/post",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT b.*, s.supplier_name, g.grn_no, g.status AS grn_status
           FROM pur_bills b
           JOIN pur_suppliers s ON s.id = b.supplier_id
           LEFT JOIN inv_goods_receipt_notes g ON g.id = b.grn_id
          WHERE b.id = :id AND b.company_id = :companyId AND b.branch_id = :branchId
          LIMIT 1`,
        { id, companyId, branchId },
      );
      const bill = rows?.[0] || null;
      if (!bill) throw httpError(404, "NOT_FOUND", "Purchase bill not found");
      if (!bill.grn_id)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Bill requires a referenced GRN",
        );
      if (
        !bill.grn_status ||
        !["POSTED", "APPROVED"].includes(String(bill.grn_status))
      ) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "GRN must be POSTED or APPROVED before bill posting",
        );
      }
      // Validate bill quantities do not exceed GRN quantities per item
      const [billDetRows] = await conn.execute(
        `SELECT item_id, SUM(qty) AS bill_qty
           FROM pur_bill_details
          WHERE bill_id = :billId
          GROUP BY item_id`,
        { billId: bill.id },
      );
      const [grnDetQtyRows] = await conn.execute(
        `SELECT item_id, SUM(qty_accepted) AS grn_qty
           FROM inv_goods_receipt_note_details
          WHERE grn_id = :grnId
          GROUP BY item_id`,
        { grnId: bill.grn_id },
      );
      const grnQtyByItem = new Map();
      for (const r of grnDetQtyRows || []) {
        grnQtyByItem.set(String(r.item_id), Number(r.grn_qty || 0));
      }
      for (const r of billDetRows || []) {
        const itemKey = String(r.item_id);
        const billQty = Number(r.bill_qty || 0);
        const grnQty = Number(grnQtyByItem.get(itemKey) || 0);
        if (billQty - grnQty > 1e-6) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Bill quantity exceeds GRN accepted quantity for one or more items",
          );
        }
      }
      const rate = Number(bill.exchange_rate || 1);
      const billType = String(bill.bill_type || "LOCAL").toUpperCase();
      const isImport = billType === "IMPORT";
      const goodsExclusive = Math.max(
        0,
        Number(bill.total_amount || 0) - Number(bill.discount_amount || 0),
      );
      const vatAmount = Math.max(0, Number(bill.tax_amount || 0));
      const chargesAmount = Math.max(
        0,
        Number(bill.freight_charges || 0) + Number(bill.other_charges || 0),
      );
      const goodsBase = Math.round(goodsExclusive * rate * 100) / 100;
      const vatBase = Math.round(vatAmount * rate * 100) / 100;
      const chargesBase = Math.round(chargesAmount * rate * 100) / 100;
      const [grnDetRows] = await conn.execute(
        "SELECT SUM(qty_accepted * unit_price) AS goods_base FROM inv_goods_receipt_note_details WHERE grn_id = :grnId",
        { grnId: bill.grn_id },
      );
      const grnGoodsBase =
        Math.round(Number(grnDetRows?.[0]?.goods_base || 0) * 100) / 100;
      // Validate bill value (exclusive of VAT and charges) does not exceed GRN value
      if (goodsBase - grnGoodsBase > 1e-6) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Bill amount exceeds GRN value",
        );
      }
      const grnClearingAccountId = await resolveGrnClearingAccountIdAuto(conn, {
        companyId,
        grnNo: String(bill.grn_no || ""),
      });
      if (!grnClearingAccountId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "GRN clearing account not resolved",
        );
      }
      let vatInputAccountId = 0;
      if (!isImport && vatBase > 0) {
        vatInputAccountId = await resolveVatInputAccountIdAuto(conn, {
          companyId,
        });
        if (!vatInputAccountId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "VAT input account not configured",
          );
        }
      }
      let expenseAccountId = 0;
      if (chargesBase > 0) {
        expenseAccountId = await resolveChargesExpenseAccountIdAuto(conn, {
          companyId,
        });
        if (!expenseAccountId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Expense account not configured",
          );
        }
      }
      const [apRows] = await conn.execute(
        `SELECT id
         FROM fin_accounts
         WHERE company_id = :companyId
           AND is_active = 1
           AND is_postable = 1
           AND code = '2001'
         LIMIT 1`,
        { companyId },
      );
      const supplierAccId = Number(apRows?.[0]?.id || 0) || 0;
      if (!supplierAccId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Accounts Payable – Trade (2001) not configured",
        );
      }
      const fxDiff = isImport
        ? Math.round((goodsBase - grnGoodsBase) * 100) / 100
        : 0;
      let fxGainAccountId = 0;
      let fxLossAccountId = 0;
      if (isImport && Math.abs(fxDiff) > 0) {
        const fxAccounts = await resolveFxGainLossAccountsAuto(conn, {
          companyId,
        });
        fxGainAccountId = Number(fxAccounts.fxGainAccountId || 0);
        fxLossAccountId = Number(fxAccounts.fxLossAccountId || 0);
        if (!fxGainAccountId || !fxLossAccountId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "FX gain/loss accounts not configured",
          );
        }
      }
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, {
        companyId,
      });
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = toYmd(new Date());
      const apCredit = isImport
        ? goodsBase
        : Math.round((goodsBase + vatBase + chargesBase) * 100) / 100;
      const totalDebit =
        grnGoodsBase +
        (isImport ? 0 : vatBase) +
        chargesBase +
        (fxDiff > 0 ? fxDiff : 0);
      const totalCredit = apCredit + (fxDiff < 0 ? -fxDiff : 0);
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration: `Purchase Bill ${bill.bill_no} posting`,
          totalDebit,
          totalCredit,
          createdBy: req.user?.sub || null,
          approvedBy: req.user?.sub || null,
          postedBy: req.user?.sub || null,
        },
      );
      const voucherId = Number(vIns?.insertId || 0) || 0;
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: grnClearingAccountId,
          description: `GRN ${bill.grn_no} clearing`,
          debit: grnGoodsBase,
          referenceNo: bill.bill_no,
        },
      );
      if (!isImport && vatBase > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: vatInputAccountId,
            description: `VAT input on ${bill.bill_no}`,
            debit: vatBase,
            referenceNo: bill.bill_no,
          },
        );
      }
      if (chargesBase > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: expenseAccountId,
            description: `Charges on ${bill.bill_no}`,
            debit: chargesBase,
            referenceNo: bill.bill_no,
          },
        );
      }
      if (isImport && fxDiff > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: fxLossAccountId,
            description: `FX loss on ${bill.bill_no}`,
            debit: fxDiff,
            referenceNo: bill.bill_no,
          },
        );
      } else if (isImport && fxDiff < 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: fxGainAccountId,
            description: `FX gain on ${bill.bill_no}`,
            credit: -fxDiff,
            referenceNo: bill.bill_no,
          },
        );
      }
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: supplierAccId,
          description: `AP for ${bill.bill_no}`,
          credit: apCredit,
          referenceNo: bill.bill_no,
        },
      );
      await conn.execute(
        "UPDATE pur_bills SET status = 'POSTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id, companyId, branchId },
      );
      await conn.commit();
      res.json({
        id,
        status: "POSTED",
        voucher_id: voucherId,
        voucher_no: voucherNo,
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
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `SELECT p.*, s.supplier_name 
         FROM pur_orders p 
         JOIN pur_suppliers s ON s.id = p.supplier_id 
         WHERE p.id = :id AND p.company_id = :companyId AND p.branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "PO not found");
      const details = await query(
        `SELECT d.*, i.item_name, i.item_code 
         FROM pur_order_details d 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE d.po_id = :id`,
        { id },
      );
      res.json({ item: { ...rows[0], details } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const poNo = body.po_no || nextDocNo("PO");
      const poDate = body.po_date || new Date();
      const supplierId = toNumber(body.supplier_id);
      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "Supplier is required");

      const details = Array.isArray(body.details) ? body.details : [];
      let totalAmount = 0;
      const cleanDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        if (!itemId || !qty || !unitPrice) continue;
        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTotal,
          discountPercent: d.discount_percent || 0,
        });
      }

      await conn.beginTransaction();
      const [ins] = await conn.execute(
        `INSERT INTO pur_orders (company_id, branch_id, po_no, po_date, supplier_id, po_type, status, total_amount, created_by, quotation_id, remarks)
         VALUES (:companyId, :branchId, :poNo, :poDate, :supplierId, :poType, 'DRAFT', :totalAmount, :createdBy, :quotationId, :remarks)`,
        {
          companyId,
          branchId,
          poNo,
          poDate,
          supplierId,
          poType: body.po_type || "LOCAL",
          totalAmount,
          createdBy: req.user.sub,
          quotationId: toNumber(body.quotation_id),
          remarks: body.remarks,
        },
      );
      const poId = ins.insertId;
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_order_details (po_id, item_id, qty, unit_price, line_total, discount_percent)
               VALUES (:poId, :itemId, :qty, :unitPrice, :lineTotal, :discountPercent)`,
          { poId, ...d },
        );
      }
      await conn.commit();
      res.status(201).json({ id: poId, po_no: poNo });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.post(
  "/orders/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/purchase/purchase-orders-import";
      const wfByRoute = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND document_route = :docRouteBase ORDER BY id ASC`,
        { companyId, docRouteBase },
      );
      const wfDefs = await query(
        `SELECT * FROM adm_workflows WHERE company_id = :companyId AND (document_type = 'PURCHASE_ORDER' OR document_type = 'Purchase Order') ORDER BY id ASC`,
        { companyId },
      );
      let activeWf = null;
      if (workflowIdOverride) {
        const wfRows = await query(
          `SELECT * FROM adm_workflows 
           WHERE id = :wfId AND company_id = :companyId 
             AND (document_type = 'PURCHASE_ORDER' OR document_type = 'Purchase Order')
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
          `INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'PURCHASE_ORDER', :amount, :stepOrder, 'PENDING', :assignedTo)`,
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
          `INSERT INTO adm_workflow_tasks
            (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
          VALUES
            (:companyId, :workflowId, :dwId, :documentId, 'PURCHASE_ORDER', :stepOrder, :assignedTo, 'PENDING')`,
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
          `INSERT INTO adm_workflow_logs
            (document_workflow_id, step_order, action, actor_user_id, comments)
          VALUES
            (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)`,
          {
            dwId: instanceId,
            stepOrder: first.step_order,
            actor: req.user.sub,
            comments: "",
          },
        );
        await query(
          `UPDATE pur_orders SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        const refRows = await query(
          `SELECT po_no FROM pur_orders WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        const poRef = refRows.length ? refRows[0].po_no : null;
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId,
            userId: assignedToUserId,
            title: "Approval Required",
            message: poRef
              ? `Purchase Order ${poRef} requires your approval`
              : `Purchase Order #${id} requires your approval`,
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
          `UPDATE pur_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        res.json({ status: "APPROVED" });
        return;
      }
      await query(
        `UPDATE pur_orders SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :BranchId`,
        { id, companyId, BranchId: branchId },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { status, type } = req.query;
      let sql = `
        SELECT p.id, p.po_no, p.po_date, p.po_type, p.supplier_id, p.status, p.total_amount, s.supplier_name
        FROM pur_orders p
        JOIN pur_suppliers s ON s.id = p.supplier_id
        WHERE p.company_id = :companyId AND p.branch_id = :branchId
      `;
      const params = { companyId, branchId };
      if (status) {
        sql += " AND p.status = :status";
        params.status = status;
      }
      if (type) {
        sql += " AND UPPER(p.po_type) = UPPER(:type)";
        params.type = type;
      }
      sql += " ORDER BY p.po_date DESC, p.id DESC";
      const rows = await query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/orders/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.ORDER.MANAGE"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      const { status } = req.body;

      if (
        ![
          "DRAFT",
          "PENDING_APPROVAL",
          "APPROVED",
          "REJECTED",
          "CANCELLED",
        ].includes(status)
      ) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid status");
      }

      const updates = { status, id, companyId, branchId };
      let sql = "UPDATE pur_orders SET status = :status";
      if (status === "APPROVED") {
        sql += ", approved_by = :userId, approved_at = NOW()";
        updates.userId = req.user.sub;
      }
      sql +=
        " WHERE id = :id AND company_id = :companyId AND branch_id = :branchId";

      await query(sql, updates);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grns/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const { type } = req.query; // LOCAL or IMPORT

      let prefix = "GL";
      if (String(type).toUpperCase() === "IMPORT") prefix = "GI";

      const sql = `SELECT MAX(CAST(SUBSTRING(grn_no, 4) AS UNSIGNED)) AS maxnum
         FROM inv_goods_receipt_notes
         WHERE company_id = :companyId
           AND grn_no REGEXP '^${prefix}-[0-9]{6}$'`;

      const rows = await query(sql, { companyId });
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      const nextNo = `${prefix}-${String(next).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const status = req.query.status ? String(req.query.status) : "APPROVED";

      let sql = `
        SELECT g.id, g.grn_no, g.grn_date, g.grn_type, g.supplier_id, g.po_id, g.port_clearance_id, g.status, s.supplier_name
        FROM inv_goods_receipt_notes g
        JOIN pur_suppliers s ON s.id = g.supplier_id
        WHERE g.company_id = :companyId AND g.branch_id = :branchId
          AND g.status = :status
      `;

      sql += ` ORDER BY g.grn_date DESC, g.id DESC`;

      const rows = await query(sql, { companyId, branchId, status });
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grns/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT g.*, s.supplier_name, pc.clearance_no
        FROM inv_goods_receipt_notes g
        JOIN pur_suppliers s ON s.id = g.supplier_id
        LEFT JOIN pur_port_clearances pc ON pc.id = g.port_clearance_id
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

router.get(
  "/bills",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const billType = req.query.bill_type
        ? String(req.query.bill_type).toUpperCase()
        : null;

      const rows = await query(
        `
        SELECT b.id,
               b.bill_no,
               b.bill_date,
               b.bill_type,
               b.po_id,
               p.po_no,
               b.supplier_id,
               s.supplier_name,
               b.total_amount,
               b.tax_amount,
               b.net_amount,
               b.status,
               COALESCE(b.amount_paid, 0) AS amount_paid,
               CASE
                 WHEN COALESCE(b.amount_paid, 0) <= 0 THEN 'UNPAID'
                 WHEN ABS(COALESCE(b.amount_paid, 0) - b.net_amount) <= 1e-6 THEN 'PAID'
                 ELSE 'PARTIALLY_PAID'
               END AS payment_status,
               b.grn_id,
               g.grn_no,
               b.due_date,
               b.currency_id,
               b.exchange_rate,
               b.payment_terms,
               b.discount_amount,
               b.freight_charges,
               b.other_charges
        FROM pur_bills b
        JOIN pur_suppliers s ON s.id = b.supplier_id
        LEFT JOIN pur_orders p ON p.id = b.po_id
        LEFT JOIN inv_goods_receipt_notes g ON g.id = b.grn_id
        WHERE b.company_id = :companyId AND b.branch_id = :branchId
          AND (:billType IS NULL OR b.bill_type = :billType)
        ORDER BY b.bill_date DESC, b.id DESC
        `,
        { companyId, branchId, billType },
      );

      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/bills/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT b.*
        FROM pur_bills b
        WHERE b.id = :id AND b.company_id = :companyId AND b.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Purchase bill not found");

      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               d.qty,
               d.unit_price,
               d.tax_amount,
               d.line_total,
               d.uom_id,
               d.discount_percent
        FROM pur_bill_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.bill_id = :id
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
  "/bills",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};

      // Ensure table columns exist
      const newCols = [
        "grn_id BIGINT UNSIGNED",
        "due_date DATE",
        "currency_id BIGINT UNSIGNED",
        "exchange_rate DECIMAL(15, 6) DEFAULT 1",
        "payment_terms INT DEFAULT 30",
        "discount_amount DECIMAL(15, 2) DEFAULT 0",
        "freight_charges DECIMAL(15, 2) DEFAULT 0",
        "other_charges DECIMAL(15, 2) DEFAULT 0",
        "amount_paid DECIMAL(18, 2) DEFAULT 0",
        "payment_status ENUM('UNPAID','PARTIALLY_PAID','PAID') NULL",
      ];
      for (const col of newCols) {
        try {
          await pool.query(`ALTER TABLE pur_bills ADD COLUMN ${col}`);
        } catch (e) {}
      }

      const newDetailCols = [
        "uom_id BIGINT UNSIGNED",
        "discount_percent DECIMAL(5, 2) DEFAULT 0",
      ];
      for (const col of newDetailCols) {
        try {
          await pool.query(`ALTER TABLE pur_bill_details ADD COLUMN ${col}`);
        } catch (e) {}
      }

      const billType = body.bill_type
        ? String(body.bill_type).toUpperCase()
        : "LOCAL";
      const billPrefix = billType === "IMPORT" ? "PBI" : "PBL";
      const billNo = await nextSequentialNo("pur_bills", "bill_no", billPrefix);
      const billDate = body.bill_date;
      const supplierId = toNumber(body.supplier_id);
      const poId = toNumber(body.po_id);
      const grnId = toNumber(body.grn_id);
      const status = body.status || "DRAFT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;

      const dueDate = body.due_date || null;
      const currencyId = toNumber(body.currency_id) || 4;
      const exchangeRate = Number(body.exchange_rate) || 1;
      const paymentTerms = Number(body.payment_terms) || 30;
      const discountAmount = Number(body.discount_amount) || 0;
      const freightCharges = Number(body.freight_charges) || 0;
      const otherCharges = Number(body.other_charges) || 0;

      const details = Array.isArray(body.details) ? body.details : [];

      if (!billDate || !supplierId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "bill_date and supplier_id are required",
        );
      if (!grnId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_id is required for purchase bills",
        );

      let totalAmount = 0;
      let taxAmount = 0;
      const normalizedDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        const lineTax = Number(d.tax_amount || 0);
        const uomId = toNumber(d.uom_id) || null;
        const discountPercent = Number(d.discount_percent) || 0;

        if (!itemId || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
          continue;

        const lineTotal = Number.isFinite(Number(d.line_total))
          ? Number(d.line_total)
          : qty * unitPrice + lineTax;

        totalAmount += qty * unitPrice;
        taxAmount += lineTax;
        normalizedDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTax,
          lineTotal,
          uomId,
          discountPercent,
        });
      }

      const netAmount =
        totalAmount -
        discountAmount +
        taxAmount +
        freightCharges +
        otherCharges;

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO pur_bills
          (company_id, branch_id, bill_no, bill_date, supplier_id, po_id, grn_id, bill_type, 
           due_date, currency_id, exchange_rate, payment_terms,
           total_amount, discount_amount, tax_amount, freight_charges, other_charges, net_amount, 
           status, created_by)
        VALUES
          (:companyId, :branchId, :billNo, :billDate, :supplierId, :poId, :grnId, :billType,
           :dueDate, :currencyId, :exchangeRate, :paymentTerms,
           :totalAmount, :discountAmount, :taxAmount, :freightCharges, :otherCharges, :netAmount,
           :status, :createdBy)
        `,
        {
          companyId,
          branchId,
          billNo,
          billDate,
          supplierId,
          poId: poId || null,
          grnId: grnId || null,
          billType,
          dueDate,
          currencyId,
          exchangeRate,
          paymentTerms,
          totalAmount,
          discountAmount,
          taxAmount,
          freightCharges,
          otherCharges,
          netAmount,
          status,
          createdBy,
        },
      );
      const billId = hdr.insertId;

      for (const nd of normalizedDetails) {
        await conn.execute(
          `
          INSERT INTO pur_bill_details
            (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total)
          VALUES
            (:billId, :itemId, :uomId, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal)
          `,
          {
            billId,
            itemId: nd.itemId,
            uomId: nd.uomId,
            qty: nd.qty,
            unitPrice: nd.unitPrice,
            discountPercent: nd.discountPercent,
            taxAmount: nd.lineTax,
            lineTotal: nd.lineTotal,
          },
        );
      }

      await conn.commit();
      res.status(201).json({
        id: billId,
        bill_no: billNo,
        total_amount: totalAmount,
        net_amount: netAmount,
      });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/bills/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PURCHASE.BILL.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const billDate = body.bill_date;
      const supplierId = toNumber(body.supplier_id);
      const poId = toNumber(body.po_id);
      const grnId = toNumber(body.grn_id);
      const billType = body.bill_type
        ? String(body.bill_type).toUpperCase()
        : "LOCAL";
      const status = body.status || "DRAFT";

      const dueDate = body.due_date || null;
      const currencyId = toNumber(body.currency_id) || 4;
      const exchangeRate = Number(body.exchange_rate) || 1;
      const paymentTerms = Number(body.payment_terms) || 30;
      const discountAmount = Number(body.discount_amount) || 0;
      const freightCharges = Number(body.freight_charges) || 0;
      const otherCharges = Number(body.other_charges) || 0;

      const details = Array.isArray(body.details) ? body.details : [];

      if (!billDate || !supplierId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "bill_date and supplier_id are required",
        );
      if (!grnId)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "grn_id is required for purchase bills",
        );

      let totalAmount = 0;
      let taxAmount = 0;
      const normalizedDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty);
        const unitPrice = Number(d.unit_price);
        const lineTax = Number(d.tax_amount || 0);
        const uomId = toNumber(d.uom_id) || null;
        const discountPercent = Number(d.discount_percent) || 0;

        if (!itemId || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
          continue;

        const lineTotal = Number.isFinite(Number(d.line_total))
          ? Number(d.line_total)
          : qty * unitPrice + lineTax;

        totalAmount += qty * unitPrice;
        taxAmount += lineTax;
        normalizedDetails.push({
          itemId,
          qty,
          unitPrice,
          lineTax,
          lineTotal,
          uomId,
          discountPercent,
        });
      }

      const netAmount =
        totalAmount -
        discountAmount +
        taxAmount +
        freightCharges +
        otherCharges;

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE pur_bills
        SET bill_date = :billDate,
            supplier_id = :supplierId,
            po_id = :poId,
            grn_id = :grnId,
            bill_type = :billType,
            due_date = :dueDate,
            currency_id = :currencyId,
            exchange_rate = :exchangeRate,
            payment_terms = :paymentTerms,
            total_amount = :totalAmount,
            discount_amount = :discountAmount,
            tax_amount = :taxAmount,
            freight_charges = :freightCharges,
            other_charges = :otherCharges,
            net_amount = :netAmount,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          billDate,
          supplierId,
          poId: poId || null,
          grnId: grnId || null,
          billType,
          dueDate,
          currencyId,
          exchangeRate,
          paymentTerms,
          totalAmount,
          discountAmount,
          taxAmount,
          freightCharges,
          otherCharges,
          netAmount,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Purchase bill not found");

      await conn.execute(`DELETE FROM pur_bill_details WHERE bill_id = :id`, {
        id,
      });
      for (const nd of normalizedDetails) {
        await conn.execute(
          `
          INSERT INTO pur_bill_details
            (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total)
          VALUES
            (:id, :itemId, :uomId, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal)
          `,
          {
            id,
            itemId: nd.itemId,
            uomId: nd.uomId,
            qty: nd.qty,
            unitPrice: nd.unitPrice,
            discountPercent: nd.discountPercent,
            taxAmount: nd.lineTax,
            lineTotal: nd.lineTotal,
          },
        );
      }

      await conn.commit();
      res.json({
        ok: true,
        total_amount: totalAmount,
        net_amount: netAmount,
      });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.get(
  "/analytics/overview",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const userId = req.user?.sub;

      const purchaseRows = await query(
        `
        SELECT COUNT(*) AS count,
               COALESCE(SUM(total_amount), 0) AS total
        FROM pur_orders
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND po_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `,
        { companyId, branchId },
      );
      const totalPurchases = Number(purchaseRows?.[0]?.total || 0);
      const totalPurchaseOrders = Number(purchaseRows?.[0]?.count || 0);

      const activePoRows = await query(
        `
        SELECT COUNT(*) AS count
        FROM pur_orders
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND status NOT IN ('RECEIVED', 'CANCELLED', 'CLOSED', 'REJECTED')
        `,
        { companyId, branchId },
      );
      const activePurchaseOrders = Number(activePoRows?.[0]?.count || 0);

      const supplierRows = await query(
        `
        SELECT COUNT(*) AS count
        FROM pur_suppliers
        WHERE company_id = :companyId
          AND is_active = 1
        `,
        { companyId },
      );
      const activeSuppliers = Number(supplierRows?.[0]?.count || 0);

      const pendingRows = await query(
        `
        SELECT COUNT(*) AS count
        FROM adm_document_workflows dw
        WHERE dw.company_id = :companyId
          AND dw.status = 'PENDING'
          AND dw.assigned_to_user_id = :userId
          AND (
            dw.document_type = 'PURCHASE_ORDER'
            OR dw.document_type = 'Purchase Order'
            OR dw.document_type LIKE 'PURCHASE_ORDER:%'
          )
        `,
        { companyId, userId },
      );
      const pendingApprovals = Number(pendingRows?.[0]?.count || 0);

      const payableRows = await query(
        `
        SELECT COALESCE(
                 SUM(GREATEST(COALESCE(net_amount, 0) - COALESCE(amount_paid, 0), 0)),
                 0
               ) AS total
        FROM pur_bills
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND status = 'POSTED'
          AND COALESCE(amount_paid, 0) < COALESCE(net_amount, 0)
        `,
        { companyId, branchId },
      );
      const outstandingPayables = Number(payableRows?.[0]?.total || 0);

      res.json({
        totalPurchases,
        totalPurchaseOrders,
        activePurchaseOrders,
        activeSuppliers,
        pendingApprovals,
        outstandingPayables,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
// Direct Purchase
async function ensureDirectPurchaseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_direct_purchase_hdr (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      dp_no VARCHAR(50) NOT NULL,
      dp_date DATE NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      currency_id BIGINT UNSIGNED NULL,
      exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
      payment_terms INT NULL,
      remarks VARCHAR(255) NULL,
      subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
      grn_id BIGINT UNSIGNED NULL,
      bill_id BIGINT UNSIGNED NULL,
      grn_voucher_id BIGINT UNSIGNED NULL,
      bill_voucher_id BIGINT UNSIGNED NULL,
      created_by BIGINT UNSIGNED NULL,
      approved_by BIGINT UNSIGNED NULL,
      posted_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dp_scope_no (company_id, branch_id, dp_no),
      KEY idx_dp_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_direct_purchase_dtl (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      hdr_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      uom VARCHAR(20) DEFAULT 'PCS',
      unit_price DECIMAL(18,2) NOT NULL,
      discount_percent DECIMAL(9,3) DEFAULT 0,
      tax_percent DECIMAL(9,3) DEFAULT 0,
      line_total DECIMAL(18,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_dp_dtl_hdr (hdr_id),
      KEY idx_dp_dtl_item (item_id),
      CONSTRAINT fk_dp_dtl_hdr FOREIGN KEY (hdr_id) REFERENCES pur_direct_purchase_hdr(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

router.post(
  "/direct-purchases",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "PURCHASE.ORDER.MANAGE",
    "PURCHASE.GRN.MANAGE",
    "PURCHASE.BILL.MANAGE",
  ]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const status = String(body.status || "DRAFT").toUpperCase();
      const supplierId = toNumber(body.supplier_id);
      const warehouseId = toNumber(body.warehouse_id);
      function normalizeYmd(input) {
        if (!input) return toYmd(new Date());
        if (input instanceof Date && !Number.isNaN(input.getTime()))
          return toYmd(input);
        const s = String(input).trim();
        const dateOnly = s.split("T")[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return toYmd(d);
        return toYmd(new Date());
      }
      const dpDateYmd = normalizeYmd(body.purchase_date);
      const currencyId = toNumber(body.currency_id) || null;
      const exchangeRate = Number(body.exchange_rate || 1) || 1;
      const paymentTerms = toNumber(body.payment_terms) || null;
      const remarks = body.remarks || null;
      const details = Array.isArray(body.details) ? body.details : [];
      if (!supplierId)
        throw httpError(400, "VALIDATION_ERROR", "supplier_id required");
      if (!warehouseId)
        throw httpError(400, "VALIDATION_ERROR", "warehouse_id required");
      if (!details.length)
        throw httpError(400, "VALIDATION_ERROR", "details required");
      await ensureDirectPurchaseTables();
      await ensureGrnUomConversionColumns();
      await ensureUnitConversionsTable();
      const dpNo =
        body.dp_no ||
        (await nextSequentialNo("pur_direct_purchase_hdr", "dp_no", "DP"));

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      const cleanDetails = [];
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qty = Number(d.qty || 0);
        const unitPrice = Number(d.unit_price || 0);
        const discountPercent = Number(d.discount_percent || 0);
        const taxPercent = Number(d.tax_percent || 0);
        if (!itemId || !(qty > 0) || !(unitPrice >= 0)) continue;
        const gross = qty * unitPrice;
        const disc = Math.round(gross * discountPercent) / 100;
        const base = Math.max(0, gross - disc);
        const tax = Math.round(base * taxPercent) / 100;
        const lineTotal = Math.round((base + tax) * 100) / 100;
        subtotal += gross;
        totalDiscount += disc;
        totalTax += tax;
        cleanDetails.push({
          itemId,
          qty,
          unitPrice,
          discountPercent,
          taxPercent,
          lineTotal,
          uom: String(d.uom || "PCS"),
        });
      }
      const netAmount =
        Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;

      await conn.beginTransaction();
      const [hdrIns] = await conn.execute(
        `INSERT INTO pur_direct_purchase_hdr
         (company_id, branch_id, dp_no, dp_date, supplier_id, warehouse_id, currency_id, exchange_rate, payment_terms, remarks, subtotal, discount_amount, tax_amount, net_amount, status, created_by)
         VALUES
         (:companyId, :branchId, :dpNo, :dpDate, :supplierId, :warehouseId, :currencyId, :exchangeRate, :paymentTerms, :remarks, :subtotal, :discountAmount, :taxAmount, :netAmount, 'DRAFT', :createdBy)`,
        {
          companyId,
          branchId,
          dpNo,
          dpDate: dpDateYmd,
          supplierId,
          warehouseId,
          currencyId,
          exchangeRate,
          paymentTerms,
          remarks,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          netAmount,
          createdBy: req.user?.sub || null,
        },
      );
      const dpId = Number(hdrIns.insertId);
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_direct_purchase_dtl
           (hdr_id, item_id, qty, uom, unit_price, discount_percent, tax_percent, line_total)
           VALUES
           (:hdrId, :itemId, :qty, :uom, :unitPrice, :discountPercent, :taxPercent, :lineTotal)`,
          { hdrId: dpId, ...d },
        );
      }

      if (status === "DRAFT") {
        await conn.commit();
        return res.status(201).json({
          id: dpId,
          dp_no: dpNo,
          status: "DRAFT",
          net_amount: netAmount,
        });
      }

      const grnNo = await nextSequentialNo(
        "inv_goods_receipt_notes",
        "grn_no",
        "GRN",
      );
      const [grnHdr] = await conn.execute(
        `INSERT INTO inv_goods_receipt_notes
         (company_id, branch_id, grn_no, grn_date, grn_type, po_id, supplier_id, warehouse_id, status, remarks, created_by)
         VALUES
         (:companyId, :branchId, :grnNo, :grnDate, 'LOCAL', NULL, :supplierId, :warehouseId, 'APPROVED', :remarks, :createdBy)`,
        {
          companyId,
          branchId,
          grnNo,
          grnDate: dpDateYmd,
          supplierId,
          warehouseId,
          remarks,
          createdBy: req.user?.sub || null,
        },
      );
      const grnId = Number(grnHdr.insertId);
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details
           (grn_id, item_id, qty_ordered, qty_received, qty_accepted, qty_rejected, uom, unit_price, line_amount)
           VALUES
           (:grnId, :itemId, :qty, :qty, :qty, 0, :uom, :unitPrice, :lineTotal)`,
          {
            grnId,
            itemId: d.itemId,
            qty: d.qty,
            uom: d.uom,
            unitPrice: d.unitPrice,
            lineTotal: d.lineTotal,
          },
        );
        await conn.execute(
          `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
           ON DUPLICATE KEY UPDATE qty = qty + :qty`,
          {
            companyId,
            branchId,
            warehouseId,
            itemId: d.itemId,
            qty: d.qty,
          },
        );
      }
      const { voucherId: grnVoucherId, voucherNo: grnVoucherNo } =
        await postGrnAccrualTx(conn, {
          companyId,
          branchId,
          grnId,
          inventoryAccountRef: "1200",
          grnClearingAccountRef: "2100",
        });

      const billNo = await nextSequentialNo("pur_bills", "bill_no", "PB");
      const [billHdr] = await conn.execute(
        `INSERT INTO pur_bills
          (company_id, branch_id, bill_no, bill_date, supplier_id, po_id, grn_id, bill_type,
           due_date, currency_id, exchange_rate, payment_terms,
           total_amount, discount_amount, tax_amount, freight_charges, other_charges, net_amount,
           status, created_by)
         VALUES
          (:companyId, :branchId, :billNo, :billDate, :supplierId, NULL, :grnId, 'LOCAL',
           :dueDate, :currencyId, :exchangeRate, :paymentTerms,
           :totalAmount, :discountAmount, :taxAmount, 0, 0, :netAmount,
           'DRAFT', :createdBy)`,
        {
          companyId,
          branchId,
          billNo,
          billDate: dpDateYmd,
          supplierId,
          grnId,
          dueDate: null,
          currencyId,
          exchangeRate,
          paymentTerms,
          totalAmount: subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          netAmount,
          createdBy: req.user?.sub || null,
        },
      );
      const billId = Number(billHdr.insertId);
      for (const d of cleanDetails) {
        await conn.execute(
          `INSERT INTO pur_bill_details
            (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total)
           VALUES
            (:billId, :itemId, NULL, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal)`,
          {
            billId,
            itemId: d.itemId,
            qty: d.qty,
            unitPrice: d.unitPrice,
            discountPercent: d.discountPercent,
            taxAmount:
              Math.round(
                (d.lineTotal -
                  d.qty * d.unitPrice +
                  (d.discountPercent
                    ? (d.qty * d.unitPrice * d.discountPercent) / 100
                    : 0)) *
                  100,
              ) / 100,
            lineTotal: d.lineTotal,
          },
        );
      }

      const rate = Number(exchangeRate || 1);
      const goodsExclusive = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.max(0, totalTax);
      const goodsBase = Math.round(goodsExclusive * rate * 100) / 100;
      const vatBase = Math.round(vatAmount * rate * 100) / 100;
      const [grnDetRows] = await conn.execute(
        "SELECT SUM(qty_accepted * unit_price) AS goods_base FROM inv_goods_receipt_note_details WHERE grn_id = :grnId",
        { grnId },
      );
      const grnGoodsBase =
        Math.round(Number(grnDetRows?.[0]?.goods_base || 0) * 100) / 100;
      const grnClearingAccountId = await resolveGrnClearingAccountIdAuto(conn, {
        companyId,
        grnNo,
      });
      let vatInputAccountId = 0;
      if (vatBase > 0) {
        vatInputAccountId = await resolveVatInputAccountIdAuto(conn, {
          companyId,
        });
      }
      let expenseAccountId = 0;
      const chargesBase = 0;
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, {
        companyId,
      });
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = toYmd(new Date());
      const apCredit =
        Math.round((goodsBase + vatBase + chargesBase) * 100) / 100;
      const totalDebit = grnGoodsBase + (vatBase > 0 ? vatBase : 0);
      const totalCredit = apCredit;
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration: `Purchase Bill ${billNo} posting`,
          totalDebit,
          totalCredit,
          createdBy: req.user?.sub || null,
          approvedBy: req.user?.sub || null,
          postedBy: req.user?.sub || null,
        },
      );
      const billVoucherId = Number(vIns?.insertId || 0) || 0;
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId: billVoucherId,
          lineNo: lineNo++,
          accountId: grnClearingAccountId,
          description: `GRN ${grnNo} clearing`,
          debit: grnGoodsBase,
          referenceNo: billNo,
        },
      );
      if (vatBase > 0 && vatInputAccountId) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId: billVoucherId,
            lineNo: lineNo++,
            accountId: vatInputAccountId,
            description: `VAT input on ${billNo}`,
            debit: vatBase,
            referenceNo: billNo,
          },
        );
      }
      const [apRows] = await conn.execute(
        `SELECT id
         FROM fin_accounts
         WHERE company_id = :companyId
           AND is_active = 1
           AND is_postable = 1
           AND code = '2001'
         LIMIT 1`,
        { companyId },
      );
      const supplierAccId = Number(apRows?.[0]?.id || 0) || 0;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId: billVoucherId,
          lineNo: lineNo++,
          accountId: supplierAccId,
          description: `AP for ${billNo}`,
          credit: apCredit,
          referenceNo: billNo,
        },
      );
      await conn.execute(
        "UPDATE pur_bills SET status = 'POSTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id: billId, companyId, branchId },
      );

      await conn.execute(
        `UPDATE pur_direct_purchase_hdr
           SET status = 'POSTED',
               grn_id = :grnId,
               bill_id = :billId,
               grn_voucher_id = :grnVoucherId,
               bill_voucher_id = :billVoucherId,
               approved_by = :userId,
               posted_by = :userId
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id: dpId,
          companyId,
          branchId,
          grnId,
          billId,
          grnVoucherId,
          billVoucherId,
          userId: req.user?.sub || null,
        },
      );
      await conn.commit();
      res.status(201).json({
        id: dpId,
        dp_no: dpNo,
        status: "POSTED",
        grn_id: grnId,
        bill_id: billId,
        grn_voucher_id: grnVoucherId,
        bill_voucher_id: billVoucherId,
        net_amount: netAmount,
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
