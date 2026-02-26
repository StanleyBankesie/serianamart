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
import { ensureSalesOrderColumns } from "../utils/dbUtils.js";
import { requireIdParam } from "../controllers/finance.controller.js";

const router = express.Router();

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
async function ensureInvoiceTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      invoice_no VARCHAR(50) NOT NULL,
      invoice_date DATE NULL,
      customer_id BIGINT UNSIGNED NULL,
      payment_status VARCHAR(30) DEFAULT 'UNPAID',
      status VARCHAR(30) DEFAULT 'DRAFT',
      total_amount DECIMAL(18,2) DEFAULT 0,
      net_amount DECIMAL(18,2) DEFAULT 0,
      balance_amount DECIMAL(18,2) DEFAULT 0,
      price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL',
      payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH',
      currency_id BIGINT UNSIGNED DEFAULT 4,
      exchange_rate DECIMAL(18,6) DEFAULT 1,
      warehouse_id BIGINT UNSIGNED NULL,
      sales_order_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_invoice_scope_no (company_id, branch_id, invoice_no),
      KEY idx_invoice_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_invoice_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      invoice_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      uom VARCHAR(20) NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_invoice_details_invoice (invoice_id),
      KEY idx_invoice_details_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  const details = "sal_invoice_details";
  if (!(await hasColumn(details, "quantity")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN quantity DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "unit_price")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL AFTER unit_price`,
    ).catch(() => null);
  if (!(await hasColumn(details, "discount_percent")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "total_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN total_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "net_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN net_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "tax_amount")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(`ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL`).catch(
      () => null,
    );
  if (!(await hasColumn(details, "remarks")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN remarks VARCHAR(255) NULL`,
    ).catch(() => null);
  const table = "sal_invoices";
  if (!(await hasColumn(table, "total_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN total_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "net_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "balance_amount")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN balance_amount DECIMAL(18,2) DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(table, "price_type")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'`,
    ).catch(() => null);
  if (!(await hasColumn(table, "payment_type")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'`,
    ).catch(() => null);
  if (!(await hasColumn(table, "currency_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4`,
    ).catch(() => null);
  if (!(await hasColumn(table, "exchange_rate")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1`,
    ).catch(() => null);
  if (!(await hasColumn(table, "warehouse_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  if (!(await hasColumn(table, "sales_order_id")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN sales_order_id BIGINT UNSIGNED NULL`,
    ).catch(() => null);
  if (!(await hasColumn(table, "remarks")))
    await query(`ALTER TABLE ${table} ADD COLUMN remarks TEXT NULL`).catch(
      () => null,
    );
  if (!(await hasColumn(table, "created_by")))
    await query(
      `ALTER TABLE ${table} ADD COLUMN created_by BIGINT UNSIGNED NULL`,
    ).catch(() => null);
}
async function ensureSalesReturnTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_returns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      return_no VARCHAR(50) NOT NULL,
      return_date DATE NOT NULL,
      invoice_id BIGINT UNSIGNED NULL,
      customer_id BIGINT UNSIGNED NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      return_type VARCHAR(50) DEFAULT 'DAMAGED',
      status VARCHAR(20) DEFAULT 'DRAFT',
      remarks TEXT,
      total_amount DECIMAL(18,2) DEFAULT 0,
      tax_amount DECIMAL(18,2) DEFAULT 0,
      sub_total DECIMAL(18,2) DEFAULT 0,
      created_by BIGINT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_return_no (company_id, branch_id, return_no),
      INDEX idx_company_branch (company_id, branch_id)
    )
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_return_details (
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
      INDEX idx_return (return_id),
      CONSTRAINT fk_sal_return_details_header FOREIGN KEY (return_id) REFERENCES sal_returns(id) ON DELETE CASCADE
    )
  `).catch(() => null);
}
async function ensureDeliveryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sal_deliveries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      delivery_no VARCHAR(50) NOT NULL,
      delivery_date DATE NOT NULL,
      customer_id BIGINT UNSIGNED NOT NULL,
      sales_order_id BIGINT UNSIGNED NULL,
      remarks TEXT NULL,
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_delivery_scope_no (company_id, branch_id, delivery_no),
      KEY idx_delivery_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  await query(`
    CREATE TABLE IF NOT EXISTS sal_delivery_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      uom VARCHAR(20) NULL,
      remarks VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_delivery_details_delivery (delivery_id),
      KEY idx_delivery_details_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => null);
  const deliveries = "sal_deliveries";
  if (!(await hasColumn(deliveries, "invoice_id")))
    await query(
      `ALTER TABLE ${deliveries} ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER sales_order_id`,
    ).catch(() => null);
  const details = "sal_delivery_details";
  if (!(await hasColumn(details, "unit_price")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0`,
    ).catch(() => null);
  if (!(await hasColumn(details, "uom")))
    await query(
      `ALTER TABLE ${details} ADD COLUMN uom VARCHAR(20) NULL AFTER unit_price`,
    ).catch(() => null);
}
async function ensureDeliverySequenceTableTx(conn) {
  await conn
    .execute(
      `
      CREATE TABLE IF NOT EXISTS sal_delivery_sequences (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        prefix VARCHAR(10) NOT NULL DEFAULT 'DN',
        next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_delivery_seq_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    )
    .catch(() => null);
}
async function nextDeliveryNoTx(conn, { companyId, branchId }) {
  await ensureDeliverySequenceTableTx(conn);
  const [rows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_delivery_sequences
    WHERE company_id = :companyId AND branch_id = :branchId
    FOR UPDATE
    `,
    { companyId, branchId },
  );
  if (!rows?.length) {
    const [maxRows] = await conn.execute(
      `
      SELECT delivery_no
      FROM sal_deliveries
      WHERE company_id = :companyId
        AND branch_id = :branchId
        AND delivery_no REGEXP '^DN-?[0-9]{6}$'
      ORDER BY CAST(REPLACE(delivery_no, 'DN-', '') AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId, branchId },
    );
    let startNext = 1;
    if (maxRows?.length) {
      const prev = String(maxRows[0].delivery_no || "");
      const numPart = prev.replace(/^DN-?/, "");
      const n = parseInt(numPart, 10);
      if (Number.isFinite(n)) startNext = n + 1;
    }
    await conn.execute(
      `
      INSERT INTO sal_delivery_sequences (company_id, branch_id, prefix, next_number)
      VALUES (:companyId, :branchId, 'DN', :next)
      `,
      { companyId, branchId, next: startNext },
    );
  }
  const [seqRows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_delivery_sequences
    WHERE company_id = :companyId AND branch_id = :branchId
    LIMIT 1
    `,
    { companyId, branchId },
  );
  const seq = seqRows?.[0];
  if (!seq)
    throw httpError(500, "SERVER_ERROR", "Delivery sequence not initialized");
  const nextNo = `${seq.prefix}${String(seq.next_number).padStart(6, "0")}`;
  await conn.execute(
    `
    UPDATE sal_delivery_sequences
       SET next_number = next_number + 1
     WHERE company_id = :companyId AND branch_id = :branchId
    `,
    { companyId, branchId },
  );
  return nextNo;
}
async function hasTrigger(triggerName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.triggers
    WHERE trigger_name = :triggerName
      AND trigger_schema = DATABASE()
    `,
    { triggerName },
  ).catch(() => []);
  return Number(rows?.[0]?.c || 0) > 0;
}
async function ensureStandardPriceSyncTriggers() {
  if (!(await hasTrigger("tr_sal_standard_prices_ai_item_price"))) {
    await pool
      .query(
        `
        CREATE TRIGGER tr_sal_standard_prices_ai_item_price
        AFTER INSERT ON sal_standard_prices
        FOR EACH ROW
        BEGIN
          UPDATE inv_items
             SET selling_price = NEW.selling_price
           WHERE company_id = NEW.company_id
             AND id = NEW.product_id;
        END
        `,
      )
      .catch(() => null);
  }
  if (!(await hasTrigger("tr_sal_standard_prices_au_item_price"))) {
    await pool
      .query(
        `
        CREATE TRIGGER tr_sal_standard_prices_au_item_price
        AFTER UPDATE ON sal_standard_prices
        FOR EACH ROW
        BEGIN
          UPDATE inv_items
             SET selling_price = NEW.selling_price
           WHERE company_id = NEW.company_id
             AND id = NEW.product_id;
        END
        `,
      )
      .catch(() => null);
  }
}
async function nextSalesReturnNo(companyId, branchId) {
  const rows = await query(
    `SELECT return_no
     FROM sal_returns
     WHERE company_id = :companyId AND branch_id = :branchId
       AND return_no REGEXP '^SR-[0-9]{6}$'
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
  return `SR-${String(nextNum).padStart(6, "0")}`;
}
function toYmd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function ensureCreditNoteVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "CN",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'CN', 'Credit Note', 'CREDIT_NOTE', 'CN', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "CN" });
  return id || 0;
}
async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId LIMIT 1",
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
async function ensureInvoiceSequenceTableTx(conn) {
  await conn
    .execute(
      `
      CREATE TABLE IF NOT EXISTS sal_invoice_sequences (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
        next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_invoice_seq_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    )
    .catch(() => null);
}
async function nextInvoiceNoTx(conn, { companyId, branchId }) {
  await ensureInvoiceSequenceTableTx(conn);
  const [rows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_invoice_sequences
    WHERE company_id = :companyId AND branch_id = :branchId
    FOR UPDATE
    `,
    { companyId, branchId },
  );
  if (!rows?.length) {
    const [maxRows] = await conn.execute(
      `
      SELECT invoice_no
      FROM sal_invoices
      WHERE company_id = :companyId
        AND branch_id = :branchId
        AND invoice_no REGEXP '^INV-?[0-9]{6}$'
      ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId, branchId },
    );
    let startNext = 1;
    if (maxRows?.length) {
      const prev = String(maxRows[0].invoice_no || "");
      const numPart = prev.replace(/^INV-?/, "");
      const n = parseInt(numPart, 10);
      if (Number.isFinite(n)) startNext = n + 1;
    }
    await conn.execute(
      `
      INSERT INTO sal_invoice_sequences (company_id, branch_id, prefix, next_number)
      VALUES (:companyId, :branchId, 'INV', :next)
      `,
      { companyId, branchId, next: startNext },
    );
  }
  const [seqRows] = await conn.execute(
    `
    SELECT prefix, next_number
    FROM sal_invoice_sequences
    WHERE company_id = :companyId AND branch_id = :branchId
    LIMIT 1
    `,
    { companyId, branchId },
  );
  const seq = seqRows?.[0];
  if (!seq) throw httpError(500, "SERVER_ERROR", "Sequence not initialized");
  const nextNo = `${seq.prefix}${String(seq.next_number).padStart(6, "0")}`;
  await conn.execute(
    `
    UPDATE sal_invoice_sequences
       SET next_number = next_number + 1
     WHERE company_id = :companyId AND branch_id = :branchId
    `,
    { companyId, branchId },
  );
  return nextNo;
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
    VALUES (:companyId, :code, :startDate, :EndDate, 1)
    `,
    { companyId, code, startDate, EndDate: endDate },
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
async function ensureStockBalancesWarehouseInfrastructure() {
  if (!(await hasColumn("inv_stock_balances", "warehouse_id"))) {
    await query(
      "ALTER TABLE inv_stock_balances ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
    ).catch(() => null);
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

router.get(
  "/prospects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId } = req.scope;
      const q = String(req.query.q || "").trim();
      await query(`
        CREATE TABLE IF NOT EXISTS sal_prospect_customers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          prospect_customer VARCHAR(200) NOT NULL,
          address VARCHAR(255) NULL,
          city VARCHAR(100) NULL,
          state VARCHAR(100) NULL,
          country VARCHAR(100) NULL,
          telephone VARCHAR(50) NULL,
          email VARCHAR(150) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_prospect_scope_name (company_id, prospect_customer),
          KEY idx_prospect_scope (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(() => null);
      const params = { companyId };
      let where = "company_id = :companyId";
      if (q) {
        where += " AND prospect_customer LIKE :q";
        params.q = `%${q}%`;
      }
      const items = await query(
        `
        SELECT id, company_id, prospect_customer, address, city, state, country, telephone, email
        FROM sal_prospect_customers
        WHERE ${where}
        ORDER BY prospect_customer ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const active = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const onlyActive = active === "true" || active === "1";
      const params = { companyId };
      const where = ["c.company_id = :companyId"];
      if (onlyActive) where.push("c.is_active = 1");
      const items = await query(
        `SELECT 
           c.id,
           c.company_id,
           c.branch_id,
           c.customer_code,
           c.customer_name,
           c.customer_type,
           c.price_type_id,
           pt.name AS price_type_name,
           c.contact_person,
           c.email,
           c.phone,
           c.mobile,
           c.credit_limit,
           c.is_active,
           c.address,
           c.city,
           c.state,
           c.zone,
           c.country,
           c.payment_terms,
           c.currency_id
         FROM sal_customers c
         LEFT JOIN sal_price_types pt
           ON pt.id = c.price_type_id AND pt.company_id = c.company_id
         WHERE ${where.join(" AND ")}
         ORDER BY c.customer_name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureDeliveryTables();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        invoice_id,
        remarks,
        status,
        items,
      } = req.body || {};
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!ddate || !Number.isFinite(custId)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        let warehouseId = null;
        const invoiceIdNum =
          invoice_id == null ? null : Number(invoice_id || 0) || null;
        if (invoiceIdNum) {
          const [invRows] = await conn.execute(
            `
            SELECT warehouse_id
            FROM sal_invoices
            WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
            LIMIT 1
            `,
            { id: invoiceIdNum, companyId, branchId },
          );
          if (invRows?.length) {
            warehouseId =
              invRows[0].warehouse_id == null
                ? null
                : Number(invRows[0].warehouse_id) || null;
          }
        }
        let finalDeliveryNo = String(delivery_no || "").trim();
        if (!finalDeliveryNo) {
          finalDeliveryNo = await nextDeliveryNoTx(conn, {
            companyId,
            branchId,
          });
        } else {
          const [dupRows] = await conn.execute(
            `
            SELECT id
            FROM sal_deliveries
            WHERE company_id = :companyId AND branch_id = :branchId AND delivery_no = :delivery_no
            LIMIT 1
            `,
            { companyId, branchId, delivery_no: finalDeliveryNo },
          );
          if (dupRows?.length) {
            finalDeliveryNo = await nextDeliveryNoTx(conn, {
              companyId,
              branchId,
            });
          }
        }
        const [ins] = await conn.execute(
          `
          INSERT INTO sal_deliveries
            (company_id, branch_id, delivery_no, delivery_date, customer_id, sales_order_id, invoice_id, remarks, status)
          VALUES
            (:companyId, :branchId, :delivery_no, DATE(:delivery_date), :customer_id, :sales_order_id, :invoice_id, :remarks, :status)
          `,
          {
            companyId,
            branchId,
            delivery_no: finalDeliveryNo,
            delivery_date: ddate,
            customer_id: custId,
            sales_order_id: Number.isFinite(soId) ? soId : null,
            invoice_id: invoiceIdNum,
            remarks: remarks || null,
            status: st,
          },
        );
        const deliveryId = ins.insertId;
        const arr = Array.isArray(items) ? items : [];
        for (const it of arr) {
          const item_id = Number(it?.item_id);
          const quantity = Number(it?.quantity || 0);
          const unit_price = Number(it?.unit_price || 0);
          const uom = String(it?.uom || "PCS").trim();
          if (!Number.isFinite(item_id) || quantity <= 0) continue;
          await conn.execute(
            `
            INSERT INTO sal_delivery_details
              (delivery_id, item_id, quantity, unit_price, uom)
            VALUES
              (:delivery_id, :item_id, :quantity, :unit_price, :uom)
            `,
            {
              delivery_id: deliveryId,
              item_id,
              quantity,
              unit_price,
              uom,
            },
          );
          await conn.execute(
            `
            INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
            VALUES (:companyId, :branchId, :warehouseId, :item_id, :qty)
            ON DUPLICATE KEY UPDATE qty = qty - :qty
            `,
            {
              companyId,
              branchId,
              warehouseId,
              item_id,
              qty: quantity,
            },
          );
        }
        await conn.commit();
        const [item] = await query(
          `
          SELECT
            d.id,
            d.delivery_no,
            d.delivery_date,
            d.sales_order_id,
            d.invoice_id,
            d.customer_id,
            COALESCE(c.customer_name, '') AS customer_name,
            d.status
          FROM sal_deliveries d
          LEFT JOIN sal_customers c
            ON c.id = d.customer_id AND c.company_id = d.company_id
          WHERE d.id = :id
          LIMIT 1
          `,
          { id: deliveryId },
        ).catch(() => []);
        res.status(201).json({ item });
      } catch (err) {
        try {
          await conn.rollback();
        } catch {}
        throw err;
      } finally {
        conn.release();
      }
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureDeliveryTables();
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        delivery_no,
        delivery_date,
        customer_id,
        sales_order_id,
        invoice_id,
        remarks,
        status,
        items,
      } = req.body || {};
      const dno = String(delivery_no || "").trim();
      const ddate = delivery_date ? String(delivery_date).slice(0, 10) : null;
      const custId = Number(customer_id);
      const soId = sales_order_id == null ? null : Number(sales_order_id);
      const invId = invoice_id == null ? null : Number(invoice_id);
      const st = String(status || "DRAFT")
        .trim()
        .toUpperCase();
      const [existing] = await query(
        `
        SELECT id FROM sal_deliveries
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
        UPDATE sal_deliveries
           SET delivery_no = :delivery_no,
               delivery_date = DATE(:delivery_date),
               customer_id = :customer_id,
               sales_order_id = :sales_order_id,
               invoice_id = :invoice_id,
               remarks = :remarks,
               status = :status
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          delivery_no: dno,
          delivery_date: ddate,
          customer_id: custId,
          sales_order_id: Number.isFinite(soId) ? soId : null,
          invoice_id: Number.isFinite(invId) ? invId : null,
          remarks: remarks || null,
          status: st,
        },
      );
      await query(
        `
        DELETE FROM sal_delivery_details
        WHERE delivery_id = :id
        `,
        { id },
      );
      const arr = Array.isArray(items) ? items : [];
      for (const it of arr) {
        const item_id = Number(it?.item_id);
        const quantity = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || quantity <= 0) continue;
        await query(
          `
          INSERT INTO sal_delivery_details
            (delivery_id, item_id, quantity, unit_price, uom)
          VALUES
            (:delivery_id, :item_id, :quantity, :unit_price, :uom)
          `,
          {
            delivery_id: id,
            item_id,
            quantity,
            unit_price,
            uom,
          },
        );
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/price-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission([
    "SAL.CUSTOMER.VIEW",
    "SAL.ORDER.VIEW",
    "SAL.INVOICE.VIEW",
  ]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const active = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const onlyActive = active === "true" || active === "1";
      const params = { companyId };
      const where = ["company_id = :companyId"];
      if (onlyActive) where.push("is_active = 1");
      const items = await query(
        `SELECT id, name, description, is_active
           FROM sal_price_types
          WHERE ${where.join(" AND ")}
          ORDER BY name ASC`,
        params,
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT 
           q.id,
           q.quotation_no,
           q.quotation_date,
           q.customer_id,
           COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
           COALESCE(q.valid_until, q.quotation_date) AS valid_until,
           q.total_amount,
           q.status,
           q.price_type,
           q.payment_type,
           q.currency_id,
           q.exchange_rate
         FROM sal_quotations q
         LEFT JOIN sal_customers c
           ON c.id = q.customer_id AND c.company_id = q.company_id
         WHERE q.company_id = :companyId AND q.branch_id = :branchId
         ORDER BY q.quotation_date DESC, q.id DESC`,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/quotations/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT quotation_no
        FROM sal_quotations
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND quotation_no REGEXP '^QN[0-9]{6}$'
        ORDER BY CAST(REPLACE(quotation_no, 'QN', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].quotation_no || "");
        const numPart = prev.replace(/^QN/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `QN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.ORDER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT id, order_no, order_date, customer_id, status, total_amount
           FROM sal_orders
          WHERE company_id = :companyId AND branch_id = :branchId
          ORDER BY order_date DESC, id DESC`,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          o.id,
          o.order_no,
          o.order_date,
          o.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          o.status,
          o.total_amount,
          o.sub_total,
          o.tax_amount,
          o.currency_id,
          o.exchange_rate,
          o.price_type,
          o.payment_type,
          o.warehouse_id,
          o.quotation_id,
          o.remarks
        FROM sal_orders o
        LEFT JOIN sal_customers c
          ON c.id = o.customer_id AND c.company_id = o.company_id
        WHERE o.id = :id AND o.company_id = :companyId AND o.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Order not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.qty AS quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.tax_amount,
          d.uom,
          it.item_code,
          it.item_name
        FROM sal_order_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        WHERE d.order_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const payload = {
        companyId,
        branchId,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
      };
      const result = await query(
        `
        INSERT INTO sal_orders
          (company_id, branch_id, order_no, order_date, customer_id, status, total_amount, sub_total, tax_amount, currency_id, exchange_rate, price_type, payment_type, warehouse_id, quotation_id, remarks)
        VALUES
          (:companyId, :branchId, :order_no, DATE(:order_date), :customer_id, :status, :total_amount, :sub_total, :tax_amount, :currency_id, :exchange_rate, :price_type, :payment_type, :warehouse_id, :quotation_id, :remarks)
        `,
        payload,
      );
      const orderId = result.insertId;
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom)
          `,
          {
            order_id: orderId,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
          },
        );
      }
      const [item] = await query(
        `
        SELECT 
          o.id, o.order_no, o.order_date, o.customer_id, c.customer_name,
          o.status, o.total_amount
        FROM sal_orders o
        LEFT JOIN sal_customers c ON c.id = o.customer_id AND c.company_id = o.company_id
        WHERE o.id = :id
        LIMIT 1
        `,
        { id: orderId },
      ).catch(() => []);
      res.status(201).json({ id: orderId, item: item || null });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const customer_id = Number(body.customer_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date || !Number.isFinite(customer_id)) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      // Ensure order exists
      const [existing] = await query(
        `
        SELECT id FROM sal_orders
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");
      const payload = {
        id,
        companyId,
        branchId,
        order_no,
        order_date,
        customer_id,
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id:
          body.warehouse_id == null ? null : Number(body.warehouse_id),
        quotation_id:
          body.quotation_id == null ? null : Number(body.quotation_id),
        remarks: body.remarks || null,
      };
      await query(
        `
        UPDATE sal_orders
           SET order_no = :order_no,
               order_date = DATE(:order_date),
               customer_id = :customer_id,
               status = :status,
               total_amount = :total_amount,
               sub_total = :sub_total,
               tax_amount = :tax_amount,
               currency_id = :currency_id,
               exchange_rate = :exchange_rate,
               price_type = :price_type,
               payment_type = :payment_type,
               warehouse_id = :warehouse_id,
               quotation_id = :quotation_id,
               remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        payload,
      );
      await query(
        `
        DELETE FROM sal_order_details
        WHERE order_id = :id
        `,
        { id },
      );
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        const unit_price = Number(it?.unit_price || 0);
        const discount_percent = Number(it?.discount_percent || 0);
        const total_amount = Number(it?.total_amount || 0);
        const net_amount = Number(it?.net_amount || 0);
        const tax_amount = Number(it?.tax_amount || 0);
        const uom = String(it?.uom || "PCS").trim();
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `
          INSERT INTO sal_order_details
            (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom)
          VALUES
            (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom)
          `,
          {
            order_id: id,
            item_id,
            qty,
            unit_price,
            discount_percent,
            total_amount,
            net_amount,
            tax_amount,
            uom,
          },
        );
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/orders/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.ORDER.VIEW", "SAL.INVOICE.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesOrderColumns();
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [existing] = await query(
        `
        SELECT id, status 
        FROM sal_orders
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");
      const nextStatus = "SUBMITTED";
      await query(
        `
        UPDATE sal_orders
           SET status = :status
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId, status: nextStatus },
      );
      res.json({ id, status: nextStatus });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/invoices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const customerId = req.query.customer_id
        ? Number(req.query.customer_id)
        : null;
      const items = await query(
        `SELECT 
           i.id,
           i.invoice_no,
           i.invoice_date,
           i.customer_id,
           COALESCE(c.customer_name, '') AS customer_name,
           i.payment_status,
           i.status,
           i.net_amount,
           i.balance_amount,
           i.price_type,
           i.payment_type,
           i.warehouse_id,
           i.sales_order_id,
           i.remarks
         FROM sal_invoices i
         LEFT JOIN sal_customers c
           ON c.id = i.customer_id AND c.company_id = i.company_id
         WHERE i.company_id = :companyId AND i.branch_id = :branchId
           ${customerId ? "AND i.customer_id = :customerId" : ""}
         ORDER BY i.invoice_date DESC, i.id DESC`,
        { companyId, branchId, customerId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.invoice_date,
          i.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          i.payment_status,
          i.status,
          i.total_amount,
          i.net_amount,
          i.balance_amount,
          i.price_type,
          i.payment_type,
          i.currency_id,
          i.warehouse_id,
          i.sales_order_id,
          i.remarks
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length) throw httpError(404, "NOT_FOUND", "Invoice not found");
      const details = await query(
        `
        SELECT
          d.id,
          d.item_id,
          d.quantity,
          d.unit_price,
          d.discount_percent,
          d.total_amount,
          d.net_amount,
          d.uom,
          it.item_code,
          it.item_name
        FROM sal_invoice_details d
        LEFT JOIN inv_items it
          ON it.id = d.item_id AND it.company_id = :companyId
        WHERE d.invoice_id = :id
        ORDER BY d.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const rows = await query(
        `
        SELECT invoice_no
        FROM sal_invoices
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND invoice_no REGEXP '^INV-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].invoice_no || "");
        const numPart = prev.replace(/^INV-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `INV${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoices",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  async (req, res, next) => {
    await ensureInvoiceTables();
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const {
        invoice_no,
        invoice_date,
        customer_id,
        warehouse_id,
        price_type,
        payment_type,
        currency_id,
        exchange_rate,
        sales_order_id,
        remarks,
        lines,
      } = body;
      const details = Array.isArray(lines)
        ? lines
        : Array.isArray(body.items)
          ? body.items
          : [];

      if (!customer_id) {
        throw httpError(400, "VALIDATION_ERROR", "customer_id is required");
      }
      if (!Array.isArray(details) || details.length === 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "At least one item is required",
        );
      }

      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      for (const l of details) {
        const qty = Number(l.qty || l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        const gross = qty * price;
        const discount = (gross * discPct) / 100;
        const net = gross - discount;
        const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
        subTotal += net;
        taxTotal += taxAmt;
        grandTotal += net + taxAmt;
      }

      await conn.beginTransaction();
      let finalInvoiceNo = String(invoice_no || "").trim();
      if (!finalInvoiceNo) {
        finalInvoiceNo = await nextInvoiceNoTx(conn, { companyId, branchId });
      } else {
        const [dupRows] = await conn.execute(
          `
          SELECT id
          FROM sal_invoices
          WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :invoiceNo
          LIMIT 1
          `,
          { companyId, branchId, invoiceNo: finalInvoiceNo },
        );
        if (dupRows?.length) {
          finalInvoiceNo = await nextInvoiceNoTx(conn, { companyId, branchId });
        }
      }
      const [ins] = await conn.execute(
        `INSERT INTO sal_invoices
          (company_id, branch_id, invoice_no, invoice_date, customer_id, payment_status, status, total_amount, net_amount, balance_amount, price_type, payment_type, currency_id, exchange_rate, warehouse_id, sales_order_id, remarks, created_by)
         VALUES
          (:companyId, :branchId, :invoiceNo, :invoiceDate, :customerId, 'UNPAID', 'DRAFT', :totalAmount, :netAmount, :balanceAmount, :priceType, :paymentType, :currencyId, :exchangeRate, :warehouseId, :salesOrderId, :remarks, :createdBy)`,
        {
          companyId,
          branchId,
          invoiceNo: finalInvoiceNo,
          invoiceDate: invoice_date || null,
          customerId: Number(customer_id),
          totalAmount: grandTotal,
          netAmount: grandTotal,
          balanceAmount: grandTotal,
          priceType: price_type || null,
          paymentType: payment_type || null,
          currencyId: currency_id || null,
          exchangeRate: exchange_rate || null,
          warehouseId: warehouse_id || null,
          salesOrderId: sales_order_id || null,
          remarks: remarks || null,
          createdBy: req.user?.sub || null,
        },
      );
      const invoiceId = ins.insertId;

      let lineNo = 1;
      for (const l of details) {
        await conn.execute(
          `INSERT INTO sal_invoice_details
             (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, uom, remarks)
           VALUES
             (:invoiceId, :itemId, :quantity, :unitPrice, :discountPercent, :totalAmount, :netAmount, :uom, :remarks)`,
          {
            invoiceId,
            itemId: Number(l.item_id),
            quantity: Number(l.qty || l.quantity || 0),
            unitPrice: Number(l.unit_price || 0),
            discountPercent: Number(l.discount_percent || 0),
            totalAmount: Number(l.total || l.total_amount || 0),
            netAmount: Number(l.net || l.net_amount || 0),
            uom: l.uom || null,
            remarks: l.remarks || null,
          },
        );
        lineNo++;
      }

      await conn.commit();
      res.status(201).json({ id: invoiceId });
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
  "/invoices/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    await ensureInvoiceTables();
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      const body = req.body || {};
      const {
        invoice_no,
        invoice_date,
        customer_id,
        warehouse_id,
        price_type,
        payment_type,
        currency_id,
        exchange_rate,
        sales_order_id,
        remarks,
        lines,
      } = body;
      const details = Array.isArray(lines)
        ? lines
        : Array.isArray(body.items)
          ? body.items
          : [];

      const existing = await query(
        "SELECT id FROM sal_invoices WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
        { id, companyId, branchId },
      );
      if (!existing.length)
        throw httpError(404, "NOT_FOUND", "Invoice not found");

      if (!Array.isArray(details) || details.length === 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "At least one item is required",
        );
      }

      let subTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      for (const l of details) {
        const qty = Number(l.qty || l.quantity || 0);
        const price = Number(l.unit_price || 0);
        const discPct = Number(l.discount_percent || 0);
        const gross = qty * price;
        const discount = (gross * discPct) / 100;
        const net = gross - discount;
        const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
        subTotal += net;
        taxTotal += taxAmt;
        grandTotal += net + taxAmt;
      }

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE sal_invoices
           SET invoice_no = :invoiceNo,
               invoice_date = :invoiceDate,
               customer_id = :customerId,
               total_amount = :totalAmount,
               net_amount = :netAmount,
               balance_amount = :balanceAmount,
               price_type = :priceType,
               payment_type = :paymentType,
               currency_id = :currencyId,
               exchange_rate = :exchangeRate,
               warehouse_id = :warehouseId,
               sales_order_id = :salesOrderId,
               remarks = :remarks
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          invoiceNo: String(invoice_no || ""),
          invoiceDate: invoice_date || null,
          customerId: Number(customer_id),
          totalAmount: grandTotal,
          netAmount: grandTotal,
          balanceAmount: grandTotal,
          priceType: price_type || null,
          paymentType: payment_type || null,
          currencyId: currency_id || null,
          exchangeRate: exchange_rate || null,
          warehouseId: warehouse_id || null,
          salesOrderId: sales_order_id || null,
          remarks: remarks || null,
        },
      );

      await conn.execute(
        "DELETE FROM sal_invoice_details WHERE invoice_id = :id",
        { id },
      );
      for (const l of details) {
        await conn.execute(
          `INSERT INTO sal_invoice_details
             (invoice_id, item_id, quantity, unit_price, discount_percent, total_amount, net_amount, uom, remarks)
           VALUES
             (:invoiceId, :itemId, :quantity, :unitPrice, :discountPercent, :totalAmount, :netAmount, :uom, :remarks)`,
          {
            invoiceId: id,
            itemId: Number(l.item_id),
            quantity: Number(l.qty || l.quantity || 0),
            unitPrice: Number(l.unit_price || 0),
            discountPercent: Number(l.discount_percent || 0),
            totalAmount: Number(l.total || l.total_amount || 0),
            netAmount: Number(l.net || l.net_amount || 0),
            uom: l.uom || null,
            remarks: l.remarks || null,
          },
        );
      }
      await conn.commit();
      res.json({ id });
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
  "/invoices/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.INVOICE.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      const items = await query(
        "SELECT id, net_amount, balance_amount, status FROM sal_invoices WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
        { id, companyId, branchId },
      );
      if (!items.length) throw httpError(404, "NOT_FOUND", "Invoice not found");
      const lines = await query(
        "SELECT id FROM sal_invoice_details WHERE invoice_id = :id LIMIT 1",
        { id },
      );
      if (!lines.length)
        throw httpError(400, "VALIDATION_ERROR", "No line items");
      const bal = Number(items[0].balance_amount || items[0].net_amount || 0);
      const paymentStatus =
        bal <= 0 ? "PAID" : bal > 0 ? "UNPAID" : "PARTIALLY_PAID";
      await query(
        `UPDATE sal_invoices
           SET status = 'SUBMITTED',
               payment_status = :paymentStatus,
               balance_amount = :balance
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId, paymentStatus, balance: bal },
      );
      res.json({ id, status: "SUBMITTED", payment_status: paymentStatus });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.sales_order_id,
          d.invoice_id,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status
        FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        WHERE d.company_id = :companyId AND d.branch_id = :branchId
        ORDER BY d.delivery_date DESC, d.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const rows = await query(
        `
        SELECT delivery_no
        FROM sal_deliveries
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND delivery_no REGEXP '^DN-?[0-9]{6}$'
        ORDER BY CAST(REPLACE(delivery_no, 'DN-', '') AS UNSIGNED) DESC
        LIMIT 1
        `,
        { companyId, branchId },
      ).catch(() => []);
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].delivery_no || "");
        const numPart = prev.replace(/^DN-?/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `DN${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/deliveries/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_no,
          d.delivery_date,
          d.invoice_id,
          d.customer_id,
          COALESCE(c.customer_name, '') AS customer_name,
          d.status,
          d.sales_order_id,
          d.remarks
        FROM sal_deliveries d
        LEFT JOIN sal_customers c
          ON c.id = d.customer_id AND c.company_id = d.company_id
        WHERE d.id = :id AND d.company_id = :companyId AND d.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!items.length)
        throw httpError(404, "NOT_FOUND", "Delivery not found");
      const details = await query(
        `
        SELECT
          dd.id,
          dd.item_id,
          dd.quantity,
          dd.unit_price,
          dd.uom,
          it.item_code,
          it.item_name
        FROM sal_delivery_details dd
        LEFT JOIN inv_items it
          ON it.id = dd.item_id AND it.company_id = :companyId
        WHERE dd.delivery_id = :id
        ORDER BY dd.id ASC
        `,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: items[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/deliveries/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const status = String(req.body?.status || "")
        .trim()
        .toUpperCase();
      const allowed = new Set(["DRAFT", "DELIVERED", "CANCELLED"]);
      if (!allowed.has(status))
        throw httpError(400, "VALIDATION_ERROR", "Invalid status");
      const [existing] = await query(
        `
        SELECT id FROM sal_deliveries
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Delivery not found");
      await query(
        `
        UPDATE sal_deliveries
           SET status = :status
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId, status },
      );
      res.json({ id, status });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/prices/standard",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        `SELECT 
           i.id AS product_id,
           i.selling_price
         FROM inv_items i
         WHERE i.company_id = :companyId
         ORDER BY i.id ASC`,
        { companyId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/prices/best-price",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureStandardPriceSyncTriggers();
      const { companyId, branchId } = req.scope;
      const productId = Number(req.body?.product_id);
      const priceTypeInput = req.body?.price_type;
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: "Invalid product_id" });
      }
      let priceTypeId = null;
      if (priceTypeInput != null) {
        const asNum = Number(priceTypeInput);
        if (Number.isFinite(asNum) && asNum > 0) {
          priceTypeId = asNum;
        } else {
          const name = String(priceTypeInput || "").trim();
          if (name) {
            const [pt] = await query(
              `
              SELECT id
              FROM sal_price_types
              WHERE company_id = :companyId AND UPPER(name) = UPPER(:name)
              LIMIT 1
              `,
              { companyId, name },
            ).catch(() => []);
            if (pt?.id) priceTypeId = Number(pt.id);
          }
        }
      }
      let priceRow = null;
      if (priceTypeId != null) {
        const [row] = await query(
          `
          SELECT selling_price
          FROM sal_standard_prices
          WHERE company_id = :companyId
            AND (branch_id = :branchId OR branch_id IS NULL)
            AND product_id = :productId
            AND price_type_id = :priceTypeId
          ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC
          LIMIT 1
          `,
          { companyId, branchId, productId, priceTypeId },
        ).catch(() => []);
        priceRow = row || null;
      } else {
        const [row] = await query(
          `
          SELECT selling_price
          FROM sal_standard_prices
          WHERE company_id = :companyId
            AND (branch_id = :branchId OR branch_id IS NULL)
            AND product_id = :productId
          ORDER BY (branch_id IS NULL) ASC, COALESCE(effective_date, DATE('1900-01-01')) DESC, id DESC
          LIMIT 1
          `,
          { companyId, branchId, productId },
        ).catch(() => []);
        priceRow = row || null;
      }
      if (priceRow && priceRow.selling_price != null) {
        return res.json({ price: Number(priceRow.selling_price) });
      }
      const [fallback] = await query(
        `
        SELECT selling_price
        FROM inv_items
        WHERE company_id = :companyId AND id = :productId
        LIMIT 1
        `,
        { companyId, productId },
      ).catch(() => []);
      const price = Number(fallback?.selling_price ?? 0);
      return res.json({ price: Number.isFinite(price) ? price : 0 });
    } catch (e) {
      next(e);
    }
  },
);

// ===== DISCOUNT SCHEMES =====
// Minimal list endpoint to avoid 404 for client DiscountSchemeList
router.get(
  "/discount-schemes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        `
        SELECT 
          id,
          scheme_code,
          scheme_name,
          discount_type,
          discount_value,
          effective_from,
          effective_to,
          min_quantity,
          min_purchase_amount,
          max_discount_amount,
          description,
          is_active
        FROM sal_discount_schemes
        WHERE company_id = :companyId
        ORDER BY id DESC
        `,
        { companyId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT 
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          (SELECT COUNT(*) FROM sal_invoice_details d WHERE d.invoice_id = i.id) AS items_count,
          i.total_amount,
          i.status
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/delivery-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          d.id,
          d.delivery_date,
          d.delivery_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          dd.quantity AS qty
        FROM sal_deliveries d
        JOIN sal_delivery_details dd ON dd.delivery_id = d.id
        LEFT JOIN sal_customers c ON c.id = d.customer_id AND c.company_id = d.company_id
        LEFT JOIN inv_items it ON it.id = dd.item_id AND it.company_id = d.company_id
        WHERE d.company_id = :companyId
          AND d.branch_id = :branchId
          AND (:from IS NULL OR d.delivery_date >= :from)
          AND (:to IS NULL OR d.delivery_date <= :to)
        ORDER BY d.delivery_date DESC, d.id DESC, dd.id ASC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-return",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          r.id,
          r.return_date,
          r.return_no,
          COALESCE(c.customer_name, '') AS customer_name,
          it.item_code,
          it.item_name,
          rd.qty_returned AS qty,
          rd.total_amount AS amount
        FROM sal_returns r
        JOIN sal_return_details rd ON rd.return_id = r.id
        LEFT JOIN sal_customers c ON c.id = r.customer_id AND c.company_id = r.company_id
        LEFT JOIN inv_items it ON it.id = rd.item_id AND it.company_id = r.company_id
        WHERE r.company_id = :companyId
          AND r.branch_id = :branchId
          AND (:from IS NULL OR r.return_date >= :from)
          AND (:to IS NULL OR r.return_date <= :to)
        ORDER BY r.return_date DESC, r.id DESC, rd.id ASC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/debtors-balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("SAL.CUSTOMER.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const asOf = req.query.asOf ? String(req.query.asOf) : null;
      const items = await query(
        `
        SELECT
          c.id,
          c.customer_name,
          0 AS opening,
          COALESCE(SUM(i.net_amount), 0) AS invoiced,
          COALESCE(SUM(i.net_amount - i.balance_amount), 0) AS received,
          COALESCE(SUM(i.balance_amount), 0) AS outstanding
        FROM sal_customers c
        LEFT JOIN sal_invoices i
          ON i.customer_id = c.id
         AND i.company_id = c.company_id
         AND i.branch_id = :branchId
         AND (:asOf IS NULL OR i.invoice_date <= :asOf)
        WHERE c.company_id = :companyId
        GROUP BY c.id, c.customer_name
        HAVING outstanding <> 0 OR invoiced <> 0 OR received <> 0
        ORDER BY c.customer_name ASC
        `,
        { companyId, branchId, asOf },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-profitability",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT
          i.id,
          i.invoice_date,
          i.invoice_no,
          COALESCE(c.customer_name, '') AS customer_name,
          COALESCE(i.net_amount, i.total_amount, 0) AS net_sales,
          COALESCE((
            SELECT SUM(d.quantity * COALESCE(it.cost_price, 0))
            FROM sal_invoice_details d
            LEFT JOIN inv_items it
              ON it.id = d.item_id AND it.company_id = i.company_id
            WHERE d.invoice_id = i.id
          ), 0) AS cost
        FROM sal_invoices i
        LEFT JOIN sal_customers c
          ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
        ORDER BY i.invoice_date DESC, i.id DESC
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/sales-tracking",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items = await query(
        `
        SELECT * FROM (
          SELECT
            'QUOTATION' AS stage,
            q.quotation_no AS ref_no,
            COALESCE(NULLIF(q.customer_name, ''), c.customer_name, '') AS customer_name,
            q.quotation_date AS txn_date,
            q.status AS status,
            q.total_amount AS total_value
          FROM sal_quotations q
          LEFT JOIN sal_customers c
            ON c.id = q.customer_id AND c.company_id = q.company_id
          WHERE q.company_id = :companyId
            AND q.branch_id = :branchId
            AND (:from IS NULL OR q.quotation_date >= :from)
            AND (:to IS NULL OR q.quotation_date <= :to)
          UNION ALL
          SELECT
            'ORDER' AS stage,
            o.order_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            o.order_date AS txn_date,
            o.status AS status,
            o.total_amount AS total_value
          FROM sal_orders o
          LEFT JOIN sal_customers c
            ON c.id = o.customer_id AND c.company_id = o.company_id
          WHERE o.company_id = :companyId
            AND o.branch_id = :branchId
            AND (:from IS NULL OR o.order_date >= :from)
            AND (:to IS NULL OR o.order_date <= :to)
          UNION ALL
          SELECT
            'DELIVERY' AS stage,
            d.delivery_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            d.delivery_date AS txn_date,
            d.status AS status,
            COALESCE(o.total_amount, 0) AS total_value
          FROM sal_deliveries d
          LEFT JOIN sal_orders o
            ON o.id = d.sales_order_id AND o.company_id = d.company_id
          LEFT JOIN sal_customers c
            ON c.id = d.customer_id AND c.company_id = d.company_id
          WHERE d.company_id = :companyId
            AND d.branch_id = :branchId
            AND (:from IS NULL OR d.delivery_date >= :from)
            AND (:to IS NULL OR d.delivery_date <= :to)
          UNION ALL
          SELECT
            'INVOICE' AS stage,
            i.invoice_no AS ref_no,
            COALESCE(c.customer_name, '') AS customer_name,
            i.invoice_date AS txn_date,
            i.status AS status,
            COALESCE(i.net_amount, i.total_amount, 0) AS total_value
          FROM sal_invoices i
          LEFT JOIN sal_customers c
            ON c.id = i.customer_id AND c.company_id = i.company_id
          WHERE i.company_id = :companyId
            AND i.branch_id = :branchId
            AND (:from IS NULL OR i.invoice_date >= :from)
            AND (:to IS NULL OR i.invoice_date <= :to)
        ) t
        ORDER BY txn_date DESC
        LIMIT 2000
        `,
        { companyId, branchId, from, to },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId } = req.scope;
      const items = await query(
        `
        SELECT r.id, r.return_no, r.return_date, r.total_amount, r.status,
               COALESCE(c.customer_name, '') AS customer_name,
               r.invoice_id
        FROM sal_returns r
        LEFT JOIN sal_customers c
          ON c.id = r.customer_id AND c.company_id = r.company_id
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        ORDER BY r.id DESC
        `,
        { companyId, branchId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/returns/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    try {
      await ensureSalesReturnTables();
      const { companyId, branchId } = req.scope;
      const nextNo = await nextSalesReturnNo(companyId, branchId);
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requireAnyPermission(["SAL.INVOICE.VIEW", "SAL.ORDER.VIEW"]),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureSalesReturnTables();
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId } = req.scope;
      const body = req.body || {};
      const return_no =
        String(body.return_no || "").trim() ||
        (await nextSalesReturnNo(companyId, branchId));
      const return_date = body.return_date
        ? String(body.return_date).slice(0, 10)
        : toYmd(new Date());
      const invoice_id =
        body.invoice_id == null ? null : Number(body.invoice_id || 0) || null;
      const customer_id =
        body.customer_id == null ? null : Number(body.customer_id || 0) || null;
      const warehouse_id =
        body.warehouse_id == null
          ? null
          : Number(body.warehouse_id || 0) || null;
      const return_type = String(body.return_type || "DAMAGED")
        .trim()
        .toUpperCase();
      const remarks = body.remarks || null;
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      const items = Array.isArray(body.items) ? body.items : [];
      if (!return_date || !items.length) {
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
                 it.vat_on_sales_id AS tax_id,
                 COALESCE(tc.rate_percent, 0) AS rate_percent
          FROM inv_items it
          LEFT JOIN fin_tax_codes tc
            ON tc.company_id = it.company_id
           AND tc.id = it.vat_on_sales_id
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
        INSERT INTO sal_returns
          (company_id, branch_id, return_no, return_date, invoice_id, customer_id, warehouse_id, return_type, status, remarks, total_amount, tax_amount, sub_total, created_by)
        VALUES
          (:companyId, :branchId, :return_no, :return_date, :invoice_id, :customer_id, :warehouse_id, :return_type, :status, :remarks, :total_amount, :tax_amount, :sub_total, :created_by)
        `,
        {
          companyId,
          branchId,
          return_no,
          return_date,
          invoice_id,
          customer_id,
          warehouse_id,
          return_type,
          status,
          remarks,
          total_amount,
          tax_amount: tax_total,
          sub_total,
          created_by,
        },
      );
      const return_id = Number(hdr?.insertId || 0) || 0;
      for (const ln of normalized) {
        await conn.execute(
          `
          INSERT INTO sal_return_details
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
           ON DUPLICATE KEY UPDATE qty = qty + :qty`,
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
      const voucherTypeId = await ensureCreditNoteVoucherTypeIdTx(conn, {
        companyId,
      });
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = return_date || toYmd(new Date());
      const salesAccId =
        (await resolveFinAccountId(conn, { companyId, accountRef: "4000" })) ||
        (await resolveDefaultSalesAccountId(conn, { companyId }));
      const vatOutputAccId = await resolveFinAccountId(conn, {
        companyId,
        accountRef: "1310",
      });
      const receivablesAccId = await resolveFinAccountId(conn, {
        companyId,
        accountRef: "1100",
      });
      if (
        !salesAccId ||
        !receivablesAccId ||
        (tax_total > 0 && !vatOutputAccId)
      ) {
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
          narration: `Sales Return ${return_no} credit note`,
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
          accountId: salesAccId,
          description: `Sales return ${return_no}`,
          debit: Math.round(sub_total * 100) / 100,
          referenceNo: return_no,
        },
      );
      if (tax_total > 0 && vatOutputAccId) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: vatOutputAccId,
            description: `VAT reversal on ${return_no}`,
            debit: Math.round(tax_total * 100) / 100,
            referenceNo: return_no,
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
          accountId: receivablesAccId,
          description: `Credit note for ${return_no}`,
          credit: Math.round(total_amount * 100) / 100,
          referenceNo: return_no,
        },
      );
      await conn.commit();
      res.status(201).json({
        id: return_id,
        return_no,
        total_amount,
        voucher_id: voucherId,
        voucher_no: voucherNo,
      });
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

export default router;
