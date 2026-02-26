import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { checkModuleAccess, checkFeatureAction } from "../middleware/access.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as posController from "../controllers/pos.controller.js";
import multer from "multer";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundTo2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function nextReceiptNoTx(conn, companyId) {
  const [rows] = await conn.execute(
    `
    SELECT receipt_no
    FROM pos_sales
    WHERE company_id = :companyId
      AND receipt_no REGEXP '^RCP-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(receipt_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    FOR UPDATE
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RCP-${String(nextNum).padStart(6, "0")}`;
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

async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  const id = Number(rows?.[0]?.id || 0);
  return id || 0;
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

async function ensureReceiptVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "RV",
  });
  if (existingId) return existingId;

  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'RV', 'Receipt Voucher', 'RECEIPT', 'RV', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }

  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "RV" });
  return id || 0;
}

async function ensureSalesVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "SV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'SV', 'Sales Voucher', 'SALES', 'SV', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "SV" });
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
    `
    SELECT id, is_open
    FROM fin_fiscal_years
    WHERE company_id = :companyId
      AND :todayYmd >= start_date
      AND :todayYmd <= end_date
    ORDER BY start_date DESC
    LIMIT 1
    `,
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
    `
    INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
    VALUES (:companyId, :code, :startDate, :endDate, 1)
    `,
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

async function resolveDefaultSalesAccountId(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature = 'INCOME'
    ORDER BY
      CASE
        WHEN a.code IN ('4000','400000') THEN 0
        WHEN LOWER(a.name) LIKE '%sales%' THEN 1
        WHEN LOWER(a.code) LIKE '4%' THEN 2
        ELSE 3
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function fetchItemSalesAccountMap(conn, { companyId, itemIds }) {
  const ids = Array.from(
    new Set((Array.isArray(itemIds) ? itemIds : []).map((n) => Number(n))),
  ).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return new Map();

  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const params = { companyId };
  for (let i = 0; i < ids.length; i += 1) {
    params[`id${i}`] = ids[i];
  }

  const [rows] = await conn.execute(
    `SELECT id, sales_account_id FROM inv_items WHERE company_id = :companyId AND id IN (${placeholders})`,
    params,
  );

  const m = new Map();
  for (const r of rows || []) {
    m.set(Number(r.id), Number(r.sales_account_id || 0));
  }
  return m;
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

async function ensurePosTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_terminal (company_id, code),
      KEY idx_pos_terminal_company (company_id),
      KEY idx_pos_terminal_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_terminals", "warehouse"))) {
    await query(
      "ALTER TABLE pos_terminals ADD COLUMN warehouse VARCHAR(150) NULL",
    );
  }
  if (!(await hasColumn("pos_terminals", "counter_no"))) {
    await query("ALTER TABLE pos_terminals ADD COLUMN counter_no INT NULL");
  }
  if (!(await hasColumn("pos_terminals", "ip_address"))) {
    await query(
      "ALTER TABLE pos_terminals ADD COLUMN ip_address VARCHAR(50) NULL",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_terminal_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_terminal_user (company_id, branch_id, terminal_id, user_id),
      KEY idx_pos_terminal_users_terminal (terminal_id),
      KEY idx_pos_terminal_users_user (user_id),
      CONSTRAINT fk_ptu_terminal FOREIGN KEY (terminal_id) REFERENCES pos_terminals(id) ON DELETE CASCADE,
      CONSTRAINT fk_ptu_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sales (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_id BIGINT UNSIGNED NULL,
      receipt_no VARCHAR(50) NOT NULL,
      sale_datetime DATETIME NOT NULL,
      customer_name VARCHAR(150) NULL,
      payment_method ENUM('CASH','CARD','MOBILE') NOT NULL DEFAULT 'CASH',
      gross_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','COMPLETED','VOID') NOT NULL DEFAULT 'COMPLETED',
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_receipt (company_id, receipt_no),
      KEY idx_pos_sale_company (company_id),
      KEY idx_pos_sale_branch (branch_id),
      KEY idx_pos_sale_terminal (terminal_id),
      KEY idx_pos_sale_datetime (sale_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await hasColumn("pos_sales", "created_by"))) {
    await query(
      "ALTER TABLE pos_sales ADD COLUMN created_by BIGINT UNSIGNED NULL",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sale_lines (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sale_id BIGINT UNSIGNED NOT NULL,
      line_no INT NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      qty DECIMAL(18,2) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_sale_line (sale_id, line_no),
      KEY idx_pos_line_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_day_status (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      business_date DATE NOT NULL,
      open_datetime DATETIME NOT NULL,
      opening_float DECIMAL(18,2) NOT NULL DEFAULT 0,
      supervisor_name VARCHAR(150) NULL,
      open_notes TEXT NULL,
      close_datetime DATETIME NULL,
      actual_cash DECIMAL(18,2) NULL,
      close_notes TEXT NULL,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_day_status (company_id, branch_id, terminal_code, business_date),
      KEY idx_pos_day_company (company_id),
      KEY idx_pos_day_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      session_no VARCHAR(20) NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      cashier_name VARCHAR(150) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NULL,
      opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_sales DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_session (company_id, branch_id, session_no),
      KEY idx_pos_session_company (company_id),
      KEY idx_pos_session_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_payment_modes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      type ENUM('cash','card','mobile','bank','other') NOT NULL,
      account VARCHAR(100) NULL,
      require_reference TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pos_payment_modes_company (company_id),
      KEY idx_pos_payment_modes_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_tax_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      tax_code_id BIGINT UNSIGNED NULL,
      tax_account_id BIGINT UNSIGNED NULL,
      tax_type ENUM('Inclusive','Exclusive') NOT NULL DEFAULT 'Exclusive',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_tax_settings (company_id, branch_id),
      KEY idx_pos_tax_settings_company (company_id),
      KEY idx_pos_tax_settings_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_tax_settings", "is_active"))) {
    await query(
      "ALTER TABLE pos_tax_settings ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_receipt_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      company_name VARCHAR(255) NULL,
      show_logo TINYINT(1) NOT NULL DEFAULT 0,
      header_text TEXT NULL,
      footer_text TEXT NULL,
      contact_number VARCHAR(50) NULL,
      address_line1 VARCHAR(255) NULL,
      address_line2 VARCHAR(255) NULL,
      logo_url VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_receipt_settings (company_id, branch_id),
      KEY idx_pos_receipt_settings_company (company_id),
      KEY idx_pos_receipt_settings_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_receipt_settings", "company_name"))) {
    await query(
      "ALTER TABLE pos_receipt_settings ADD COLUMN company_name VARCHAR(255) NULL AFTER branch_id",
    );
  }
}

async function ensurePosSessionPostingTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pos_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      session_no VARCHAR(20) NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      cashier_name VARCHAR(150) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NULL,
      opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_sales DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      actual_cash DECIMAL(18,2) NULL,
      variance_amount DECIMAL(18,2) NULL,
      finance_posted TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_session (company_id, branch_id, session_no),
      KEY idx_pos_session_company (company_id),
      KEY idx_pos_session_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function nextReceiptNo(companyId) {
  const rows = await query(
    `
    SELECT receipt_no
    FROM pos_sales
    WHERE company_id = :companyId
      AND receipt_no REGEXP '^RCP-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(receipt_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RCP-${String(nextNum).padStart(6, "0")}`;
}

async function nextSessionNo(companyId) {
  const rows = await query(
    `
    SELECT session_no
    FROM pos_sessions
    WHERE company_id = :companyId
      AND session_no REGEXP '^S-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(session_no, 3) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].session_no || "");
    const numPart = prev.slice(2);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `S-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  posController.listPaymentModes,
);

router.get(
  "/analytics/overview",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const [today] = await query(
        `SELECT 
           COALESCE(SUM(total_amount), 0) AS total, 
           COALESCE(AVG(total_amount), 0) AS avg_amt, 
           COUNT(*) AS count
         FROM sal_invoices 
         WHERE company_id = :companyId 
           AND branch_id = :branchId 
           AND DATE(invoice_date) = CURDATE()`,
        { companyId, branchId },
      );
      const [month] = await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM sal_invoices 
         WHERE company_id = :companyId 
           AND branch_id = :branchId 
           AND YEAR(invoice_date) = YEAR(CURDATE()) 
           AND MONTH(invoice_date) = MONTH(CURDATE())`,
        { companyId, branchId },
      );
      const [customers] = await query(
        `SELECT COUNT(*) AS count 
         FROM sal_customers 
         WHERE company_id = :companyId`,
        { companyId },
      );
      res.json({
        todaySales: Number(today?.total || 0),
        averageOrder: Number(today?.avg_amt || 0),
        transactions: Number(today?.count || 0),
        monthlyRevenue: Number(month?.total || 0),
        totalCustomers: Number(customers?.count || 0),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const rows = await query(
        `
        SELECT payment_method, COUNT(*) AS cnt, COALESCE(SUM(net_amount), 0) AS amt
        FROM pos_sales
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND DATE(sale_datetime) = CURDATE()
          AND status = 'COMPLETED'
        GROUP BY payment_method
        `,
        { companyId, branchId },
      );
      const summary = {
        cashCount: 0,
        cashAmount: 0,
        cardCount: 0,
        cardAmount: 0,
        mobileCount: 0,
        mobileAmount: 0,
      };
      for (const row of rows) {
        const method = String(row.payment_method || "").toUpperCase();
        const count = Number(row.cnt || 0);
        const amount = Number(row.amt || 0);
        if (method === "CASH") {
          summary.cashCount += count;
          summary.cashAmount += amount;
        } else if (method === "CARD") {
          summary.cardCount += count;
          summary.cardAmount += amount;
        } else if (method === "MOBILE") {
          summary.mobileCount += count;
          summary.mobileAmount += amount;
        }
      }
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-user-sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          COALESCE(
            NULLIF(a.username, ''),
            NULLIF(a.email, ''),
            CONCAT('User ', a.id)
          ) AS user_label,
          COUNT(*) AS count,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        LEFT JOIN adm_users a
          ON a.id = p.created_by AND a.company_id = p.company_id AND a.branch_id = p.branch_id
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND DATE(p.sale_datetime) = CURDATE()
          AND p.status = 'COMPLETED'
        GROUP BY user_label
        ORDER BY total DESC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-terminal-methods",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          COALESCE(t.code, 'UNKNOWN') AS terminal,
          SUM(CASE WHEN p.payment_method='CASH' THEN p.net_amount ELSE 0 END) AS cash_total,
          SUM(CASE WHEN p.payment_method='CARD' THEN p.net_amount ELSE 0 END) AS card_total,
          SUM(CASE WHEN p.payment_method='MOBILE' THEN p.net_amount ELSE 0 END) AS mobile_total
        FROM pos_sales p
        LEFT JOIN pos_terminals t
          ON t.id = p.terminal_id AND t.company_id = p.company_id AND t.branch_id = p.branch_id
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND DATE(p.sale_datetime) = CURDATE()
          AND p.status = 'COMPLETED'
        GROUP BY COALESCE(t.code, 'UNKNOWN')
        ORDER BY terminal ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/analytics/sales-30-days",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DATE(p.sale_datetime) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND p.status = 'COMPLETED'
        GROUP BY DATE(p.sale_datetime)
        ORDER BY date ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/sales-monthly",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DATE_FORMAT(p.sale_datetime, '%Y-%m') AS ym,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND p.status = 'COMPLETED'
          AND p.sale_datetime >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(p.sale_datetime, '%Y-%m')
        ORDER BY ym ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/weekday-current-week",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DAYOFWEEK(p.sale_datetime) AS dow, 
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND YEARWEEK(p.sale_datetime, 1) = YEARWEEK(CURDATE(), 1)
          AND p.status = 'COMPLETED'
        GROUP BY DAYOFWEEK(p.sale_datetime)
        ORDER BY dow ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/hourly-today",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          HOUR(p.sale_datetime) AS hr,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE p.company_id = :companyId
          AND p.branch_id = :branchId
          AND DATE(p.sale_datetime) = CURDATE()
          AND p.status = 'COMPLETED'
          AND HOUR(p.sale_datetime) BETWEEN 7 AND 22
        GROUP BY HOUR(p.sale_datetime)
        ORDER BY hr ASC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/category-share",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT 
          COALESCE(it.item_type, 'Uncategorized') AS category,
          COALESCE(SUM(d.net_amount), 0) AS total
        FROM sal_invoices i
        JOIN sal_invoice_details d 
          ON d.invoice_id = i.id
        LEFT JOIN inv_items it 
          ON it.id = d.item_id AND it.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND DATE(i.invoice_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY COALESCE(it.item_type, 'Uncategorized')
        ORDER BY total DESC
        `,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/reports/daily-sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push(
          "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        );
      }
      const items = await query(
        `
        SELECT 
          DATE(p.sale_datetime) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(p.gross_amount), 0) AS gross,
          COALESCE(SUM(p.discount_amount), 0) AS discount,
          COALESCE(SUM(p.tax_amount), 0) AS tax,
          COALESCE(SUM(p.net_amount), 0) AS net
        FROM pos_sales p
        WHERE ${where.join(" AND ")}
        GROUP BY DATE(p.sale_datetime)
        ORDER BY date ASC
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
  "/reports/payment-breakdown",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        params.today = new Date();
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(p.payment_method, 'UNKNOWN') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(p.payment_method, 'UNKNOWN')
        ORDER BY total DESC
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
  "/reports/top-items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  checkModuleAccess("pos"),
  checkFeatureAction("pos", "view"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const rawLimit = Number(req.query.limit || 10);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 10;
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, limit };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(l.item_name, 'Unknown') AS item,
          COALESCE(SUM(l.qty), 0) AS qty,
          COALESCE(SUM(l.line_total), 0) AS amount
        FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(l.item_name, 'Unknown')
        ORDER BY amount DESC
        LIMIT ${limit}
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Backward-compatible singular aliases (execute same logic instead of rewriting URL)
router.get(
  "/report/daily-sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push(
          "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        );
      }
      const items = await query(
        `
        SELECT 
          DATE(p.sale_datetime) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(p.gross_amount), 0) AS gross,
          COALESCE(SUM(p.discount_amount), 0) AS discount,
          COALESCE(SUM(p.tax_amount), 0) AS tax,
          COALESCE(SUM(p.net_amount), 0) AS net
        FROM pos_sales p
        WHERE ${where.join(" AND ")}
        GROUP BY DATE(p.sale_datetime)
        ORDER BY date ASC
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
  "/report/payment-breakdown",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(p.payment_method, 'UNKNOWN') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(p.net_amount), 0) AS total
        FROM pos_sales p
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(p.payment_method, 'UNKNOWN')
        ORDER BY total DESC
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
  "/report/top-items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const rawLimit = Number(req.query.limit || 10);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 10;
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "p.branch_id = :branchId",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, limit };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(l.item_name, 'Unknown') AS item,
          COALESCE(SUM(l.qty), 0) AS qty,
          COALESCE(SUM(l.line_total), 0) AS amount
        FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(l.item_name, 'Unknown')
        ORDER BY amount DESC
        LIMIT ${limit}
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
  "/sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const date = String(req.query.date || "").trim();
      const receiptNo = String(
        req.query.receipt_no || req.query.receiptNo || "",
      )
        .trim()
        .toUpperCase();
      const terminalCode = String(
        req.query.terminal || req.query.till || "",
      ).trim();
      const terminalId = Number(
        req.query.terminal_id || req.query.terminalId || 0,
      );
      const rawLimit = Number(req.query.limit || 0);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(1000, Math.floor(rawLimit))
          : 200;
      await ensurePosTables();
      const params = { companyId, branchId, limit };
      const where = ["ps.company_id = :companyId", "ps.branch_id = :branchId"];
      if (date) {
        params.date = date;
        where.push("DATE(ps.sale_datetime) = DATE(:date)");
      }
      if (receiptNo) {
        params.receiptNo = receiptNo;
        where.push("UPPER(ps.receipt_no) = :receiptNo");
      }
      if (Number.isFinite(terminalId) && terminalId > 0) {
        params.terminalId = terminalId;
        where.push("ps.terminal_id = :terminalId");
      } else if (terminalCode) {
        params.terminalCode = terminalCode.toUpperCase();
        where.push("UPPER(pt.code) = :terminalCode");
      }
      let resolvedTerminalId =
        Number.isFinite(terminalId) && terminalId > 0 ? terminalId : 0;
      if (!resolvedTerminalId && terminalCode) {
        try {
          const rows = await query(
            `SELECT id 
             FROM pos_terminals 
             WHERE company_id = :companyId 
               AND branch_id = :branchId 
               AND UPPER(code) = :code 
             LIMIT 1`,
            { companyId, branchId, code: terminalCode.toUpperCase() },
          );
          resolvedTerminalId = Number(rows?.[0]?.id || 0) || 0;
        } catch {}
      }
      const baseParams = { companyId, branchId, limit };
      const filterByTerminal = resolvedTerminalId > 0;
      const terminalFilterSql = filterByTerminal
        ? " AND terminal_id = :terminalId"
        : "";
      const finalParams = filterByTerminal
        ? { ...baseParams, terminalId: resolvedTerminalId }
        : baseParams;
      const items = await query(
        `SELECT 
           id,
           receipt_no AS sale_no,
           sale_datetime AS sale_date,
           NULL AS customer_id,
           gross_amount,
           discount_amount,
           tax_amount,
           net_amount AS total_amount,
           CASE status 
             WHEN 'COMPLETED' THEN 'PAID' 
             WHEN 'DRAFT' THEN 'PENDING' 
             ELSE status 
           END AS payment_status,
           payment_method
         FROM pos_sales
         WHERE company_id = :companyId AND branch_id = :branchId${terminalFilterSql}
         ORDER BY sale_datetime DESC
         LIMIT ${limit}`,
        finalParams,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sales/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensurePosTables();
      const items = await query(
        `SELECT 
           id,
           receipt_no AS sale_no,
           sale_datetime AS sale_date,
           customer_name,
           payment_method,
           gross_amount,
           discount_amount,
           tax_amount,
           net_amount,
           CASE status 
             WHEN 'COMPLETED' THEN 'PAID' 
             WHEN 'DRAFT' THEN 'PENDING' 
             ELSE status 
           END AS payment_status
         FROM pos_sales 
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId 
         LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!items.length) throw httpError(404, "NOT_FOUND", "Sale not found");
      const details = await query(
        `SELECT item_name, qty, unit_price, line_total 
         FROM pos_sale_lines 
         WHERE sale_id = :id 
         ORDER BY line_no ASC`,
        { id },
      );
      res.json({ item: items[0], details });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const {
        payment_method,
        payment_mode_id,
        customer_name,
        lines,
        status,
        tax_rate_percent,
        tax_type,
        terminal,
      } = req.body || {};
      await ensurePosTables();
      await ensureStockBalancesWarehouseInfrastructure();
      // Enforce daily POS day requirement:
      // - A day must be opened for today's business date before sales are allowed
      // - Sales remain allowed even if the day has been closed, as long as it's the same date
      {
        const [dayRows] = await conn.execute(
          `
          SELECT id, status
          FROM pos_day_status
          WHERE company_id = :companyId
            AND branch_id = :branchId
            AND business_date = CURDATE()
            ${terminal ? "AND terminal_code = :terminal" : ""}
          ORDER BY open_datetime DESC
          LIMIT 1
          `,
          terminal
            ? { companyId, branchId, terminal: String(terminal || "") }
            : { companyId, branchId },
        );
        if (!dayRows || dayRows.length === 0) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Open POS day required for today. Please open day in POS Setup.",
          );
        }
        // If found and status is OPEN or CLOSED, proceed (CLOSED still allowed same day)
      }
      await conn.beginTransaction();

      const receipt_no = await nextReceiptNoTx(conn, companyId);
      const sale_datetime = new Date();
      const createdBy = req.user?.id ?? req.user?.sub ?? null;
      const items = Array.isArray(lines) ? lines : [];

      const gross = roundTo2(
        items.reduce(
          (sum, it) =>
            sum +
            Number(it?.price || it?.unit_price || 0) *
              Number(it?.quantity || it?.qty || 0),
          0,
        ),
      );

      const subtotal = roundTo2(
        items.reduce((sum, it) => {
          const qty = Number(it?.quantity || it?.qty || 0);
          const price = Number(it?.price || it?.unit_price || 0);
          const disc = Number(it?.discount || 0);
          const lineTotal = Math.max(0, qty * price - disc);
          return sum + lineTotal;
        }, 0),
      );

      const discountRaw = gross - subtotal;
      const discount =
        Number.isFinite(discountRaw) && discountRaw > 0
          ? roundTo2(discountRaw)
          : 0;

      const [taxSettingRows] = await conn.execute(
        `SELECT tax_code_id, tax_account_id, tax_type, is_active
         FROM pos_tax_settings
         WHERE company_id = :companyId AND branch_id = :branchId
         LIMIT 1`,
        { companyId, branchId },
      );
      const taxSetting = taxSettingRows?.[0] || null;
      const taxSettingActive =
        taxSetting && Number(taxSetting.is_active) === 0 ? 0 : 1;

      const ratePercent = taxSettingActive
        ? Number(tax_rate_percent ?? 12.5)
        : 0;
      const rateFraction =
        Number.isFinite(ratePercent) && ratePercent > 0 ? ratePercent / 100 : 0;

      const taxMode = String(tax_type || "Exclusive").toLowerCase();

      let tax = 0;
      let net = subtotal;
      if (rateFraction > 0 && subtotal > 0) {
        if (taxMode === "inclusive") {
          const base = subtotal / (1 + rateFraction);
          tax = subtotal - base;
          net = subtotal;
        } else {
          tax = subtotal * rateFraction;
          net = subtotal + tax;
        }
      }
      tax = roundTo2(tax);
      net = roundTo2(net);

      const pm = String(payment_method || "CASH").toUpperCase();
      const st = String(status || "COMPLETED").toUpperCase();
      const finalStatus = st === "DRAFT" ? "DRAFT" : "COMPLETED";

      let terminalIdValue = null;
      if (terminal) {
        const [tRows] = await conn.execute(
          `SELECT id FROM pos_terminals 
           WHERE company_id = :companyId AND branch_id = :branchId AND code = :code 
           LIMIT 1`,
          { companyId, branchId, code: String(terminal || "") },
        );
        terminalIdValue = Number(tRows?.[0]?.id || 0) || null;
      }
      const [saleResult] = await conn.execute(
        `INSERT INTO pos_sales 
         (company_id, branch_id, terminal_id, receipt_no, sale_datetime, customer_name, payment_method, gross_amount, discount_amount, tax_amount, net_amount, status, created_by)
         VALUES 
         (:companyId, :branchId, :terminal_id, :receipt_no, :sale_datetime, :customer_name, :payment_method, :gross_amount, :discount_amount, :tax_amount, :net_amount, :status, :created_by)`,
        {
          companyId,
          branchId,
          terminal_id: terminalIdValue,
          receipt_no,
          sale_datetime,
          customer_name: customer_name || null,
          payment_method: pm === "CARD" || pm === "MOBILE" ? pm : "CASH",
          gross_amount: gross,
          discount_amount: discount,
          tax_amount: tax,
          net_amount: net,
          status: finalStatus,
          created_by: createdBy,
        },
      );

      const saleId = saleResult.insertId;

      for (let i = 0; i < items.length; i += 1) {
        const it = items[i] || {};
        const qty = Number(it?.quantity || it?.qty || 0);
        const unit = Number(it?.price || it?.unit_price || 0);
        const total = roundTo2(qty * unit);
        await conn.execute(
          `INSERT INTO pos_sale_lines (sale_id, line_no, item_name, qty, unit_price, line_total)
           VALUES (:sale_id, :line_no, :item_name, :qty, :unit_price, :line_total)`,
          {
            sale_id: saleId,
            line_no: i + 1,
            item_name: String(it?.name || it?.item_name || ""),
            qty,
            unit_price: unit,
            line_total: total,
          },
        );
        const itemId = Number(it?.item_id || 0);
        if (itemId && qty > 0 && finalStatus === "COMPLETED") {
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
             ON DUPLICATE KEY UPDATE qty = qty + :qty`,
            {
              companyId,
              branchId,
              warehouseId: null,
              itemId,
              qty: -qty,
            },
          );
        }
      }

      if (finalStatus === "COMPLETED") {
        const fiscalYearId = await resolveOpenFiscalYearId(conn, {
          companyId,
        });
        if (!fiscalYearId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "No open fiscal year found for Finance",
          );
        }
        const voucherTypeId = await ensureSalesVoucherTypeIdTx(conn, {
          companyId,
        });
        if (!voucherTypeId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Sales voucher type (SV) not configured",
          );
        }
        let paymentAccId = 0;
        if (Number(payment_mode_id || 0) > 0) {
          const [pmRows] = await conn.execute(
            `SELECT account FROM pos_payment_modes 
             WHERE company_id = :companyId AND branch_id = :branchId AND id = :id LIMIT 1`,
            { companyId, branchId, id: Number(payment_mode_id) },
          );
          const pmAccRef = String(pmRows?.[0]?.account || "").trim();
          if (pmAccRef) {
            paymentAccId = await resolveFinAccountId(conn, {
              companyId,
              accountRef: pmAccRef,
            });
          }
        }
        if (!paymentAccId) {
          const fallbackRef = pm === "CASH" ? "1000" : "1000";
          paymentAccId = await resolveFinAccountId(conn, {
            companyId,
            accountRef: fallbackRef,
          });
        }
        let salesAccId =
          (await resolveFinAccountId(conn, {
            companyId,
            accountRef: "4000",
          })) || (await resolveDefaultSalesAccountId(conn, { companyId }));
        const vatOutputAccId = await resolveFinAccountId(conn, {
          companyId,
          accountRef: "1310",
        });
        if (!paymentAccId || !salesAccId || (tax > 0 && !vatOutputAccId)) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Required Finance accounts not found for posting",
          );
        }
        const baseSales = roundTo2(net - tax);
        const voucherNo = await nextVoucherNoTx(conn, {
          companyId,
          voucherTypeId,
        });
        const voucherDate =
          toYmd(sale_datetime) || new Date().toISOString().slice(0, 10);
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
            narration: `POS Receipt ${receipt_no}`,
            totalDebit: net,
            totalCredit: roundTo2(baseSales + tax),
            createdBy,
            approvedBy: createdBy,
            postedBy: createdBy,
          },
        );
        const voucherId = Number(vIns.insertId || 0);
        let lineNo = 1;
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: paymentAccId,
            description: "POS receipt payment",
            debit: net,
            credit: 0,
            referenceNo: receipt_no,
          },
        );
        if (baseSales > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: salesAccId,
              description: "POS sales revenue",
              debit: 0,
              credit: baseSales,
              referenceNo: receipt_no,
            },
          );
        }
        if (tax > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: vatOutputAccId,
              description: "VAT on sales",
              debit: 0,
              credit: tax,
              referenceNo: receipt_no,
            },
          );
        }
      }

      await conn.commit();
      res.status(201).json({
        id: saleId,
        receipt_no,
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
  "/day/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const terminal = String(req.query.terminal || "").trim();
      await ensurePosTables();
      const rows = await query(
        `
        SELECT
          id,
          terminal_code,
          business_date,
          open_datetime,
          opening_float,
          supervisor_name,
          open_notes,
          close_datetime,
          actual_cash,
          close_notes,
          status
        FROM pos_day_status
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND business_date = CURDATE()
          ${terminal ? "AND terminal_code = :terminal" : ""}
        ORDER BY open_datetime DESC
        LIMIT 1
        `,
        terminal ? { companyId, branchId, terminal } : { companyId, branchId },
      );
      const item = rows.length ? rows[0] : null;
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sessions/:sessionNo/finance-post",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const sessionNo = String(req.params.sessionNo || "").trim();
      if (!sessionNo)
        throw httpError(400, "VALIDATION_ERROR", "Invalid sessionNo");
      await conn.beginTransaction();
      await ensurePosTables();
      const [sessRows] = await conn.execute(
        `SELECT id, terminal_code, cashier_name, start_time, end_time, opening_cash, total_sales, status
         FROM pos_sessions
         WHERE company_id = :companyId AND branch_id = :branchId AND session_no = :sessionNo
         LIMIT 1`,
        { companyId, branchId, sessionNo },
      );
      const sess = sessRows?.[0] || null;
      if (!sess) throw httpError(404, "NOT_FOUND", "Session not found");
      if (String(sess.status || "") !== "CLOSED")
        throw httpError(400, "VALIDATION_ERROR", "Session must be CLOSED");
      const startTime = new Date(sess.start_time);
      const endTime = new Date(sess.end_time || new Date());
      if (
        Number.isNaN(startTime.getTime()) ||
        Number.isNaN(endTime.getTime())
      ) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid session time range");
      }
      const [aggRows] = await conn.execute(
        `SELECT
           SUM(CASE WHEN payment_method='CASH' THEN net_amount ELSE 0 END) AS cash_total,
           SUM(CASE WHEN payment_method='CARD' THEN net_amount ELSE 0 END) AS card_total,
           SUM(CASE WHEN payment_method='MOBILE' THEN net_amount ELSE 0 END) AS mobile_total,
           SUM(tax_amount) AS tax_total,
           SUM(discount_amount) AS discount_total,
           SUM(net_amount) AS net_total
         FROM pos_sales
         WHERE company_id = :companyId
           AND branch_id = :branchId
           AND status = 'COMPLETED'
           AND sale_datetime BETWEEN :startTime AND :endTime`,
        { companyId, branchId, startTime, endTime },
      );
      const cashTotal = roundTo2(aggRows?.cash_total || 0);
      const cardTotal = roundTo2(aggRows?.card_total || 0);
      const mobileTotal = roundTo2(aggRows?.mobile_total || 0);
      const taxTotal = roundTo2(aggRows?.tax_total || 0);
      const netTotal = roundTo2(aggRows?.net_total || 0);
      const baseSales = roundTo2(netTotal - taxTotal);
      const bankTotal = roundTo2(cashTotal + cardTotal + mobileTotal);
      if (bankTotal <= 0 || baseSales < 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "No eligible sales for posting",
        );
      }
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      if (!fiscalYearId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "No open fiscal year found for Finance",
        );
      }
      let voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, {
        companyId,
      });
      if (!voucherTypeId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Journal voucher type (JV) not configured",
        );
      }
      const bankAccId = await resolveFinAccountId(conn, {
        companyId,
        accountRef: "1000",
      });
      const salesAccId = await resolveFinAccountId(conn, {
        companyId,
        accountRef: "4000",
      });
      const vatOutputAccId = await resolveFinAccountId(conn, {
        companyId,
        accountRef: "1310",
      });
      if (!bankAccId || !salesAccId || !vatOutputAccId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Required Finance accounts (1000/4000/1310) not found",
        );
      }
      const [existingV] = await conn.execute(
        `SELECT id FROM fin_vouchers
         WHERE company_id = :companyId AND branch_id = :branchId
           AND narration = :narration
         LIMIT 1`,
        { companyId, branchId, narration: `POS Session ${sessionNo}` },
      );
      if (existingV?.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Session already finance-posted",
        );
      }
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = endTime.toISOString().slice(0, 10);
      const createdBy = req.user?.id ?? req.user?.sub ?? null;
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
          narration: `POS Session ${sessionNo}`,
          totalDebit: bankTotal,
          totalCredit: roundTo2(baseSales + taxTotal),
          createdBy,
          approvedBy: createdBy,
          postedBy: createdBy,
        },
      );
      const voucherId = Number(vIns.insertId || 0);
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: bankAccId,
          description: "POS aggregated receipts",
          debit: bankTotal,
          credit: 0,
        },
      );
      if (baseSales > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: salesAccId,
            description: "POS sales revenue",
            debit: 0,
            credit: baseSales,
          },
        );
      }
      if (taxTotal > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: vatOutputAccId,
            description: "VAT on sales",
            debit: 0,
            credit: taxTotal,
          },
        );
      }
      const [dayRows] = await conn.execute(
        `SELECT actual_cash, opening_float, business_date
         FROM pos_day_status
         WHERE company_id = :companyId AND branch_id = :branchId
           AND terminal_code = :terminal
           AND business_date BETWEEN DATE(:startTime) AND DATE(:endTime)
         ORDER BY business_date DESC
         LIMIT 1`,
        {
          companyId,
          branchId,
          terminal: String(sess.terminal_code || ""),
          startTime,
          endTime,
        },
      );
      const day = dayRows?.[0] || null;
      if (day && day.actual_cash !== null) {
        const expectedCash = roundTo2(
          Number(day.opening_float || 0) + cashTotal,
        );
        const declaredCash = roundTo2(Number(day.actual_cash || 0));
        const variance = roundTo2(declaredCash - expectedCash);
        if (variance !== 0) {
          const cashOverShortAccId = await resolveFinAccountId(conn, {
            companyId,
            accountRef: "CASH_OVER_SHORT",
          });
          if (cashOverShortAccId) {
            if (variance < 0) {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: cashOverShortAccId,
                  description: "Cash short variance",
                  debit: Math.abs(variance),
                  credit: 0,
                },
              );
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: bankAccId,
                  description: "Cash short variance",
                  debit: 0,
                  credit: Math.abs(variance),
                },
              );
            } else {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: bankAccId,
                  description: "Cash over variance",
                  debit: Math.abs(variance),
                  credit: 0,
                },
              );
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: cashOverShortAccId,
                  description: "Cash over variance",
                  debit: 0,
                  credit: Math.abs(variance),
                },
              );
            }
          }
        }
      }
      await conn.commit();
      res.status(201).json({
        session_no: sessionNo,
        voucher_no: voucherNo,
        voucher_id: voucherId,
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
  "/day/open",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { terminal, openingDateTime, openingFloat, supervisor, notes } =
        req.body || {};
      if (!terminal || !openingDateTime) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "terminal and openingDateTime are required",
        );
      }
      await ensurePosTables();
      const openDate = new Date(openingDateTime);
      const businessDate = Number.isNaN(openDate.getTime())
        ? new Date()
        : openDate;
      const existing = await query(
        `
        SELECT id, status
        FROM pos_day_status
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND terminal_code = :terminal
          AND business_date = DATE(:businessDate)
        ORDER BY open_datetime DESC
        LIMIT 1
        `,
        { companyId, branchId, terminal, businessDate },
      );
      if (existing.length && existing[0].status === "OPEN") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Day is already open for this terminal",
        );
      }
      const result = await query(
        `
        INSERT INTO pos_day_status
          (company_id, branch_id, terminal_code, business_date, open_datetime, opening_float, supervisor_name, open_notes, status)
        VALUES
          (:companyId, :branchId, :terminal, DATE(:businessDate), :open_datetime, :opening_float, :supervisor_name, :open_notes, 'OPEN')
        `,
        {
          companyId,
          branchId,
          terminal,
          businessDate,
          open_datetime: openDate,
          opening_float: Number(openingFloat || 0),
          supervisor_name: supervisor || null,
          open_notes: notes || null,
        },
      );
      const [item] = await query(
        `
        SELECT
          id,
          terminal_code,
          business_date,
          open_datetime,
          opening_float,
          supervisor_name,
          open_notes,
          close_datetime,
          actual_cash,
          close_notes,
          status
        FROM pos_day_status
        WHERE id = :id
        LIMIT 1
        `,
        { id: result.insertId },
      );
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/day/close",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { terminal, closingDateTime, actualCash, notes } = req.body || {};
      if (!terminal || !closingDateTime) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "terminal and closingDateTime are required",
        );
      }
      await ensurePosTables();
      const closeDate = new Date(closingDateTime);
      const businessDate = Number.isNaN(closeDate.getTime())
        ? new Date()
        : closeDate;
      const existing = await query(
        `
        SELECT id
        FROM pos_day_status
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND terminal_code = :terminal
          AND business_date = DATE(:businessDate)
        ORDER BY open_datetime DESC
        LIMIT 1
        `,
        { companyId, branchId, terminal, businessDate },
      );
      if (!existing.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Open day not found for this terminal",
        );
      }
      const id = existing[0].id;
      await query(
        `
        UPDATE pos_day_status
        SET close_datetime = :close_datetime,
            actual_cash = :actual_cash,
            close_notes = :close_notes,
            status = 'CLOSED'
        WHERE id = :id
          AND company_id = :companyId
          AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          close_datetime: closeDate,
          actual_cash: Number(actualCash || 0),
          close_notes: notes || null,
        },
      );
      const [item] = await query(
        `
        SELECT
          id,
          terminal_code,
          business_date,
          open_datetime,
          opening_float,
          supervisor_name,
          open_notes,
          close_datetime,
          actual_cash,
          close_notes,
          status
        FROM pos_day_status
        WHERE id = :id
        LIMIT 1
        `,
        { id },
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/terminals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `SELECT id, code, name, warehouse, counter_no, ip_address, is_active 
         FROM pos_terminals 
         WHERE company_id = :companyId AND branch_id = :branchId AND is_active = 1
         ORDER BY code ASC`,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/terminals/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensurePosTables();
      const items = await query(
        `SELECT id, code, name, warehouse, counter_no, ip_address, is_active 
         FROM pos_terminals 
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId 
         LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!items.length)
        throw httpError(404, "NOT_FOUND", "Terminal not found");
      res.json({ item: items[0] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/terminals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { code, name, warehouse, counter_no, ip_address, active } =
        req.body || {};
      if (!code || !name)
        throw httpError(400, "VALIDATION_ERROR", "code and name are required");
      await ensurePosTables();
      const result = await query(
        `INSERT INTO pos_terminals (company_id, branch_id, code, name, warehouse, counter_no, ip_address, is_active)
         VALUES (:companyId, :branchId, :code, :name, :warehouse, :counter_no, :ip_address, :is_active)`,
        {
          companyId,
          branchId,
          code,
          name,
          warehouse: warehouse || null,
          counter_no: counter_no ? Number(counter_no) : null,
          ip_address: ip_address || null,
          is_active: active ? 1 : 0,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/terminals/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const { code, name, warehouse, counter_no, ip_address, active } =
        req.body || {};
      await ensurePosTables();
      const [existing] = await query(
        `SELECT id FROM pos_terminals WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Terminal not found");
      await query(
        `UPDATE pos_terminals
         SET code = :code, name = :name, warehouse = :warehouse, counter_no = :counter_no, ip_address = :ip_address, is_active = :is_active
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          code,
          name,
          warehouse: warehouse || null,
          counter_no: counter_no ? Number(counter_no) : null,
          ip_address: ip_address || null,
          is_active: active ? 1 : 0,
        },
      );
      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/terminal-users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const terminalId = toNumber(req.query.terminalId, 0) || 0;
      await ensurePosTables();
      const items = await query(
        `
        SELECT
          ptu.terminal_id,
          ptu.user_id,
          ptu.is_active,
          u.username,
          u.full_name,
          u.email
        FROM pos_terminal_users ptu
        JOIN adm_users u ON u.id = ptu.user_id
        WHERE ptu.company_id = :companyId
          AND ptu.branch_id = :branchId
          AND (:terminalId = 0 OR ptu.terminal_id = :terminalId)
        ORDER BY u.username ASC
        `,
        { companyId, branchId, terminalId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/terminal-users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { terminalId, userIds } = req.body || {};
      const tId = toNumber(terminalId, 0);
      if (!tId) {
        throw httpError(400, "VALIDATION_ERROR", "terminalId is required");
      }
      const cleanUserIds = Array.from(
        new Set(Array.isArray(userIds) ? userIds : []),
      )
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);

      await ensurePosTables();

      const [term] = await query(
        `SELECT id
         FROM pos_terminals
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
         LIMIT 1`,
        { id: tId, companyId, branchId },
      );
      if (!term) throw httpError(404, "NOT_FOUND", "Terminal not found");

      if (cleanUserIds.length) {
        const placeholders = cleanUserIds.map((_, i) => `:uid${i}`).join(", ");
        const params = { companyId, branchId };
        for (let i = 0; i < cleanUserIds.length; i += 1) {
          params[`uid${i}`] = cleanUserIds[i];
        }
        const rows = await query(
          `
          SELECT id
          FROM adm_users
          WHERE company_id = :companyId
            AND branch_id = :branchId
            AND id IN (${placeholders})
          `,
          params,
        );
        const validSet = new Set((rows || []).map((r) => Number(r.id)));
        for (const uid of cleanUserIds) {
          if (!validSet.has(uid)) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "One or more users are invalid for this branch",
            );
          }
        }
      }

      await query(
        `DELETE FROM pos_terminal_users
         WHERE company_id = :companyId AND branch_id = :branchId AND terminal_id = :terminalId`,
        { companyId, branchId, terminalId: tId },
      );

      for (const uid of cleanUserIds) {
        await query(
          `INSERT INTO pos_terminal_users (company_id, branch_id, terminal_id, user_id, is_active)
           VALUES (:companyId, :branchId, :terminalId, :userId, 1)`,
          { companyId, branchId, terminalId: tId, userId: uid },
        );
      }

      res.json({ terminalId: tId, assigned: cleanUserIds.length });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/tax-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const rows = await query(
        `
        SELECT
          s.tax_code_id,
          s.tax_account_id,
          s.tax_type,
          s.is_active,
          t.code AS tax_code,
          t.name AS tax_name,
          t.rate_percent AS tax_rate_percent
        FROM pos_tax_settings s
        LEFT JOIN fin_tax_codes t
          ON t.company_id = s.company_id
         AND t.id = s.tax_code_id
        WHERE s.company_id = :companyId
          AND s.branch_id = :branchId
        LIMIT 1
        `,
        { companyId, branchId },
      );
      res.json({ item: rows?.[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/tax-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { taxCodeId, taxAccountId, taxType, isActive } = req.body || {};
      await ensurePosTables();

      const normalizedTaxType = String(taxType || "").trim();
      if (
        normalizedTaxType &&
        normalizedTaxType !== "Inclusive" &&
        normalizedTaxType !== "Exclusive"
      ) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid taxType");
      }

      const taxCodeIdNum = toNumber(taxCodeId, null);
      const taxAccountIdNum = toNumber(taxAccountId, null);
      const isActiveNum =
        isActive === undefined ? null : Number(Boolean(isActive));

      if (taxCodeIdNum) {
        const rows = await query(
          `
          SELECT id
          FROM fin_tax_codes
          WHERE company_id = :companyId
            AND id = :id
          LIMIT 1
          `,
          { companyId, id: taxCodeIdNum },
        );
        if (!rows.length)
          throw httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId");
      }

      if (taxAccountIdNum) {
        const rows = await query(
          `
          SELECT id
          FROM fin_accounts
          WHERE company_id = :companyId
            AND id = :id
          LIMIT 1
          `,
          { companyId, id: taxAccountIdNum },
        );
        if (!rows.length)
          throw httpError(400, "VALIDATION_ERROR", "Invalid taxAccountId");
      }

      const [existing] = await query(
        `
        SELECT id
        FROM pos_tax_settings
        WHERE company_id = :companyId
          AND branch_id = :branchId
        LIMIT 1
        `,
        { companyId, branchId },
      );

      if (existing?.id) {
        await query(
          `
          UPDATE pos_tax_settings
          SET tax_code_id = :tax_code_id,
              tax_account_id = :tax_account_id,
              tax_type = :tax_type,
              is_active = COALESCE(:is_active, is_active)
          WHERE id = :id
            AND company_id = :companyId
            AND branch_id = :branchId
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            tax_code_id: taxCodeIdNum,
            tax_account_id: taxAccountIdNum,
            tax_type: normalizedTaxType || "Exclusive",
            is_active: isActiveNum,
          },
        );
        return res.json({ id: existing.id });
      }

      const result = await query(
        `
        INSERT INTO pos_tax_settings
          (company_id, branch_id, tax_code_id, tax_account_id, tax_type, is_active)
        VALUES
          (:companyId, :branchId, :tax_code_id, :tax_account_id, :tax_type, :is_active)
        `,
        {
          companyId,
          branchId,
          tax_code_id: taxCodeIdNum,
          tax_account_id: taxAccountIdNum,
          tax_type: normalizedTaxType || "Exclusive",
          is_active: isActiveNum === null ? 1 : isActiveNum,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/receipt-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const rows = await query(
        `
        SELECT
          company_name,
          show_logo,
          header_text,
          footer_text,
          contact_number,
          address_line1,
          address_line2,
          logo_url
        FROM pos_receipt_settings
        WHERE company_id = :companyId
          AND branch_id = :branchId
        LIMIT 1
        `,
        { companyId, branchId },
      );
      res.json({ item: rows?.[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/receipt-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const {
        companyName,
        showLogo,
        headerText,
        footerText,
        contactNumber,
        addressLine1,
        addressLine2,
        logoUrl,
      } = req.body || {};
      await ensurePosTables();

      const company_name = companyName
        ? String(companyName).slice(0, 255)
        : null;
      const showLogoNum =
        showLogo === undefined ? null : Number(Boolean(showLogo));
      const header_text = headerText ? String(headerText).slice(0, 2000) : null;
      const footer_text = footerText ? String(footerText).slice(0, 2000) : null;
      const contact_number = contactNumber
        ? String(contactNumber).slice(0, 50)
        : null;
      const address_line1 = addressLine1
        ? String(addressLine1).slice(0, 255)
        : null;
      const address_line2 = addressLine2
        ? String(addressLine2).slice(0, 255)
        : null;
      const logo_url = logoUrl ? String(logoUrl).slice(0, 255) : null;

      const [existing] = await query(
        `
        SELECT id
        FROM pos_receipt_settings
        WHERE company_id = :companyId
          AND branch_id = :branchId
        LIMIT 1
        `,
        { companyId, branchId },
      );

      if (existing?.id) {
        await query(
          `
          UPDATE pos_receipt_settings
          SET show_logo = COALESCE(:show_logo, show_logo),
              company_name = :company_name,
              header_text = :header_text,
              footer_text = :footer_text,
              contact_number = :contact_number,
              address_line1 = :address_line1,
              address_line2 = :address_line2,
              logo_url = :logo_url
          WHERE id = :id
            AND company_id = :companyId
            AND branch_id = :branchId
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            company_name,
            show_logo: showLogoNum,
            header_text,
            footer_text,
            contact_number,
            address_line1,
            address_line2,
            logo_url,
          },
        );
        return res.json({ id: existing.id });
      }

      const result = await query(
        `
        INSERT INTO pos_receipt_settings
          (company_id, branch_id, company_name, show_logo, header_text, footer_text, contact_number, address_line1, address_line2, logo_url)
        VALUES
          (:companyId, :branchId, :company_name, :show_logo, :header_text, :footer_text, :contact_number, :address_line1, :address_line2, :logo_url)
        `,
        {
          companyId,
          branchId,
          company_name,
          show_logo: showLogoNum === null ? 0 : showLogoNum,
          header_text,
          footer_text,
          contact_number,
          address_line1,
          address_line2,
          logo_url,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

const posLogoUpload = multer({ storage: multer.memoryStorage() });
router.post(
  "/receipt-settings/logo",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  posLogoUpload.single("logo"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      await query("UPDATE adm_companies SET logo = :blob WHERE id = :id", {
        blob: req.file.buffer,
        id: companyId,
      });
      await ensurePosTables();
      const logoUrl = `/api/admin/companies/${companyId}/logo`;
      const [existing] = await query(
        `
        SELECT id
        FROM pos_receipt_settings
        WHERE company_id = :companyId
          AND branch_id = :branchId
        LIMIT 1
        `,
        { companyId, branchId },
      );
      if (existing?.id) {
        await query(
          `
          UPDATE pos_receipt_settings
          SET logo_url = :logo_url,
              show_logo = 1
          WHERE id = :id
            AND company_id = :companyId
            AND branch_id = :branchId
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            logo_url: logoUrl,
          },
        );
      } else {
        await query(
          `
          INSERT INTO pos_receipt_settings
            (company_id, branch_id, show_logo, logo_url)
          VALUES
            (:companyId, :branchId, 1, :logo_url)
          `,
          { companyId, branchId, logo_url: logoUrl },
        );
      }
      return res.json({
        message: "Logo uploaded",
        logoUrl,
        hasLogo: true,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      await ensurePosTables();
      const items = await query(
        `SELECT
           id,
           name,
           type,
           account,
           require_reference,
           is_active
         FROM pos_payment_modes
         WHERE company_id = :companyId
           AND branch_id = :branchId
         ORDER BY name ASC`,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const result = await query(
        `INSERT INTO pos_payment_modes
           (company_id, branch_id, name, type, account, require_reference, is_active)
         VALUES
           (:companyId, :branchId, :name, :type, :account, :require_reference, :is_active)`,
        {
          companyId,
          branchId,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/payment-modes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const [existing] = await query(
        `SELECT id
         FROM pos_payment_modes
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
         LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!existing) {
        throw httpError(404, "NOT_FOUND", "Payment mode not found");
      }
      await query(
        `UPDATE pos_payment_modes
         SET name = :name,
             type = :type,
             account = :account,
             require_reference = :require_reference,
             is_active = :is_active
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
