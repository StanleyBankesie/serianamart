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

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
      bill_no VARCHAR(50) NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      service_date DATE NULL,
      status ENUM('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
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
    res.status(201).json({ id: hdr.insertId, request_no: requestNo });
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
    const rows = await query(
      `
      SELECT id, bill_no, bill_date, status, total_amount, client_name
      FROM pur_service_bills
      WHERE company_id = :companyId AND branch_id = :branchId
      ORDER BY bill_date DESC, id DESC
      `,
      { companyId, branchId },
    );
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
    const details = await query(
      `
      SELECT id, description, category, qty, rate, amount
      FROM pur_service_bill_details
      WHERE bill_id = :id
      ORDER BY id ASC
      `,
      { id },
    );
    res.json({ item: rows[0], details });
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
    const billNo =
      body.bill_no ||
      (await nextSequentialNo("pur_service_bills", "bill_no", "SB"));
    const billDate = body.bill_date || new Date().toISOString().slice(0, 10);
    const dueDate = body.due_date || null;
    const serviceDate = body.service_date || null;
    const status = String(body.status || "PENDING").toUpperCase();
    const sStatus = ["PENDING", "PAID", "OVERDUE"].includes(status)
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

    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `
      INSERT INTO pur_service_bills (
        company_id, branch_id, bill_no, bill_date, due_date, service_date, status,
        client_name, client_company, client_address, client_phone, client_email,
        payment_method, payment_reference, payment_terms, notes,
        discount_percent, tax_percent, subtotal, discount_amount, tax_amount, total_amount,
        created_by
      ) VALUES (
        :companyId, :branchId, :billNo, :billDate, :dueDate, :serviceDate, :status,
        :clientName, :clientCompany, :clientAddress, :clientPhone, :clientEmail,
        :paymentMethod, :paymentReference, :paymentTerms, :notes,
        :discountPercent, :taxPercent, :subtotal, :discountAmount, :taxAmount, :totalAmount,
        :createdBy
      )
      `,
      {
        companyId,
        branchId,
        billNo,
        billDate,
        dueDate,
        serviceDate,
        status: sStatus,
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
