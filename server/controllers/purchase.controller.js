import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

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

async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  return Number(rows?.[0]?.id || 0) || 0;
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
function toYmd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
async function resolveServiceExpenseAccountIdAuto(conn, { companyId }) {
  const [preferRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
       AND (LOWER(a.name) LIKE '%service%' OR LOWER(a.name) LIKE '%professional%' OR LOWER(a.name) LIKE '%consult%')
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  const preferId = Number(preferRows?.[0]?.id || 0) || 0;
  if (preferId) return preferId;
  const [fallbackRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(fallbackRows?.[0]?.id || 0) || 0;
}
async function resolveApTradeAccountIdAuto(conn, { companyId, supplierId }) {
  if (supplierId) {
    const [supRows] = await conn.execute(
      "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: supplierId },
    );
    const sup = supRows?.[0] || null;
    if (sup) {
      const code =
        sup.supplier_code && String(sup.supplier_code).trim()
          ? String(sup.supplier_code).trim()
          : `SU-${String(Number(sup.id || 0)).padStart(6, "0")}`;
      const [accRows] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
      if (accIdExisting) return accIdExisting;
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
  return Number(apRows?.[0]?.id || 0) || 0;
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

export const listServiceConfirmations = async (req, res, next) => {
  try {
    await ensureServiceConfirmationTables();
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
};

export const getServiceConfirmationById = async (req, res, next) => {
  try {
    await ensureServiceConfirmationTables();
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
};

export const createServiceConfirmation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceConfirmationTables();
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
      if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
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
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

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

export const getNextSupplierCode = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const [supRows] = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(supplier_code, 4) AS UNSIGNED)) AS maxnum
       FROM pur_suppliers
       WHERE company_id = :companyId
         AND supplier_code REGEXP '^SU-[0-9]{6}$'`,
      { companyId },
    );
    const [accRows] = await pool.query(
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
};

export const listShippingAdvices = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { status, po_type } = req.query;
    let sql = `SELECT sa.*, s.supplier_name, p.po_no, p.po_type
         FROM pur_shipping_advices sa
         JOIN pur_suppliers s ON s.id = sa.supplier_id
         JOIN pur_orders p ON p.id = sa.po_id
         WHERE sa.company_id = :companyId AND sa.branch_id = :branchId`;
    if (status) sql += ` AND sa.status = :status`;
    if (po_type) sql += ` AND p.po_type = :po_type`;
    sql += ` ORDER BY sa.advice_date DESC, sa.id DESC`;
    const rows = await query(sql, { companyId, branchId, status, po_type });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getNextShippingAdviceNo = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const rows = await query(
      `SELECT MAX(CAST(SUBSTRING(advice_no, 4) AS UNSIGNED)) AS maxnum
       FROM pur_shipping_advices
       WHERE company_id = :companyId
         AND branch_id = :branchId
         AND advice_no REGEXP '^SA-[0-9]{6}$'`,
      { companyId, branchId },
    );
    const maxnum = Number(rows?.[0]?.maxnum || 0);
    const next = maxnum + 1;
    const nextNo = `SA-${String(next).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const getShippingAdviceById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `SELECT sa.*, s.supplier_name, p.po_no
       FROM pur_shipping_advices sa
       JOIN pur_suppliers s ON s.id = sa.supplier_id
       JOIN pur_orders p ON p.id = sa.po_id
       WHERE sa.id = :id AND sa.company_id = :companyId AND sa.branch_id = :branchId`,
      { id, companyId, branchId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Shipping Advice not found");
    const details = await query(
      `SELECT d.*, i.item_name, i.item_code 
       FROM pur_shipping_advice_details d 
       JOIN inv_items i ON i.id = d.item_id 
       WHERE d.advice_id = :id`,
      { id },
    );
    res.json({ item: { ...rows[0], details } });
  } catch (err) {
    next(err);
  }
};

export const createShippingAdvice = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId } = req.scope;
    const body = req.body || {};
    await ensureShippingAdviceStatusEnum();
    await ensureShippingAdviceETDColumn();
    const adviceNo = body.advice_no || nextDocNo("SA");
    const adviceDate = body.advice_date || new Date();
    const poId = toNumber(body.po_id);
    const supplierId = toNumber(body.supplier_id);
    if (!poId || !supplierId)
      throw httpError(400, "VALIDATION_ERROR", "PO and Supplier are required");
    const details = Array.isArray(body.details) ? body.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `INSERT INTO pur_shipping_advices 
       (company_id, branch_id, advice_no, advice_date, po_id, supplier_id, 
        bill_of_lading, vessel_name, container_no, etd_date, eta_date, status, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :adviceNo, :adviceDate, :poId, :supplierId,
        :bl, :vessel, :container, :etd, :eta, :status, :remarks, :createdBy)`,
      {
        companyId,
        branchId,
        adviceNo,
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
        createdBy: (req.user && (req.user.sub ?? req.user.id)) ?? null,
      },
    );
    const adviceId = hdr.insertId;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      const qty = Number(d.qty_shipped);
      if (!itemId || !qty) continue;
      await conn.execute(
        `INSERT INTO pur_shipping_advice_details (advice_id, item_id, qty_shipped, remarks)
         VALUES (:adviceId, :itemId, :qty, :remarks)`,
        { adviceId, itemId, qty, remarks: d.remarks },
      );
    }
    await conn.commit();
    res.status(201).json({ id: adviceId, advice_no: adviceNo });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

export const updateShippingAdvice = async (req, res, next) => {
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
      throw httpError(400, "VALIDATION_ERROR", "PO and Supplier are required");
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
};

export const listPortClearances = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { status } = req.query;
    let sql = `SELECT pc.*, sa.advice_no, p.po_no, s.supplier_name
         FROM pur_port_clearances pc
         LEFT JOIN pur_shipping_advices sa ON sa.id = pc.advice_id
         LEFT JOIN pur_orders p ON p.id = sa.po_id
         LEFT JOIN pur_suppliers s ON s.id = sa.supplier_id
         WHERE pc.company_id = :companyId AND pc.branch_id = :branchId`;
    if (status) sql += ` AND pc.status = :status`;
    sql += ` ORDER BY pc.clearance_date DESC, pc.id DESC`;
    const rows = await query(sql, { companyId, branchId, status });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getNextPortClearanceNo = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const rows = await query(
      `SELECT MAX(CAST(SUBSTRING(clearance_no, 4) AS UNSIGNED)) AS maxnum
       FROM pur_port_clearances
       WHERE company_id = :companyId
         AND branch_id = :branchId
         AND clearance_no REGEXP '^CC-[0-9]{6}$'`,
      { companyId, branchId },
    );
    const maxnum = Number(rows?.[0]?.maxnum || 0);
    const next = maxnum + 1;
    const nextNo = `CC-${String(next).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const getPortClearanceById = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `SELECT pc.*, sa.advice_no
       FROM pur_port_clearances pc
       LEFT JOIN pur_shipping_advices sa ON sa.id = pc.advice_id
       WHERE pc.id = :id AND pc.company_id = :companyId AND pc.branch_id = :branchId`,
      { id, companyId, branchId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Port Clearance not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createPortClearance = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId } = req.scope;
    const body = req.body || {};
    await ensurePortClearanceStatusEnum();
    let clearanceNo = body.clearance_no || null;
    const cd1 = body.clearance_date;
    const clearanceDate = cd1
      ? typeof cd1 === "string"
        ? cd1.split("T")[0]
        : new Date(cd1).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const adviceId = toNumber(body.advice_id ?? body.shipping_advice_id);
    if (!clearanceNo) {
      const [rows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING(clearance_no, 4) AS UNSIGNED)) AS maxnum
         FROM pur_port_clearances
         WHERE company_id = ? AND branch_id = ?
           AND clearance_no REGEXP '^CC-[0-9]{6}$'`,
        [companyId, branchId],
      );
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      clearanceNo = `CC-${String(next).padStart(6, "0")}`;
    }
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `INSERT INTO pur_port_clearances 
       (company_id, branch_id, clearance_no, clearance_date, advice_id, 
        customs_entry_no, clearing_agent, duty_amount, other_charges, status, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :clearanceNo, :clearanceDate, :adviceId,
        :customsEntry, :agent, :duty, :other, :status, :remarks, :createdBy)`,
      {
        companyId,
        branchId,
        clearanceNo,
        clearanceDate,
        adviceId: adviceId || null,
        customsEntry:
          body.customs_entry_no ?? body.customs_declaration_number ?? null,
        agent: body.clearing_agent ?? null,
        duty: Number(body.duty_amount) || 0,
        other: Number(body.other_charges) || 0,
        status: body.status || "PENDING",
        remarks: body.remarks ?? null,
        createdBy: (req.user && (req.user.sub ?? req.user.id)) ?? null,
      },
    );
    const clearanceId = hdr.insertId;
    await conn.commit();
    res.status(201).json({ id: clearanceId, clearance_no: clearanceNo });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

export const updatePortClearance = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    await ensurePortClearanceStatusEnum();
    await ensureShippingAdviceStatusEnum();
    const adviceId = toNumber(body.advice_id ?? body.shipping_advice_id);
    const [exists] = await conn.execute(
      `SELECT id FROM pur_port_clearances 
       WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id, companyId, branchId },
    );
    if (!Array.isArray(exists) || !exists.length) {
      throw httpError(404, "NOT_FOUND", "Port Clearance not found");
    }
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE pur_port_clearances SET
         clearance_date = :clearanceDate,
         advice_id = :adviceId,
         customs_entry_no = :customsEntry,
         clearing_agent = :agent,
         duty_amount = :duty,
         other_charges = :other,
         status = :status,
         remarks = :remarks
       WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      {
        id,
        companyId,
        branchId,
        clearanceDate: (() => {
          const cd2 = body.clearance_date;
          return cd2
            ? typeof cd2 === "string"
              ? cd2.split("T")[0]
              : new Date(cd2).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        })(),
        adviceId: adviceId || null,
        customsEntry:
          body.customs_entry_no ?? body.customs_declaration_number ?? null,
        agent: body.clearing_agent ?? null,
        duty: Number(body.duty_amount) || 0,
        other: Number(body.other_charges) || 0,
        status: body.status || "PENDING",
        remarks: body.remarks ?? null,
      },
    );
    if (String(body.status).toUpperCase() === "CLEARED" && adviceId) {
      await conn.execute(
        `UPDATE pur_shipping_advices 
           SET status = 'CLEARED' 
         WHERE id = :adviceId AND company_id = :companyId AND branch_id = :branchId`,
        { adviceId, companyId, branchId },
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
};
export const updateServiceConfirmation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceConfirmationTables();
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
      if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
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
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

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
      supplier_id BIGINT UNSIGNED NULL,
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
  if (!(await hasColumn("pur_service_bills", "amount_paid"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN amount_paid DECIMAL(18,2) DEFAULT 0 AFTER total_amount",
    );
  }
  if (!(await hasColumn("pur_service_bills", "supplier_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN supplier_id BIGINT UNSIGNED NULL AFTER branch_id",
    );
  }
  try {
    await pool.query(
      `
      UPDATE pur_service_bills sb
      JOIN pur_suppliers s
        ON s.company_id = sb.company_id
       AND s.branch_id = sb.branch_id
       AND s.supplier_name = sb.client_name
      SET sb.supplier_id = s.id
      WHERE sb.supplier_id IS NULL AND sb.client_name IS NOT NULL
      `,
    );
  } catch {}
  const rows = await query(
    `SELECT column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'pur_service_bills'
       AND column_name = 'status'`,
  );
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasCompleted = colType.includes("'COMPLETED'");
  if (!hasCompleted) {
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

async function ensureProspectCustomersTable() {
  await pool.query(`
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
  `);
}

export const listServiceRequests = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const { companyId, branchId } = req.scope;
    const rows = await query(
      `
      SELECT id, request_no, request_date, requester_full_name, service_type, priority, status
      FROM pur_service_requests
      WHERE company_id = :companyId AND branch_id = :branchId
      ORDER BY request_date DESC, id DESC
      `,
      { companyId, branchId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getServiceRequestById = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT *
      FROM pur_service_requests
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Service request not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const getNextServiceRequestNo = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const nextNo = await nextSequentialNo(
      "pur_service_requests",
      "request_no",
      "SR",
    );
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const createServiceRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceRequestTables();
    await ensureProspectCustomersTable();
    const { companyId, branchId } = req.scope;
    const body = req.body || {};
    const requestNo =
      body.request_no ||
      (await nextSequentialNo("pur_service_requests", "request_no", "SR"));
    const requestDate =
      body.request_date || new Date().toISOString().slice(0, 10);
    const fullName = String(body.full_name || body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const company = body.company || null;
    const address = body.address || null;
    const serviceType = String(
      body.service_type || body.serviceType || "",
    ).trim();
    const department = body.department || null;
    const requestTitle = String(
      body.request_title || body.requestTitle || "",
    ).trim();
    const description = String(body.description || "").trim();
    const priority = ["low", "medium", "high"].includes(
      String(body.priority || "").toLowerCase(),
    )
      ? String(body.priority).toLowerCase()
      : "low";
    const preferredDate = body.preferred_date || body.preferredDate || null;
    const preferredTime = body.preferred_time || body.preferredTime || null;
    const contactMethod = ["email", "phone", "sms"].includes(
      String(body.contact_method || body.contactMethod || "").toLowerCase(),
    )
      ? String(body.contact_method || body.contactMethod).toLowerCase()
      : "email";
    const recurring = ["yes", "no"].includes(
      String(body.recurring || "").toLowerCase(),
    )
      ? String(body.recurring).toLowerCase()
      : "no";
    const additionalNotes =
      body.additional_notes || body.additionalNotes || null;
    const agreedTerms = Boolean(body.terms || body.agreed_terms);
    const attachmentsJson =
      body.attachments_json ||
      (Array.isArray(body.attachments)
        ? JSON.stringify(body.attachments)
        : null);
    const createdBy = req.user?.sub ? Number(req.user.sub) : null;

    if (
      !fullName ||
      !email ||
      !phone ||
      !serviceType ||
      !requestTitle ||
      !description
    ) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const [hdr] = await conn.execute(
      `
      INSERT INTO pur_service_requests (
        company_id, branch_id, request_no, request_date,
        requester_full_name, requester_email, requester_phone,
        requester_company, requester_address,
        service_type, department, request_title, description,
        priority, preferred_date, preferred_time,
        contact_method, recurring, additional_notes,
        agreed_terms, attachments_json, status, created_by
      ) VALUES (
        :companyId, :branchId, :requestNo, :requestDate,
        :fullName, :email, :phone,
        :company, :address,
        :serviceType, :department, :requestTitle, :description,
        :priority, :preferredDate, :preferredTime,
        :contactMethod, :recurring, :additionalNotes,
        :agreedTerms, :attachmentsJson, 'PENDING', :createdBy
      )
      `,
      {
        companyId,
        branchId,
        requestNo,
        requestDate,
        fullName,
        email,
        phone,
        company,
        address,
        serviceType,
        department,
        requestTitle,
        description,
        priority,
        preferredDate,
        preferredTime,
        contactMethod,
        recurring,
        additionalNotes,
        agreedTerms,
        attachmentsJson,
        createdBy,
      },
    );
    const prospect = body.prospect || {};
    const pName = String(prospect.prospect_customer || "").trim();
    if (pName) {
      await conn.execute(
        `
        INSERT INTO sal_prospect_customers (
          company_id, prospect_customer, address, city, state, country, telephone, email
        ) VALUES (
          :companyId, :prospect_customer, :address, :city, :state, :country, :telephone, :email
        )
        ON DUPLICATE KEY UPDATE
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          country = VALUES(country),
          telephone = VALUES(telephone),
          email = VALUES(email)
        `,
        {
          companyId,
          prospect_customer: pName,
          address: prospect.address || null,
          city: prospect.city || null,
          state: prospect.state || null,
          country: prospect.country || null,
          telephone: prospect.telephone || null,
          email: prospect.email || null,
        },
      );
    }
    res.status(201).json({ id: hdr.insertId, request_no: requestNo });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
};

export const updateServiceRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceRequestTables();
    await ensureProspectCustomersTable();
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const fullName = String(body.full_name || body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const company = body.company || null;
    const address = body.address || null;
    const serviceType = String(
      body.service_type || body.serviceType || "",
    ).trim();
    const department = body.department || null;
    const requestTitle = String(
      body.request_title || body.requestTitle || "",
    ).trim();
    const description = String(body.description || "").trim();
    const priority = ["low", "medium", "high"].includes(
      String(body.priority || "").toLowerCase(),
    )
      ? String(body.priority).toLowerCase()
      : "low";
    const preferredDate = body.preferred_date || body.preferredDate || null;
    const preferredTime = body.preferred_time || body.preferredTime || null;
    const contactMethod = ["email", "phone", "sms"].includes(
      String(body.contact_method || body.contactMethod || "").toLowerCase(),
    )
      ? String(body.contact_method || body.contactMethod).toLowerCase()
      : "email";
    const recurring = ["yes", "no"].includes(
      String(body.recurring || "").toLowerCase(),
    )
      ? String(body.recurring).toLowerCase()
      : "no";
    const additionalNotes =
      body.additional_notes || body.additionalNotes || null;
    const agreedTerms = Boolean(body.terms || body.agreed_terms);
    const attachmentsJson =
      body.attachments_json ||
      (Array.isArray(body.attachments)
        ? JSON.stringify(body.attachments)
        : null);

    if (
      !fullName ||
      !email ||
      !phone ||
      !serviceType ||
      !requestTitle ||
      !description
    ) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const [exists] = await conn.execute(
      `
      SELECT id FROM pur_service_requests
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    );
    if (!exists.length)
      throw httpError(404, "NOT_FOUND", "Service request not found");

    await conn.execute(
      `
      UPDATE pur_service_requests SET
        requester_full_name = :fullName,
        requester_email = :email,
        requester_phone = :phone,
        requester_company = :company,
        requester_address = :address,
        service_type = :serviceType,
        department = :department,
        request_title = :requestTitle,
        description = :description,
        priority = :priority,
        preferred_date = :preferredDate,
        preferred_time = :preferredTime,
        contact_method = :contactMethod,
        recurring = :recurring,
        additional_notes = :additionalNotes,
        agreed_terms = :agreedTerms,
        attachments_json = :attachmentsJson
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      `,
      {
        id,
        companyId,
        branchId,
        fullName,
        email,
        phone,
        company,
        address,
        serviceType,
        department,
        requestTitle,
        description,
        priority,
        preferredDate,
        preferredTime,
        contactMethod,
        recurring,
        additionalNotes,
        agreedTerms,
        attachmentsJson,
      },
    );

    const prospect = body.prospect || {};
    const pName = String(prospect.prospect_customer || "").trim();
    if (pName) {
      await conn.execute(
        `
        INSERT INTO sal_prospect_customers (
          company_id, prospect_customer, address, city, state, country, telephone, email
        ) VALUES (
          :companyId, :prospect_customer, :address, :city, :state, :country, :telephone, :email
        )
        ON DUPLICATE KEY UPDATE
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          country = VALUES(country),
          telephone = VALUES(telephone),
          email = VALUES(email)
        `,
        {
          companyId,
          prospect_customer: pName,
          address: prospect.address || null,
          city: prospect.city || null,
          state: prospect.state || null,
          country: prospect.country || null,
          telephone: prospect.telephone || null,
          email: prospect.email || null,
        },
      );
    }
    res.json({ id });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
};
export const listServiceBills = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const { companyId, branchId } = req.scope;
    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const clientName = String(req.query.clientName || "").trim();
    const payment = String(req.query.payment || "")
      .trim()
      .toUpperCase();
    const supplierId = toNumber(req.query.supplierId);
    let sql = `
      SELECT id, bill_no, bill_date, status, payment, total_amount, amount_paid, client_name
      FROM pur_service_bills
      WHERE company_id = :companyId AND branch_id = :branchId
    `;
    const params = { companyId, branchId };
    if (status) {
      sql += " AND status = :status";
      params.status = status;
    }
    if (clientName) {
      sql += " AND client_name = :clientName";
      params.clientName = clientName;
    }
    if (payment) {
      sql += " AND payment = :payment";
      params.payment = payment;
    }
    if (supplierId) {
      sql += " AND supplier_id = :supplierId";
      params.supplierId = supplierId;
    }
    sql += " ORDER BY bill_date DESC, id DESC";
    const rows = await query(sql, params);
    const idsToComplete = rows
      .filter(
        (r) =>
          String(r.payment || "").toUpperCase() === "PAID" &&
          String(r.status || "").toUpperCase() === "PENDING",
      )
      .map((r) => Number(r.id));
    if (idsToComplete.length) {
      const placeholders = idsToComplete.map(() => "?").join(",");
      await pool.query(
        `UPDATE pur_service_bills SET status = 'COMPLETED' WHERE id IN (${placeholders})`,
        idsToComplete,
      );
      for (const r of rows) {
        if (
          String(r.payment || "").toUpperCase() === "PAID" &&
          String(r.status || "").toUpperCase() === "PENDING"
        ) {
          r.status = "COMPLETED";
        }
      }
    }
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getServiceBillById = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT *
      FROM pur_service_bills
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Service bill not found");
    const row = rows[0];
    const isPaid = String(row.payment || "").toUpperCase() === "PAID";
    const isPending = String(row.status || "").toUpperCase() === "PENDING";
    if (isPaid && isPending) {
      await pool.query(
        "UPDATE pur_service_bills SET status = 'COMPLETED' WHERE id = ?",
        [id],
      );
      row.status = "COMPLETED";
    }
    const details = await query(
      `
      SELECT id, description, category, qty, rate, amount
      FROM pur_service_bill_details
      WHERE bill_id = :id
      ORDER BY id ASC
      `,
      { id },
    );
    res.json({ item: row, details });
  } catch (err) {
    next(err);
  }
};

export const getNextServiceBillNo = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const nextNo = await nextSequentialNo("pur_service_bills", "bill_no", "SB");
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const createServiceBill = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceBillTables();
    const { companyId, branchId } = req.scope;
    const body = req.body || {};
    const supplierId = body.supplier_id || body.supplierId || null;
    const billNo =
      body.bill_no ||
      (await nextSequentialNo("pur_service_bills", "bill_no", "SB"));
    const billDate = body.bill_date || new Date().toISOString().slice(0, 10);
    const dueDate = body.due_date || null;
    const serviceDate = body.service_date || null;
    const status = String(body.status || "PENDING").toUpperCase();
    const sStatus = ["PENDING", "PAID", "OVERDUE", "COMPLETED"].includes(status)
      ? status
      : "PENDING";
    const clientName = body.client_name || body.clientName || null;
    const clientCompany = body.client_company || body.clientCompany || null;
    const clientAddress = body.client_address || body.clientAddress || null;
    const clientPhone = body.client_phone || body.clientPhone || null;
    const clientEmail = body.client_email || body.clientEmail || null;
    const paymentMethod = body.payment_method || body.paymentMethod || null;
    const paymentReference =
      body.payment_reference || body.paymentReference || null;
    const paymentTerms = body.payment_terms || body.paymentTerms || null;
    const notes = body.notes || null;
    const discountPercent = Number(
      body.discount_percent ?? body.discountPercent ?? 0,
    );
    const taxPercent = Number(body.tax_percent ?? body.taxPercent ?? 0);
    const rows = Array.isArray(body.details)
      ? body.details
      : Array.isArray(body.rows)
        ? body.rows
        : [];

    let subtotal = 0;
    const normalized = [];
    for (const r of rows) {
      const desc = String(r.description ?? r.desc ?? "").trim();
      const category = r.category ?? null;
      const qty = Number(r.qty ?? 0);
      const rate = Number(r.rate ?? 0);
      if (!desc || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      const amount = Number.isFinite(Number(r.amount))
        ? Number(r.amount)
        : qty * rate;
      subtotal += amount;
      normalized.push({ desc, category, qty, rate, amount });
    }
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    const totalAmount = afterDiscount + taxAmount;

    const createdBy = req.user?.sub ? Number(req.user.sub) : null;
    const paymentInput = String(body.payment || "")
      .trim()
      .toUpperCase();
    const payment =
      paymentInput === "PAID"
        ? "PAID"
        : paymentInput === "UNPAID"
          ? "UNPAID"
          : sStatus === "PAID"
            ? "PAID"
            : "UNPAID";

    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `
      INSERT INTO pur_service_bills (
        company_id, branch_id, supplier_id, bill_no, bill_date, due_date, service_date, status, payment,
        client_name, client_company, client_address, client_phone, client_email,
        payment_method, payment_reference, payment_terms, notes,
        discount_percent, tax_percent, subtotal, discount_amount, tax_amount, total_amount,
        created_by
      ) VALUES (
        :companyId, :branchId, :supplierId, :billNo, :billDate, :dueDate, :serviceDate, :status, :payment,
        :clientName, :clientCompany, :clientAddress, :clientPhone, :clientEmail,
        :paymentMethod, :paymentReference, :paymentTerms, :notes,
        :discountPercent, :taxPercent, :subtotal, :discountAmount, :taxAmount, :totalAmount,
        :createdBy
      )
      `,
      {
        companyId,
        branchId,
        supplierId,
        billNo,
        billDate,
        dueDate,
        serviceDate,
        status: sStatus,
        payment,
        clientName,
        clientCompany,
        clientAddress,
        clientPhone,
        clientEmail,
        paymentMethod,
        paymentReference,
        paymentTerms,
        notes,
        discountPercent,
        taxPercent,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        createdBy,
      },
    );
    const billId = hdr.insertId;
    for (const r of normalized) {
      await conn.execute(
        `
        INSERT INTO pur_service_bill_details (
          bill_id, description, category, qty, rate, amount
        ) VALUES (
          :billId, :description, :category, :qty, :rate, :amount
        )
        `,
        {
          billId,
          description: r.desc,
          category: r.category,
          qty: r.qty,
          rate: r.rate,
          amount: r.amount,
        },
      );
    }
    const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
    const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, {
      companyId,
    });
    const voucherNo = await nextVoucherNoTx(conn, {
      companyId,
      voucherTypeId,
    });
    const voucherDate = billDate || toYmd(new Date());
    const serviceExpenseAccId = await resolveServiceExpenseAccountIdAuto(conn, {
      companyId,
    });
    const vatInputAccId =
      taxAmount > 0
        ? await resolveVatInputAccountIdAuto(conn, { companyId })
        : 0;
    const apAccId = await resolveApTradeAccountIdAuto(conn, {
      companyId,
      supplierId: toNumber(supplierId),
    });
    if (!serviceExpenseAccId || !apAccId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Expense or AP account not configured",
      );
    }
    const totalDebit =
      Math.round(afterDiscount * 100) / 100 +
      (taxAmount > 0 ? Math.round(taxAmount * 100) / 100 : 0);
    const totalCredit = Math.round(totalAmount * 100) / 100;
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
        narration: `Service Bill ${billNo} posting`,
        totalDebit,
        totalCredit,
        createdBy,
        approvedBy: createdBy,
        postedBy: createdBy,
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
        accountId: serviceExpenseAccId,
        description: `Service expense on ${billNo}`,
        debit: Math.round(afterDiscount * 100) / 100,
        referenceNo: billNo,
      },
    );
    if (taxAmount > 0 && vatInputAccId) {
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: vatInputAccId,
          description: `VAT input on ${billNo}`,
          debit: Math.round(taxAmount * 100) / 100,
          referenceNo: billNo,
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
        accountId: apAccId,
        description: `AP for ${billNo}`,
        credit: Math.round(totalAmount * 100) / 100,
        referenceNo: billNo,
      },
    );
    await conn.commit();
    res.status(201).json({
      id: billId,
      bill_no: billNo,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

export const updateServiceBill = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceBillTables();
    const { companyId, branchId } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const supplierId = body.supplier_id || body.supplierId || null;
    const billNo = body.bill_no || null;
    const billDate = body.bill_date || null;
    const dueDate = body.due_date || null;
    const serviceDate = body.service_date || null;
    const status = String(body.status || "PENDING").toUpperCase();
    const sStatus = ["PENDING", "PAID", "OVERDUE", "COMPLETED"].includes(status)
      ? status
      : "PENDING";
    const clientName = body.client_name || body.clientName || null;
    const clientCompany = body.client_company || body.clientCompany || null;
    const clientAddress = body.client_address || body.clientAddress || null;
    const clientPhone = body.client_phone || body.clientPhone || null;
    const clientEmail = body.client_email || body.clientEmail || null;
    const paymentMethod = body.payment_method || body.paymentMethod || null;
    const paymentReference =
      body.payment_reference || body.paymentReference || null;
    const paymentTerms = body.payment_terms || body.paymentTerms || null;
    const notes = body.notes || null;
    const discountPercent = Number(
      body.discount_percent ?? body.discountPercent ?? 0,
    );
    const taxPercent = Number(body.tax_percent ?? body.taxPercent ?? 0);
    const rows = Array.isArray(body.details)
      ? body.details
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    let subtotal = 0;
    const normalized = [];
    for (const r of rows) {
      const desc = String(r.description ?? r.desc ?? "").trim();
      const category = r.category ?? null;
      const qty = Number(r.qty ?? 0);
      const rate = Number(r.rate ?? 0);
      if (!desc || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      const amount = Number.isFinite(Number(r.amount))
        ? Number(r.amount)
        : qty * rate;
      subtotal += amount;
      normalized.push({ desc, category, qty, rate, amount });
    }
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    const totalAmount = afterDiscount + taxAmount;
    const paymentInput = String(body.payment || "")
      .trim()
      .toUpperCase();
    const payment =
      paymentInput === "PAID"
        ? "PAID"
        : paymentInput === "UNPAID"
          ? "UNPAID"
          : sStatus === "PAID"
            ? "PAID"
            : "UNPAID";
    await conn.beginTransaction();
    const [exists] = await conn.execute(
      `
      SELECT id, bill_no
      FROM pur_service_bills
      WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      LIMIT 1
      `,
      { id, companyId, branchId },
    );
    if (!(exists && exists.length)) {
      throw httpError(404, "NOT_FOUND", "Service bill not found");
    }
    await conn.execute(
      `
      UPDATE pur_service_bills
         SET ${billNo ? "bill_no = :billNo," : ""}
             bill_date = :billDate,
             due_date = :dueDate,
             service_date = :serviceDate,
             supplier_id = :supplierId,
             status = :status,
             payment = :payment,
             client_name = :clientName,
             client_company = :clientCompany,
             client_address = :clientAddress,
             client_phone = :clientPhone,
             client_email = :clientEmail,
             payment_method = :paymentMethod,
             payment_reference = :paymentReference,
             payment_terms = :paymentTerms,
             notes = :notes,
             discount_percent = :discountPercent,
             tax_percent = :taxPercent,
             subtotal = :subtotal,
             discount_amount = :discountAmount,
             tax_amount = :taxAmount,
             total_amount = :totalAmount
       WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
      `,
      {
        id,
        companyId,
        branchId,
        billNo,
        billDate,
        dueDate,
        serviceDate,
        supplierId,
        status: sStatus,
        payment,
        clientName,
        clientCompany,
        clientAddress,
        clientPhone,
        clientEmail,
        paymentMethod,
        paymentReference,
        paymentTerms,
        notes,
        discountPercent,
        taxPercent,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
      },
    );
    await conn.execute(
      "DELETE FROM pur_service_bill_details WHERE bill_id = :id",
      { id },
    );
    for (const r of normalized) {
      await conn.execute(
        `
        INSERT INTO pur_service_bill_details (
          bill_id, description, category, qty, rate, amount
        ) VALUES (
          :billId, :description, :category, :qty, :rate, :amount
        )
        `,
        {
          billId: id,
          description: r.desc,
          category: r.category,
          qty: r.qty,
          rate: r.rate,
          amount: r.amount,
        },
      );
    }
    await conn.commit();
    res.json({
      id,
      bill_no: billNo || exists[0]?.bill_no,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};
