import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as XLSX from "xlsx";

// Ensure fin_bank_accounts has required columns
async function ensureBankAccountsColumns() {
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_bank_accounts'`,
    );
    const colNames = (cols || []).map((c) => c.COLUMN_NAME);
    if (!colNames.includes("gl_account_id")) {
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD COLUMN gl_account_id BIGINT UNSIGNED NULL AFTER account_number`,
      );
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD INDEX idx_bank_account_gl (gl_account_id)`,
      );
    }
    if (!colNames.includes("bank_name")) {
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD COLUMN bank_name VARCHAR(100) NULL AFTER name`,
      );
    }
  } catch (e) {
    // Silently fail - table might not exist yet
  }
}
// Run on startup
ensureBankAccountsColumns();

export function requireIdParam(name) {
  return (req, _res, next) => {
    const id = Number(req.params[name]);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", `Invalid ${name}`));
    req.params[name] = String(id);
    return next();
  };
}

async function nextVoucherNo({ companyId, voucherTypeId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id, code, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId FOR UPDATE",
      { companyId, voucherTypeId },
    );
    const vt = rows?.[0];
    if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
    const up = String(vt.code).toUpperCase();
    const seq = ["PV", "CV", "RV", "JV", "SV", "PAYV"].includes(up)
      ? String(vt.next_number).padStart(6, "0")
      : String(vt.next_number);
    const voucherNo =
      up === "PV" || up === "SV" ? `${vt.prefix}${seq}` : `${vt.prefix}-${seq}`;
    await conn.execute(
      "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
      { companyId, voucherTypeId },
    );
    await conn.commit();
    return voucherNo;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  const id = Number(rows?.[0]?.id || 0);
  return id || 0;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.execute(
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

async function resolveFiscalYearIdForDate(conn, { companyId, dateYmd }) {
  let target = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    const d = new Date(dateYmd || new Date());
    target = toYmd(d);
  }
  if (!target) return 0;
  const [inRangeRows] = await conn.execute(
    `
    SELECT id, is_open
    FROM fin_fiscal_years
    WHERE company_id = :companyId
      AND :target >= start_date
      AND :target <= end_date
    ORDER BY start_date DESC
    LIMIT 1
    `,
    { companyId, target },
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

  const d = new Date(target);
  const currentYear = d.getFullYear();
  const currentMonth = d.getMonth() + 1;
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

async function ensureGroupIdTx(
  conn,
  { companyId, code, name, nature, parentId },
) {
  const [foundByCode] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  let id = Number(foundByCode?.[0]?.id || 0);
  if (!id) {
    const [foundByName] = await conn.execute(
      "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND name = :name LIMIT 1",
      { companyId, name },
    );
    id = Number(foundByName?.[0]?.id || 0);
  }
  if (!id) {
    try {
      const [ins] = await conn.execute(
        "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (:companyId, :code, :name, :nature, :parentId, 1)",
        { companyId, code, name, nature, parentId: parentId || null },
      );
      id = Number(ins.insertId || 0);
    } catch (e) {
      if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
      const [retry] = await conn.execute(
        "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND (code = :code OR name = :name) LIMIT 1",
        { companyId, code, name },
      );
      id = Number(retry?.[0]?.id || 0);
    }
  }
  return id || 0;
}

export async function ensureCustomerFinAccountIdTx(
  conn,
  { companyId, customerId },
) {
  const [custRows] = await conn.execute(
    "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: customerId },
  );
  const cust = custRows?.[0] || null;
  if (!cust) return 0;
  let code =
    cust.customer_code && String(cust.customer_code).trim()
      ? String(cust.customer_code).trim()
      : `C${String(Number(cust.id || 0)).padStart(5, "0")}`;
  const [accRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
  if (accIdExisting) return accIdExisting;
  const debtorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "DEBTORS",
    name: "Debtors",
    nature: "ASSET",
  });
  let currencyId = cust.currency_id || null;
  if (!currencyId) {
    const [curRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    currencyId = Number(curRows?.[0]?.id || 0) || null;
  }
  try {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      {
        companyId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId,
      },
    );
    return Number(ins?.insertId || 0) || 0;
  } catch (e) {
    // Handle race condition: another request created the account simultaneously
    if (String(e?.code || "") === "ER_DUP_ENTRY") {
      const [accRows2] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      return Number(accRows2?.[0]?.id || 0) || 0;
    }
    throw e;
  }
}

export async function ensureSupplierFinAccountIdTx(
  conn,
  { companyId, supplierId },
) {
  const [supRows] = await conn.execute(
    "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: supplierId },
  );
  const sup = supRows?.[0] || null;
  if (!sup) return 0;
  let code =
    sup.supplier_code && String(sup.supplier_code).trim()
      ? String(sup.supplier_code).trim()
      : `S${String(Number(sup.id || 0)).padStart(5, "0")}`;
  const [accRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
  if (accIdExisting) return accIdExisting;
  const creditorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "CREDITORS",
    name: "Creditors",
    nature: "LIABILITY",
  });
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

export async function getNextNumericCode(conn, { companyId, table, nature }) {
  let codeField = "code";
  if (table === "pur_suppliers") codeField = "supplier_code";
  if (table === "sal_customers") codeField = "customer_code";

  let prefix = "";
  if (table === "fin_accounts") {
    if (nature === "ASSET") prefix = "1";
    else if (nature === "LIABILITY") prefix = "2";
    else if (nature === "EQUITY") prefix = "3";
    else if (nature === "REVENUE") prefix = "4";
    else if (nature === "EXPENSE") prefix = "5";
  } else if (table === "pur_suppliers") {
    prefix = "SU-";
  } else if (table === "sal_customers") {
    prefix = "CU-";
  }

  const [rows] = await conn.execute(
    `SELECT ${codeField} FROM ${table} WHERE company_id = :companyId AND ${codeField} LIKE :pattern ORDER BY ${codeField} DESC LIMIT 1`,
    { companyId, pattern: `${prefix}%` },
  );

  let nextNum = 1;
  if (rows?.length) {
    const lastCode = rows[0][codeField];
    const numPart = lastCode.replace(prefix, "");
    const lastNum = parseInt(numPart, 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  if (prefix === "SU-" || prefix === "CU-") {
    return `${prefix}${String(nextNum).padStart(6, "0")}`;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export const getNextVoucherNo = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const code = req.query.voucherTypeCode
      ? String(req.query.voucherTypeCode).toUpperCase()
      : null;
    if (!code) {
      throw httpError(400, "VALIDATION_ERROR", "voucherTypeCode is required");
    }
    const rows = await query(
      "SELECT code, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    const vt = rows?.[0];
    if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
    const up = String(vt.code).toUpperCase();
    const seq =
      up === "PV" || up === "CV" || up === "RV" || up === "JV" || up === "SV"
        ? String(vt.next_number).padStart(6, "0")
        : String(vt.next_number);
    const nextNo = `${vt.prefix}-${seq}`;
    res.json({ nextNo });
  } catch (e) {
    next(e);
  }
};

export const submitVoucher = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const voucherId = Number(req.params.voucherId);
    const amount = req.body?.amount ?? null;
    const workflowIdOverride = Number(req.body?.workflow_id || 0) || null;
    const targetUserIdRaw = req.body?.target_user_id ?? null;
    const vRows = await query(
      `SELECT voucher_type_id, voucher_no, vt.code AS voucher_type_code
         FROM fin_vouchers v
         JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.company_id = :companyId AND v.branch_id = :branchId AND v.id = :id
        LIMIT 1`,
      { companyId, branchId, id: voucherId },
    );
    const vInfo = vRows?.[0];
    if (!vInfo) throw httpError(404, "NOT_FOUND", "Voucher not found");
    const typeCode = String(vInfo.voucher_type_code || "").toUpperCase();
    const isPV = typeCode === "PV";
    const isRV = typeCode === "RV";
    const isCV = typeCode === "CV";
    const isJV = typeCode === "JV";
    const docTypePrimary = isRV
      ? "RECEIPT_VOUCHER"
      : isPV
        ? "PAYMENT_VOUCHER"
        : isCV
          ? "CONTRA_VOUCHER"
          : isJV
            ? "JOURNAL_VOUCHER"
            : "VOUCHER";
    const titleName = isRV
      ? "Receipt Voucher"
      : isPV
        ? "Payment Voucher"
        : isCV
          ? "Contra Voucher"
          : isJV
            ? "Journal Voucher"
            : "Voucher";
    const docRouteBase = isRV
      ? "/finance/receipt-voucher"
      : isPV
        ? "/finance/payment-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : isJV
            ? "/finance/journal-voucher"
            : null;
    const typeSynonyms = isRV
      ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
      : isPV
        ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : isJV
            ? ["JOURNAL_VOUCHER", "Journal Voucher", "JV"]
            : ["VOUCHER", "Voucher", typeCode];
    const wfByRoute =
      docRouteBase != null
        ? await query(
            `SELECT * FROM adm_workflows WHERE company_id = :companyId AND document_route = :docRouteBase ORDER BY id ASC`,
            { companyId, docRouteBase },
          )
        : [];
    const wfDefs = await query(
      `SELECT * FROM adm_workflows 
         WHERE company_id = :companyId 
           AND (document_type = :t1 OR document_type = :t2 OR document_type = :t3)
         ORDER BY id ASC`,
      {
        companyId,
        t1: typeSynonyms[0],
        t2: typeSynonyms[1],
        t3: typeSynonyms[2],
      },
    );
    let activeWf = null;
    if (workflowIdOverride) {
      const wfRows = await query(
        `SELECT * FROM adm_workflows 
         WHERE id = :wfId AND company_id = :companyId 
           AND (document_type = :t1 OR document_type = :t2 OR document_type = :t3)
         LIMIT 1`,
        {
          wfId: workflowIdOverride,
          companyId,
          t1: typeSynonyms[0],
          t2: typeSynonyms[1],
          t3: typeSynonyms[2],
        },
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
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      }
      const dwRes = await query(
        `INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
        VALUES
          (:companyId, :workflowId, :documentId, :docType, :amount, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: voucherId,
          docType: docTypePrimary,
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
          (:companyId, :workflowId, :dwId, :documentId, :docType, :stepOrder, :assignedTo, 'PENDING')`,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: voucherId,
          docType: docTypePrimary,
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
        `UPDATE fin_vouchers SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id: voucherId, companyId, branchId },
      );
      const ref = vInfo?.voucher_no || null;
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId: assignedToUserId,
          title: "Approval Required",
          message: ref
            ? `${titleName} ${ref} requires your approval`
            : `${titleName} #${voucherId} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      );
      res.status(201).json({ instanceId, status: "SUBMITTED" });
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
        `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id: voucherId, companyId, branchId },
      );
      await query(
        `UPDATE fin_pdc_postings SET status = 'POSTED' WHERE voucher_id = :id AND company_id = :companyId`,
        { id: voucherId, companyId },
      );
      res.json({ status: "APPROVED" });
      return;
    }
    await query(
      `UPDATE fin_vouchers SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
      { id: voucherId, companyId, branchId },
    );
    res.json({ status: "SUBMITTED" });
  } catch (err) {
    next(err);
  }
};

export const syncAccounts = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    await conn.beginTransaction();
    const debtorsGroupId = await ensureGroupIdTx(conn, {
      companyId,
      code: "DEBTORS",
      name: "Debtors",
      nature: "ASSET",
      parentId: null,
    });
    const creditorsGroupId = await ensureGroupIdTx(conn, {
      companyId,
      code: "CREDITORS",
      name: "Creditors",
      nature: "LIABILITY",
      parentId: null,
    });
    const [baseCurRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    const baseCurrencyId = Number(baseCurRows?.[0]?.id || 0) || null;
    let customersCreated = 0;
    let customersUpdated = 0;
    const [custRows] = await conn.execute(
      "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId",
      { companyId },
    );
    for (const r of custRows || []) {
      const code =
        r.customer_code && String(r.customer_code).trim()
          ? String(r.customer_code).trim()
          : `C${String(Number(r.id || 0)).padStart(5, "0")}`;
      const [accRows] = await conn.query(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(debtorsGroupId)) {
        await conn.query(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: debtorsGroupId, id: acc.id, companyId },
        );
        customersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.query(
          `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
           VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
          {
            companyId,
            groupId: debtorsGroupId,
            code,
            name: r.customer_name,
            currencyId,
          },
        );
        customersCreated += 1;
      }
    }
    let suppliersCreated = 0;
    let suppliersUpdated = 0;
    const [supRows] = await conn.query(
      "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId",
      { companyId },
    );
    for (const r of supRows || []) {
      let code =
        r.supplier_code && String(r.supplier_code).trim()
          ? String(r.supplier_code).trim()
          : `SU-${String(Number(r.id || 0)).padStart(6, "0")}`;
      const [accRows] = await conn.query(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(creditorsGroupId)) {
        await conn.query(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: creditorsGroupId, id: acc.id, companyId },
        );
        suppliersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.query(
          `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
           VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
          {
            companyId,
            groupId: creditorsGroupId,
            code,
            name: r.supplier_name,
            currencyId,
          },
        );
        suppliersCreated += 1;
      }
    }
    await conn.query(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code LIKE 'C%'",
      { companyId, groupId: debtorsGroupId },
    );
    await conn.query(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code LIKE 'SU-%'",
      { companyId, groupId: creditorsGroupId },
    );
    await conn.commit();
    res.json({
      debtors_group_id: debtorsGroupId,
      creditors_group_id: creditorsGroupId,
      customers_created: customersCreated,
      customers_updated: customersUpdated,
      suppliers_created: suppliersCreated,
      suppliers_updated: suppliersUpdated,
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const listAccountGroups = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const conn = await pool.getConnection();
    try {
      await ensureGroupIdTx(conn, {
        companyId,
        code: "DEBTORS",
        name: "Debtors",
        nature: "ASSET",
        parentId: null,
      });
      await ensureGroupIdTx(conn, {
        companyId,
        code: "CREDITORS",
        name: "Creditors",
        nature: "LIABILITY",
        parentId: null,
      });
    } finally {
      conn.release();
    }
    const nature =
      req.query.nature &&
      ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(
        String(req.query.nature).toUpperCase(),
      )
        ? String(req.query.nature).toUpperCase()
        : null;
    const active =
      req.query.active === "0" || req.query.active === "1"
        ? Number(req.query.active)
        : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const includeTotals = req.query.includeTotals === "1";
    const items = await query(
      `SELECT g.id, g.code, g.name, g.nature, g.parent_id, pg.name AS parent_name, g.is_active, g.created_at, g.updated_at${
        includeTotals
          ? `,
                COALESCE(ac.cnt, 0) AS account_count,
                COALESCE(ac_act.cnt_active, 0) AS active_account_count`
          : ``
      }
         FROM fin_account_groups g
         LEFT JOIN fin_account_groups pg
           ON pg.id = g.parent_id
          AND pg.company_id = g.company_id
         ${
           includeTotals
             ? `LEFT JOIN (
                  SELECT group_id, COUNT(*) AS cnt
                    FROM fin_accounts
                   WHERE company_id = :companyId
                   GROUP BY group_id
                ) ac ON ac.group_id = g.id
                LEFT JOIN (
                  SELECT group_id, COUNT(*) AS cnt_active
                    FROM fin_accounts
                   WHERE company_id = :companyId AND is_active = 1
                   GROUP BY group_id
                ) ac_act ON ac_act.group_id = g.id`
             : ``
         }
        WHERE g.company_id = :companyId
          AND (:nature IS NULL OR g.nature = :nature)
          AND (:active IS NULL OR g.is_active = :active)
          AND (
            :search IS NULL OR
            g.code LIKE CONCAT('%', :search, '%') OR
            g.name LIKE CONCAT('%', :search, '%')
          )
        ORDER BY g.code ASC`,
      { companyId, nature, active, search },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listChartOfAccounts = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const items = await query(
      `SELECT a.id, a.code, a.name, a.is_postable, a.is_active, a.currency_id,
              c.code AS currency_code,
              g.id AS group_id, g.code AS group_code, g.name AS group_name, g.nature,
              pg.id AS parent_group_id, pg.name AS parent_group_name
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id AND g.company_id = a.company_id
       LEFT JOIN fin_currencies c ON c.id = a.currency_id AND c.company_id = a.company_id
       LEFT JOIN fin_account_groups pg ON pg.id = g.parent_id AND pg.company_id = a.company_id
       WHERE a.company_id = :companyId
         AND (:search IS NULL OR a.code LIKE CONCAT('%', :search, '%') OR a.name LIKE CONCAT('%', :search, '%') OR g.name LIKE CONCAT('%', :search, '%'))
       ORDER BY g.code ASC, a.code ASC`,
      { companyId, search },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const {
      groupId,
      name,
      currencyId,
      isPostable,
      isControlAccount,
      isActive,
    } = req.body;
    if (!groupId || !name) {
      return next(
        httpError(400, "VALIDATION_ERROR", "Group and Name are required"),
      );
    }

    // Generate code based on nature (1xxx for Asset, 2xxx for Liability, etc.)
    const groups = await query(
      "SELECT code, nature FROM fin_account_groups WHERE id = :groupId AND company_id = :companyId",
      { groupId, companyId },
    );
    if (!groups.length)
      return next(httpError(400, "VALIDATION_ERROR", "Invalid Group"));
    const nature = groups[0].nature;

    const natureMap = {
      ASSET: 1,
      LIABILITY: 2,
      EQUITY: 3,
      INCOME: 4,
      EXPENSE: 5,
    };
    const natureCode = natureMap[nature] || 9;
    const naturePrefix = natureCode.toString();

    // Find the next available numeric 4-digit code in this nature's series
    const maxRows = await query(
      `SELECT MAX(CAST(code AS UNSIGNED)) as maxCode 
       FROM fin_accounts 
       WHERE company_id = :companyId 
         AND code REGEXP '^[1-5][0-9]{3}$' 
         AND code LIKE :prefix`,
      { companyId, prefix: `${naturePrefix}%` },
    );

    let code;
    if (maxRows[0] && maxRows[0].maxCode) {
      code = (Number(maxRows[0].maxCode) + 1).toString();
    } else {
      // Start from nature base + 1 (e.g., 1001, 2001, etc.)
      code = (natureCode * 1000 + 1).toString();
    }

    const result = await query(
      `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_postable, is_control_account, is_active)
       VALUES (:companyId, :groupId, :code, :name, :currencyId, :isPostable, :isControlAccount, :isActive)`,
      {
        companyId,
        groupId,
        code,
        name,
        currencyId: currencyId || null,
        isPostable: isPostable === undefined ? 1 : Number(Boolean(isPostable)),
        isControlAccount:
          isControlAccount === undefined
            ? 0
            : Number(Boolean(isControlAccount)),
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );

    res.status(201).json({ id: result.insertId, code });
  } catch (e) {
    next(e);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    const {
      groupId,
      name,
      code,
      currencyId,
      isPostable,
      isControlAccount,
      isActive,
    } = req.body;

    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    await query(
      `UPDATE fin_accounts 
       SET group_id = COALESCE(:groupId, group_id),
           name = COALESCE(:name, name),
           code = COALESCE(:code, code),
           currency_id = :currencyId,
           is_postable = COALESCE(:isPostable, is_postable),
           is_control_account = COALESCE(:isControlAccount, is_control_account),
           is_active = COALESCE(:isActive, is_active)
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        groupId: groupId || null,
        name: name || null,
        code: code || null,
        currencyId: currencyId || null,
        isPostable:
          isPostable === undefined ? null : Number(Boolean(isPostable)),
        isControlAccount:
          isControlAccount === undefined
            ? null
            : Number(Boolean(isControlAccount)),
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
      },
    );

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const updateAccountActiveStatus = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    const { isActive } = req.body;
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    await query(
      "UPDATE fin_accounts SET is_active = :isActive WHERE id = :id AND company_id = :companyId",
      { id, companyId, isActive: Number(Boolean(isActive)) },
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const listTaxCodes = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const form = req.query.form ? String(req.query.form).trim() : null;
    const active =
      req.query.active === undefined || req.query.active === null
        ? null
        : Number(Boolean(req.query.active));
    const items = await query(
      `SELECT id, code, name, rate_percent, type, is_active,
              valid_pages, is_sales_tax, is_purchase_tax, is_service_tax
         FROM fin_tax_codes
        WHERE company_id = :companyId
          AND (:active IS NULL OR is_active = :active)
          AND (
            :form IS NULL OR
            valid_pages IS NULL OR
            valid_pages = '' OR
            FIND_IN_SET(:form, REPLACE(valid_pages, ' ', '')) > 0
          )
        ORDER BY code ASC`,
      { companyId, form, active },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listTaxCodeComponents = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const taxCodeId = Number(req.params.id || req.params.taxCodeId || 0);
    if (!taxCodeId) {
      return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
    }
    const items = await query(
      `SELECT c.id, c.tax_detail_id, c.rate_percent, c.sort_order, c.is_active,
              d.component_name, d.account_id,
              a.code AS account_code, a.name AS account_name
         FROM fin_tax_components c
         LEFT JOIN fin_tax_details d
           ON d.id = c.tax_detail_id
          AND d.company_id = c.company_id
         LEFT JOIN fin_accounts a ON a.id = d.account_id
        WHERE c.company_id = :companyId
          AND c.tax_code_id = :taxCodeId
        ORDER BY c.sort_order ASC, c.id ASC`,
      { companyId, taxCodeId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listVouchers = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const voucherTypeCode = req.query.voucherTypeCode
      ? String(req.query.voucherTypeCode).toUpperCase()
      : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const status = req.query.status
      ? String(req.query.status).toUpperCase()
      : null;
    const items = await query(
      `SELECT v.id, v.voucher_no, v.voucher_date, v.status,
              v.narration AS remarks, v.total_debit, v.total_credit, v.balanced_amount,
              v.total_debit AS total_amount,
              v.voucher_type_id, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
              v.currency_id, c.code AS currency_code
         FROM fin_vouchers v
         JOIN fin_voucher_types vt
           ON vt.id = v.voucher_type_id
          AND vt.company_id = v.company_id
         LEFT JOIN fin_currencies c
           ON c.id = v.currency_id
          AND c.company_id = v.company_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:voucherTypeCode IS NULL OR vt.code = :voucherTypeCode)
          AND (:status IS NULL OR v.status = :status)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
        ORDER BY v.voucher_date DESC, v.id DESC`,
      { companyId, branchId, voucherTypeCode, status, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const getVoucherById = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    const headerRows = await query(
      `SELECT v.id, v.voucher_no, v.voucher_date, v.status,
              v.narration AS remarks, v.total_debit, v.total_credit, v.balanced_amount,
              v.total_debit AS total_amount,
              v.voucher_type_id, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
              v.currency_id, c.code AS currency_code
         FROM fin_vouchers v
         JOIN fin_voucher_types vt
           ON vt.id = v.voucher_type_id
          AND vt.company_id = v.company_id
         LEFT JOIN fin_currencies c
           ON c.id = v.currency_id
          AND c.company_id = v.company_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND v.id = :id
        LIMIT 1`,
      { companyId, branchId, id },
    );
    const voucher = headerRows?.[0];
    if (!voucher) return next(httpError(404, "NOT_FOUND", "Voucher not found"));
    const lines = await query(
      `SELECT l.id, l.line_no, l.account_id, l.debit, l.credit, l.description AS narration,
              a.code AS account_code, a.name AS account_name
         FROM fin_voucher_lines l
         LEFT JOIN fin_accounts a ON a.id = l.account_id AND a.company_id = :companyId
        WHERE l.company_id = :companyId
          AND l.voucher_id = :voucherId
        ORDER BY l.line_no ASC, l.id ASC`,
      { companyId, voucherId: id },
    );
    res.json({ ...voucher, lines });
  } catch (e) {
    next(e);
  }
};

export const createVoucher = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId || null;
    const {
      voucherTypeCode,
      voucherTypeId,
      voucherDate,
      voucherNo,
      remarks,
      currencyId,
      status,
      lines,
    } = req.body || {};
    let finalVoucherTypeId = Number(voucherTypeId || 0) || 0;
    if (!finalVoucherTypeId && voucherTypeCode) {
      const vtRows = await query(
        `SELECT id
           FROM fin_voucher_types
          WHERE company_id = :companyId
            AND code = :code
          LIMIT 1`,
        { companyId, code: String(voucherTypeCode).toUpperCase() },
      );
      finalVoucherTypeId = Number(vtRows?.[0]?.id || 0);
    }
    if (!finalVoucherTypeId) {
      return next(
        httpError(400, "VALIDATION_ERROR", "voucherType is required"),
      );
    }
    const totalAmount = Array.isArray(lines)
      ? lines.reduce((sum, l) => sum + Number(l?.debit || 0), 0)
      : 0;
    const voucherDateYmd = voucherDate || new Date().toISOString().slice(0, 10);
    const fyRows = await query(
      `SELECT id
         FROM fin_fiscal_years
        WHERE company_id = :companyId
          AND :voucherDate >= start_date
          AND :voucherDate <= end_date
        ORDER BY start_date DESC
        LIMIT 1`,
      { companyId, voucherDate: voucherDateYmd },
    );
    const fiscalYearId = Number(fyRows?.[0]?.id || 0) || null;
    const result = await query(
      `INSERT INTO fin_vouchers
         (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by)
       VALUES
         (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, :balancedAmount, :status, :createdBy)`,
      {
        companyId,
        branchId,
        fiscalYearId: fiscalYearId || null,
        voucherTypeId: finalVoucherTypeId,
        voucherNo: voucherNo || null,
        voucherDate: voucherDateYmd,
        narration: remarks || null,
        currencyId: currencyId || null,
        exchangeRate: 1,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
        balancedAmount: totalAmount,
        status: status || "DRAFT",
        createdBy: Number(req.user?.sub || req.user?.id || 0) || null,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const updateVoucher = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    const { voucherDate, remarks, status } = req.body || {};
    await query(
      `UPDATE fin_vouchers
          SET voucher_date = COALESCE(:voucherDate, voucher_date),
              narration = COALESCE(:remarks, narration),
              status = COALESCE(:status, status)
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR branch_id = :branchId)
          AND id = :id`,
      {
        companyId,
        branchId,
        id,
        voucherDate: voucherDate || null,
        remarks: remarks || null,
        status: status || null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const reverseVoucher = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    await query(
      `UPDATE fin_vouchers
          SET status = 'REVERSED'
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR branch_id = :branchId)
          AND id = :id`,
      { companyId, branchId, id },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const backfillVoucherTaxSplit = async (req, res, next) => {
  try {
    // Endpoint intentionally returns success so list pages can trigger it safely.
    res.json({ ok: true, updated: 0 });
  } catch (e) {
    next(e);
  }
};

export const voucherRegisterReport = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT v.id, v.voucher_no, v.voucher_date, v.status, v.total_debit, v.total_credit, v.narration,
              vt.code AS voucher_type_code, vt.name AS voucher_type_name
         FROM fin_vouchers v
         JOIN fin_voucher_types vt
           ON vt.id = v.voucher_type_id
          AND vt.company_id = v.company_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
        ORDER BY v.voucher_date DESC, v.id DESC`,
      { companyId, branchId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const paymentDueReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT sb.id, sb.bill_no AS ref_no, sb.bill_date, sb.due_date, sb.client_name AS party_name,
              sb.total_amount AS amount, (sb.total_amount - COALESCE(sb.amount_paid, 0)) AS outstanding, sb.status
         FROM pur_service_bills sb
        WHERE sb.company_id = :companyId
          AND (:branchId IS NULL OR sb.branch_id = :branchId)
          AND (:from IS NULL OR sb.due_date >= :from)
          AND (:to IS NULL OR sb.due_date <= :to)
          AND (sb.total_amount - COALESCE(sb.amount_paid, 0)) > 0
        ORDER BY sb.due_date ASC`,
      { companyId, branchId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const outstandingReceivableReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT i.id, i.invoice_no AS ref_no, i.invoice_date, i.invoice_date AS due_date, c.customer_name AS party_name,
              i.total_amount AS amount, i.balance_amount AS outstanding, i.payment_status AS status
         FROM sal_invoices i
         LEFT JOIN sal_customers c ON c.id = i.customer_id
        WHERE i.company_id = :companyId
          AND (:branchId IS NULL OR i.branch_id = :branchId)
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
          AND i.balance_amount > 0
        ORDER BY i.invoice_date ASC`,
      { companyId, branchId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const trialBalanceReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const groupId = req.query.groupId ? Number(req.query.groupId) : null;

    const items = await query(
      `SELECT 
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        ag.name AS account_category,
        ag.nature AS account_type,
        -- Opening Balances
        (COALESCE(SUM(CASE WHEN v.voucher_date < :from THEN vl.debit ELSE 0 END), 0) + COALESCE(ob.opening_debit, 0)) AS opening_debit,
        (COALESCE(SUM(CASE WHEN v.voucher_date < :from THEN vl.credit ELSE 0 END), 0) + COALESCE(ob.opening_credit, 0)) AS opening_credit,
        -- Movement
        COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.debit ELSE 0 END), 0) AS movement_debit,
        COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.credit ELSE 0 END), 0) AS movement_credit,
        -- Closing Balances
        (COALESCE(SUM(CASE WHEN v.voucher_date <= :to THEN vl.debit ELSE 0 END), 0) + COALESCE(ob.opening_debit, 0)) AS closing_debit,
        (COALESCE(SUM(CASE WHEN v.voucher_date <= :to THEN vl.credit ELSE 0 END), 0) + COALESCE(ob.opening_credit, 0)) AS closing_credit
      FROM fin_accounts a
      JOIN fin_account_groups ag ON ag.id = a.group_id
      LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
      LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.status = 'POSTED'
      LEFT JOIN fin_account_opening_balances ob ON ob.account_id = a.id AND ob.company_id = a.company_id
      WHERE a.company_id = :companyId
        AND (:groupId IS NULL OR a.group_id = :groupId)
      GROUP BY a.id, a.code, a.name, ag.name, ag.nature, ob.opening_debit, ob.opening_credit
      ORDER BY a.code ASC`,
      { companyId, from, to, groupId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const auditTrailReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT l.id, l.event_time AS action_time, u.username AS user_name, l.action, 
              l.message AS details, l.ref_no, l.url_path AS page_visited, 
              l.module_name, l.created_at, 'Financial' AS entity
         FROM adm_system_logs l
         LEFT JOIN adm_users u ON u.id = l.created_by
        WHERE l.company_id = :companyId
          AND (:from IS NULL OR l.event_time >= :from)
          AND (:to IS NULL OR l.event_time <= :to)
        ORDER BY l.event_time DESC`,
      { companyId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const journalsReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const order = req.query.order || "new";
    const sort = order === "old" ? "ASC" : "DESC";
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id, vt.code AS voucher_type_code, vt.name AS voucher_type_name
         FROM fin_vouchers v
         JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
        ORDER BY v.voucher_date ${sort}, v.id ${sort}, vl.line_no ASC`,
      { companyId, branchId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const customerOutstandingReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const asOf = req.query.asOf ? String(req.query.asOf) : null;
    const items = await query(
      `SELECT i.id, c.customer_name, i.invoice_no, i.invoice_date, i.invoice_date AS due_date,
              i.total_amount AS amount, (i.total_amount - i.balance_amount) AS received, i.balance_amount AS outstanding
         FROM sal_invoices i
         LEFT JOIN sal_customers c ON c.id = i.customer_id
        WHERE i.company_id = :companyId
          AND (:branchId IS NULL OR i.branch_id = :branchId)
          AND (:asOf IS NULL OR i.invoice_date <= :asOf)
          AND i.balance_amount > 0
        ORDER BY c.customer_name ASC, i.invoice_date ASC`,
      { companyId, branchId, asOf },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createTaxCode = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const {
      code,
      name,
      ratePercent,
      type,
      isActive,
      isSalesTax,
      isPurchaseTax,
      isServiceTax,
      validPages,
    } = req.body || {};
    if (!code || !name || !type)
      throw httpError(400, "VALIDATION_ERROR", "code, name, type are required");
    if (!["TAX", "DEDUCTION"].includes(String(type)))
      throw httpError(400, "VALIDATION_ERROR", "Invalid type");
    const result = await query(
      `INSERT INTO fin_tax_codes (company_id, code, name, rate_percent, type, is_active, is_sales_tax, is_purchase_tax, is_service_tax, valid_pages)
       VALUES (:companyId, :code, :name, :ratePercent, :type, :isActive, :isSalesTax, :isPurchaseTax, :isServiceTax, :validPages)`,
      {
        companyId,
        code,
        name,
        ratePercent: Number(ratePercent || 0),
        type: String(type),
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
        isSalesTax: isSalesTax ? 1 : 0,
        isPurchaseTax: isPurchaseTax ? 1 : 0,
        isServiceTax: isServiceTax ? 1 : 0,
        validPages: Array.isArray(validPages) ? validPages.join(",") : "",
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const updateTaxCode = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const taxCodeId = Number(req.params.taxCodeId || req.params.id);
    const {
      name,
      ratePercent,
      type,
      isActive,
      isSalesTax,
      isPurchaseTax,
      isServiceTax,
      validPages,
    } = req.body || {};
    const rows = await query(
      "SELECT id FROM fin_tax_codes WHERE company_id = :companyId AND id = :id",
      { companyId, id: taxCodeId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Tax code not found");
    if (type && !["TAX", "DEDUCTION"].includes(String(type)))
      throw httpError(400, "VALIDATION_ERROR", "Invalid type");
    await query(
      `UPDATE fin_tax_codes
         SET name = COALESCE(:name, name),
             rate_percent = COALESCE(:ratePercent, rate_percent),
             type = COALESCE(:type, type),
             is_active = COALESCE(:isActive, is_active),
             is_sales_tax = COALESCE(:isSalesTax, is_sales_tax),
             is_purchase_tax = COALESCE(:isPurchaseTax, is_purchase_tax),
             is_service_tax = COALESCE(:isServiceTax, is_service_tax),
             valid_pages = COALESCE(:validPages, valid_pages)
       WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: taxCodeId,
        name: name || null,
        ratePercent:
          ratePercent === undefined ? null : Number(ratePercent || 0),
        type: type || null,
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
        isSalesTax:
          isSalesTax === undefined ? null : Number(Boolean(isSalesTax)),
        isPurchaseTax:
          isPurchaseTax === undefined ? null : Number(Boolean(isPurchaseTax)),
        isServiceTax:
          isServiceTax === undefined ? null : Number(Boolean(isServiceTax)),
        validPages:
          validPages === undefined
            ? null
            : Array.isArray(validPages)
              ? validPages.join(",")
              : "",
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const createTaxCodeComponent = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const taxCodeId = Number(req.params.taxCodeId || req.params.id);
    const { componentName, ratePercent, sortOrder, isActive, accountId } =
      req.body || {};
    if (!taxCodeId)
      return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
    if (!componentName)
      throw httpError(400, "VALIDATION_ERROR", "componentName is required");
    const detail = await query(
      `INSERT INTO fin_tax_details (company_id, tax_code_id, component_name, rate_percent, account_id, is_active)
       VALUES (:companyId, :taxCodeId, :componentName, :ratePercent, :accountId, :isActive)`,
      {
        companyId,
        taxCodeId,
        componentName,
        ratePercent: Number(ratePercent || 0),
        accountId: Number(accountId) || null,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    const taxDetailId = detail.insertId;
    await query(
      `INSERT INTO fin_tax_components (company_id, tax_code_id, tax_detail_id, rate_percent, sort_order, is_active)
       VALUES (:companyId, :taxCodeId, :taxDetailId, :ratePercent, :sortOrder, :isActive)`,
      {
        companyId,
        taxCodeId,
        taxDetailId,
        ratePercent: Number(ratePercent || 0),
        sortOrder: sortOrder || 100,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.status(201).json({ id: taxDetailId });
  } catch (e) {
    next(e);
  }
};

export const listCurrencies = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { active } = req.query || {};
    const activeFilter =
      active === undefined || active === null || String(active).trim() === ""
        ? null
        : Number(Boolean(active));
    const items = await query(
      `SELECT id, code, name, symbol, is_base, is_active, created_at
         FROM fin_currencies
        WHERE company_id = :companyId
          AND (:activeFilter IS NULL OR is_active = :activeFilter)
        ORDER BY is_base DESC, code ASC`,
      { companyId, activeFilter },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCurrency = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    const { code, name, symbol, isBase, isActive } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code, name are required");
    await conn.beginTransaction();
    const [ins] = await conn.execute(
      `INSERT INTO fin_currencies (company_id, code, name, symbol, is_base, is_active)
       VALUES (:companyId, :code, :name, :symbol, :isBase, :isActive)`,
      {
        companyId,
        code,
        name,
        symbol: symbol || null,
        isBase: isBase ? 1 : 0,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    if (isBase) {
      await conn.execute(
        "UPDATE fin_currencies SET is_base = 0 WHERE company_id = :companyId AND id <> :id",
        { companyId, id: ins.insertId },
      );
    }
    await conn.commit();
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const updateCurrency = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    const currencyId = Number(req.params.currencyId || req.params.id);
    const { name, symbol, isBase, isActive } = req.body || {};
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE fin_currencies
         SET name = COALESCE(:name, name),
             symbol = COALESCE(:symbol, symbol),
             is_base = COALESCE(:isBase, is_base),
             is_active = COALESCE(:isActive, is_active)
       WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: currencyId,
        name: name || null,
        symbol: symbol || null,
        isBase: isBase === undefined ? null : Number(Boolean(isBase)),
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
      },
    );
    if (isBase) {
      await conn.execute(
        "UPDATE fin_currencies SET is_base = 0 WHERE company_id = :companyId AND id <> :id",
        { companyId, id: currencyId },
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const listCurrencyRates = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fromCurrencyId = req.query.fromCurrencyId
      ? Number(req.query.fromCurrencyId)
      : null;
    const toCurrencyId = req.query.toCurrencyId
      ? Number(req.query.toCurrencyId)
      : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT r.id, r.from_currency_id, fc.code AS from_code, r.to_currency_id, tc.code AS to_code, r.rate, r.rate_date
         FROM fin_currency_rates r
         JOIN fin_currencies fc ON fc.id = r.from_currency_id
         JOIN fin_currencies tc ON tc.id = r.to_currency_id
        WHERE fc.company_id = :companyId
          AND tc.company_id = :companyId
          AND (:fromCurrencyId IS NULL OR r.from_currency_id = :fromCurrencyId)
          AND (:toCurrencyId IS NULL OR r.to_currency_id = :toCurrencyId)
          AND (:from IS NULL OR r.rate_date >= :from)
          AND (:to IS NULL OR r.rate_date <= :to)
        ORDER BY r.rate_date DESC, r.id DESC`,
      { companyId, fromCurrencyId, toCurrencyId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCurrencyRate = async (req, res, next) => {
  try {
    const { fromCurrencyId, toCurrencyId, rate, rateDate } = req.body || {};
    const companyId = req.scope.companyId;
    if (!fromCurrencyId || !toCurrencyId || !rate)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fromCurrencyId, toCurrencyId, rate are required",
      );
    const result = await query(
      `INSERT INTO fin_currency_rates (company_id, from_currency_id, to_currency_id, rate_date, rate)
       VALUES (:companyId, :fromCurrencyId, :toCurrencyId, :rateDate, :rate)`,
      {
        companyId,
        fromCurrencyId: Number(fromCurrencyId),
        toCurrencyId: Number(toCurrencyId),
        rate: Number(rate),
        rateDate: rateDate || new Date().toISOString().slice(0, 10),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const updateCurrencyRate = async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId || req.params.id);
    const { rate, rateDate } = req.body || {};
    await query(
      `UPDATE fin_currency_rates
         SET rate = COALESCE(:rate, rate),
             rate_date = COALESCE(:rateDate, rate_date)
       WHERE id = :id`,
      {
        id: rateId,
        rate: rate === undefined ? null : Number(rate || 0),
        rateDate: rateDate || null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteCurrencyRate = async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId || req.params.id);
    await query("DELETE FROM fin_currency_rates WHERE id = :id", {
      id: rateId,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const createFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { code, startDate, endDate, isOpen } = req.body || {};
    if (!code || !startDate || !endDate)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "code, startDate, endDate are required",
      );
    const result = await query(
      `INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
       VALUES (:companyId, :code, :startDate, :endDate, :isOpen)`,
      {
        companyId,
        code,
        startDate,
        endDate,
        isOpen: isOpen ? 1 : 0,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const openFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fiscalYearId = Number(req.params.fiscalYearId || req.params.id);
    await query(
      "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
      { companyId, id: fiscalYearId },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const closeFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fiscalYearId = Number(req.params.fiscalYearId || req.params.id);
    await query(
      "UPDATE fin_fiscal_years SET is_open = 0 WHERE company_id = :companyId AND id = :id",
      { companyId, id: fiscalYearId },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const listOpeningBalances = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fiscalYearId = req.query.fiscalYearId
      ? Number(req.query.fiscalYearId)
      : null;
    const items = await query(
      `SELECT ob.id, ob.fiscal_year_id, fy.code AS fiscal_year_code,
              ob.account_id, a.code AS account_code, a.name AS account_name,
              ob.branch_id, ob.opening_debit, ob.opening_credit
         FROM fin_account_opening_balances ob
         JOIN fin_fiscal_years fy ON fy.id = ob.fiscal_year_id
         JOIN fin_accounts a ON a.id = ob.account_id
        WHERE ob.company_id = :companyId
          AND (:fiscalYearId IS NULL OR ob.fiscal_year_id = :fiscalYearId)
        ORDER BY a.code ASC`,
      { companyId, fiscalYearId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const upsertOpeningBalance = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId || null;
    const { fiscalYearId, accountId, openingDebit, openingCredit } =
      req.body || {};
    if (!fiscalYearId || !accountId)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fiscalYearId, accountId are required",
      );
    const result = await query(
      `INSERT INTO fin_account_opening_balances (company_id, fiscal_year_id, account_id, branch_id, opening_debit, opening_credit)
       VALUES (:companyId, :fiscalYearId, :accountId, :branchId, :openingDebit, :openingCredit)
       ON DUPLICATE KEY UPDATE opening_debit = VALUES(opening_debit), opening_credit = VALUES(opening_credit)`,
      {
        companyId,
        fiscalYearId: Number(fiscalYearId),
        accountId: Number(accountId),
        branchId,
        openingDebit: Number(openingDebit || 0),
        openingCredit: Number(openingCredit || 0),
      },
    );
    res.status(201).json({ id: result.insertId || null });
  } catch (e) {
    next(e);
  }
};

export const bulkUpsertOpeningBalances = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId || null;
    const { fiscalYearId, items } = req.body || {};
    if (!fiscalYearId || !Array.isArray(items))
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fiscalYearId and items[] are required",
      );
    await conn.beginTransaction();
    let affected = 0;
    for (const it of items) {
      const accountId = Number(it?.accountId);
      const openingDebit = Number(it?.openingDebit || 0);
      const openingCredit = Number(it?.openingCredit || 0);
      if (!Number.isFinite(accountId) || accountId <= 0) continue;
      await conn.execute(
        `INSERT INTO fin_account_opening_balances
           (company_id, fiscal_year_id, account_id, branch_id, opening_debit, opening_credit)
         VALUES
           (:companyId, :fiscalYearId, :accountId, :branchId, :openingDebit, :openingCredit)
         ON DUPLICATE KEY UPDATE
           opening_debit = VALUES(opening_debit),
           opening_credit = VALUES(opening_credit)`,
        {
          companyId,
          fiscalYearId: Number(fiscalYearId),
          accountId,
          branchId,
          openingDebit,
          openingCredit,
        },
      );
      affected++;
    }
    await conn.commit();
    res.status(200).json({ upserted: affected });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};
export const getAccountGroupsTree = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const conn = await pool.getConnection();
    try {
      await ensureGroupIdTx(conn, {
        companyId,
        code: "DEBTORS",
        name: "Debtors",
        nature: "ASSET",
        parentId: null,
      });
      await ensureGroupIdTx(conn, {
        companyId,
        code: "CREDITORS",
        name: "Creditors",
        nature: "LIABILITY",
        parentId: null,
      });
    } finally {
      conn.release();
    }
    const rows = await query(
      "SELECT id, code, name, nature, parent_id, is_active FROM fin_account_groups WHERE company_id = :companyId ORDER BY code ASC",
      { companyId },
    );
    const byId = new Map();
    for (const r of rows) {
      byId.set(r.id, { ...r, children: [] });
    }
    const roots = [];
    for (const r of rows) {
      const node = byId.get(r.id);
      if (r.parent_id && byId.has(r.parent_id)) {
        byId.get(r.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }
    res.json({ items: roots });
  } catch (e) {
    next(e);
  }
};

export const createAccountGroup = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { code, name, nature, parentId, isActive } = req.body || {};
    if (!code || !name || !nature)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "code, name, nature are required",
      );
    const result = await query(
      "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (:companyId, :code, :name, :nature, :parentId, :isActive)",
      {
        companyId,
        code,
        name,
        nature,
        parentId: parentId || null,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const setAccountGroupActive = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.accountGroupId || req.params.id);
    const { isActive } = req.body || {};
    if (isActive === undefined)
      return next(httpError(400, "VALIDATION_ERROR", "isActive is required"));
    const rows = await query(
      "SELECT id, is_active FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
      { companyId, id },
    );
    if (!rows.length)
      return next(httpError(404, "NOT_FOUND", "Account group not found"));
    const targetActive = Number(Boolean(isActive));
    if (targetActive === 0) {
      const [accRows] = await query(
        "SELECT COUNT(*) AS cnt FROM fin_accounts WHERE company_id = :companyId AND group_id = :groupId AND is_active = 1",
        { companyId, groupId: id },
      );
      const cnt = Number(accRows?.[0]?.cnt || 0);
      if (cnt > 0)
        return next(
          httpError(
            400,
            "VALIDATION_ERROR",
            "Deactivate or move accounts under this group before deactivation",
          ),
        );
    }
    await query(
      "UPDATE fin_account_groups SET is_active = :isActive WHERE company_id = :companyId AND id = :id",
      { companyId, id, isActive: targetActive },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const updateAccountGroup = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.accountGroupId || req.params.id);
    const { code, name, nature, parentId } = req.body || {};
    const rows = await query(
      "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
      { companyId, id },
    );
    if (!rows.length)
      return next(httpError(404, "NOT_FOUND", "Account group not found"));
    if (
      nature !== undefined &&
      !["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(
        String(nature).toUpperCase(),
      )
    ) {
      return next(httpError(400, "VALIDATION_ERROR", "Invalid nature"));
    }
    await query(
      `UPDATE fin_account_groups
          SET code = COALESCE(:code, code),
              name = COALESCE(:name, name),
              nature = COALESCE(:nature, nature),
              parent_id = COALESCE(:parentId, parent_id)
        WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id,
        code: code || null,
        name: name || null,
        nature: nature || null,
        parentId: parentId === undefined ? null : parentId || null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

// Financial Reports
export const cashFlowReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    // Query cash flow from fin_vouchers joined with fin_voucher_lines and bank accounts
    const items = await query(
      `SELECT 
        ba.id AS bank_account_id,
        ba.bank_name,
        ba.account_number,
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        SUM(CASE WHEN vl.debit > 0 THEN vl.debit ELSE 0 END) AS inflow,
        SUM(CASE WHEN vl.credit > 0 THEN vl.credit ELSE 0 END) AS outflow,
        SUM(COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) AS net
       FROM fin_bank_accounts ba
       JOIN fin_accounts a ON a.id = ba.gl_account_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
       WHERE ba.company_id = :companyId
       GROUP BY ba.id, ba.bank_name, ba.account_number, a.id, a.code, a.name
       ORDER BY ba.bank_name ASC`,
      { companyId, branchId: branchId || null, from, to },
    );

    // Calculate totals
    const totals = items.reduce(
      (acc, r) => {
        acc.inflow += Number(r.inflow || 0);
        acc.outflow += Number(r.outflow || 0);
        acc.net += Number(r.net || 0);
        return acc;
      },
      { inflow: 0, outflow: 0, net: 0 },
    );

    res.json({ items, totals });
  } catch (e) {
    next(e);
  }
};

export const balanceSheetReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const asOfDate = req.query.to
      ? String(req.query.to)
      : new Date().toISOString().split("T")[0];

    // 1. Fetch all balance-sheet account groups (ASSET, LIABILITY, EQUITY)
    const groups = await query(
      `SELECT id, code, name, nature, parent_id 
       FROM fin_account_groups 
       WHERE company_id = :companyId AND nature IN ('ASSET', 'LIABILITY', 'EQUITY') AND is_active = 1
       ORDER BY code ASC`,
      { companyId },
    );

    // 2. Fetch opening balances per account
    const openingBalances = await query(
      `SELECT account_id, 
              SUM(COALESCE(debit_amount, 0)) AS ob_debit,
              SUM(COALESCE(credit_amount, 0)) AS ob_credit
       FROM fin_opening_balances
       WHERE company_id = :companyId
       GROUP BY account_id`,
      { companyId },
    );
    const obMap = new Map();
    openingBalances.forEach((ob) => {
      obMap.set(Number(ob.account_id), {
        debit: Number(ob.ob_debit || 0),
        credit: Number(ob.ob_credit || 0),
      });
    });

    // 3. Fetch voucher movements up to asOfDate
    const movements = await query(
      `SELECT a.id as account_id, a.code as account_code, a.name as account_name, a.group_id, g.nature,
              SUM(COALESCE(vl.debit, 0)) AS mv_debit,
              SUM(COALESCE(vl.credit, 0)) AS mv_credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND v.voucher_date <= :asOfDate
          AND v.status = 'POSTED'
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('ASSET', 'LIABILITY', 'EQUITY')
       GROUP BY a.id, a.code, a.name, a.group_id, g.nature
       ORDER BY a.code ASC`,
      { companyId, branchId: branchId || null, asOfDate },
    );

    // 4. Build the hierarchical tree per section
    const buildTree = (nature) => {
      const filteredGroups = groups.filter((g) => g.nature === nature);
      const filteredAccounts = movements.filter((a) => a.nature === nature);

      const groupMap = new Map();
      filteredGroups.forEach((g) => {
        groupMap.set(g.id, {
          ...g,
          type: "group",
          children: [],
          accounts: [],
          amount: 0,
          level: 0,
        });
      });

      const roots = [];
      filteredGroups.forEach((g) => {
        const node = groupMap.get(g.id);
        if (g.parent_id && groupMap.has(g.parent_id)) {
          groupMap.get(g.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      filteredAccounts.forEach((a) => {
        const ob = obMap.get(Number(a.account_id)) || { debit: 0, credit: 0 };
        const totalDebit = Number(a.mv_debit || 0) + ob.debit;
        const totalCredit = Number(a.mv_credit || 0) + ob.credit;
        // For ASSET: positive balance = debit > credit
        // For LIABILITY/EQUITY: positive balance = credit > debit
        let amount;
        if (nature === "ASSET") {
          amount = totalDebit - totalCredit;
        } else {
          amount = totalCredit - totalDebit;
        }
        const accNode = {
          ...a,
          type: "account",
          amount,
          ob_debit: ob.debit,
          ob_credit: ob.credit,
        };
        if (groupMap.has(a.group_id)) {
          groupMap.get(a.group_id).accounts.push(accNode);
        }
      });

      const calcTotal = (node, level) => {
        node.level = level;
        let total = 0;
        node.accounts.forEach((a) => {
          a.level = level + 1;
          total += Number(a.amount || 0);
        });
        node.children.forEach((c) => {
          total += calcTotal(c, level + 1);
        });
        node.amount = total;
        return total;
      };

      let grandTotal = 0;
      roots.forEach((r) => {
        grandTotal += calcTotal(r, 1);
      });
      return { items: roots, total: grandTotal };
    };

    const assets = buildTree("ASSET");
    const liabilities = buildTree("LIABILITY");
    const equity = buildTree("EQUITY");
    const totalLiabEquity = liabilities.total + equity.total;

    res.json({
      assets,
      liabilities,
      equity,
      balance: assets.total - totalLiabEquity,
      as_of_date: asOfDate,
    });
  } catch (e) {
    next(e);
  }
};

export const profitAndLossReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    // 1. Fetch all INCOME and EXPENSE groups
    const groups = await query(
      `SELECT id, code, name, nature, parent_id 
       FROM fin_account_groups 
       WHERE company_id = :companyId AND nature IN ('INCOME', 'EXPENSE') AND is_active = 1`,
      { companyId },
    );

    // 2. Fetch all accounts with balances for the period
    const accountBalances = await query(
      `SELECT a.id as account_id, a.code as account_code, a.name as account_name, a.group_id, g.nature,
              SUM(COALESCE(vl.debit, 0)) AS debit,
              SUM(COALESCE(vl.credit, 0)) AS credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('INCOME', 'EXPENSE')
       GROUP BY a.id, a.code, a.name, a.group_id, g.nature
       ORDER BY a.code ASC`,
      { companyId, branchId: branchId || null, from, to },
    );

    const buildTree = (nature) => {
      const filteredGroups = groups.filter((g) => g.nature === nature);
      const filteredAccounts = accountBalances.filter(
        (a) => a.nature === nature,
      );

      const groupMap = new Map();
      filteredGroups.forEach((g) => {
        groupMap.set(g.id, {
          ...g,
          type: "group",
          children: [],
          accounts: [],
          amount: 0,
          level: 0,
        });
      });

      const roots = [];
      filteredGroups.forEach((g) => {
        const node = groupMap.get(g.id);
        if (g.parent_id && groupMap.has(g.parent_id)) {
          groupMap.get(g.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      filteredAccounts.forEach((a) => {
        const amt =
          nature === "INCOME"
            ? Number(a.credit || 0) - Number(a.debit || 0)
            : Number(a.debit || 0) - Number(a.credit || 0);
        const accNode = { ...a, type: "account", amount: amt };
        if (groupMap.has(a.group_id)) {
          groupMap.get(a.group_id).accounts.push(accNode);
        }
      });

      const calcTotal = (node, level) => {
        node.level = level;
        let total = 0;
        node.accounts.forEach((a) => {
          a.level = level + 1;
          total += Number(a.amount || 0);
        });
        node.children.forEach((c) => {
          total += calcTotal(c, level + 1);
        });
        node.amount = total;
        return total;
      };

      let grandTotal = 0;
      roots.forEach((r) => {
        grandTotal += calcTotal(r, 1);
      });

      return { items: roots, total: grandTotal };
    };

    const income = buildTree("INCOME");
    const expenses = buildTree("EXPENSE");

    res.json({
      income,
      expenses,
      net_profit: income.total - expenses.total,
    });
  } catch (e) {
    next(e);
  }
};

export const ratioAnalysisReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const asOf = req.query.to
      ? String(req.query.to)
      : new Date().toISOString().split("T")[0];

    // Get balance sheet data for ratio calculations
    const bsData = await query(
      `SELECT g.nature, 
              SUM(COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) AS balance
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND v.voucher_date <= :asOf
          AND v.status = 'POSTED'
       WHERE a.company_id = :companyId
         AND a.is_active = 1
       GROUP BY g.nature`,
      { companyId, branchId: branchId || null, asOf },
    );

    // Get P&L data for profitability ratios
    const plData = await query(
      `SELECT g.nature,
              SUM(COALESCE(vl.debit, 0)) AS debit,
              SUM(COALESCE(vl.credit, 0)) AS credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND v.voucher_date <= :asOf
          AND v.status = 'POSTED'
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('INCOME', 'EXPENSE')
       GROUP BY g.nature`,
      { companyId, branchId: branchId || null, asOf },
    );

    // Calculate balances by nature
    const balances = {};
    bsData.forEach((row) => {
      balances[row.nature] = Number(row.balance || 0);
    });

    // Calculate P&L totals
    let income = 0,
      expenses = 0;
    plData.forEach((row) => {
      if (row.nature === "INCOME") {
        income = Number(row.credit || 0) - Number(row.debit || 0);
      } else if (row.nature === "EXPENSE") {
        expenses = Number(row.debit || 0) - Number(row.credit || 0);
      }
    });

    const netProfit = income - expenses;

    // Get detailed asset/liability breakdown
    const currentAssets = Math.abs(balances["ASSET"] || 0);
    const currentLiabilities = Math.abs(balances["LIABILITY"] || 0);
    const equity = Math.abs(balances["EQUITY"] || 0);
    const totalLiabilities = currentLiabilities;

    // Calculate ratios
    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio =
      currentLiabilities > 0 ? (currentAssets * 0.7) / currentLiabilities : 0; // Approximation
    const debtToEquity = equity > 0 ? totalLiabilities / equity : 0;
    const returnOnSales = income > 0 ? netProfit / income : 0;
    const returnOnAssets =
      (balances["ASSET"] || 1) !== 0
        ? netProfit / Math.abs(balances["ASSET"] || 1)
        : 0;
    const assetTurnover =
      income > 0 && (balances["ASSET"] || 0) !== 0
        ? income / Math.abs(balances["ASSET"] || 1)
        : 0;

    const items = [
      {
        code: "CUR",
        name: "Current Ratio",
        value: Number(currentRatio.toFixed(2)),
        description:
          "Current Assets / Current Liabilities. Ability to pay short-term obligations. Benchmark: > 1.5",
      },
      {
        code: "QCK",
        name: "Quick Ratio",
        value: Number(quickRatio.toFixed(2)),
        description:
          "Quick Assets / Current Liabilities. Immediate liquidity position. Benchmark: > 1.0",
      },
      {
        code: "DE",
        name: "Debt-to-Equity",
        value: Number(debtToEquity.toFixed(2)),
        description:
          "Total Liabilities / Equity. Financial leverage indicator. Benchmark: < 2.0",
      },
      {
        code: "ROS",
        name: "Return on Sales",
        value: Number(returnOnSales.toFixed(2)),
        description:
          "Net Profit / Total Income. Operating efficiency margin. Benchmark: > 0.10",
      },
      {
        code: "ROA",
        name: "Return on Assets",
        value: Number(returnOnAssets.toFixed(2)),
        description:
          "Net Profit / Total Assets. Asset utilization efficiency. Benchmark: > 0.05",
      },
      {
        code: "ATO",
        name: "Asset Turnover",
        value: Number(assetTurnover.toFixed(2)),
        description:
          "Total Income / Total Assets. Revenue generation efficiency. Benchmark: > 0.5",
      },
    ];
    res.json({ items, asOf });
  } catch (e) {
    next(e);
  }
};

export const chartOfAccountsGraphical = async (req, res, next) => {
  try {
    const { companyId } = req.scope;

    // Fetch all groups
    const groups = await query(
      "SELECT id, code, name, nature, parent_id FROM fin_account_groups WHERE company_id = :companyId ORDER BY code",
      { companyId },
    );

    // Fetch all accounts with current balances
    const accounts = await query(
      `SELECT a.id, a.group_id, a.code, a.name,
              SUM(COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) AS balance
         FROM fin_accounts a
         LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
         LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.status = 'POSTED'
        WHERE a.company_id = :companyId
        GROUP BY a.id, a.group_id, a.code, a.name
        ORDER BY a.code`,
      { companyId },
    );

    const groupMap = {};
    const roots = [];

    groups.forEach((g) => {
      groupMap[g.id] = {
        key: `group-${g.id}`,
        title: g.name,
        code: g.code,
        nature: g.nature,
        isGroup: true,
        children: [],
      };
    });

    accounts.forEach((a) => {
      const node = {
        key: `account-${a.id}`,
        title: a.name,
        code: a.code,
        balance: a.balance,
        isAccount: true,
        nature: groupMap[a.group_id]?.nature,
      };
      if (groupMap[a.group_id]) {
        groupMap[a.group_id].children.push(node);
      }
    });

    groups.forEach((g) => {
      if (g.parent_id && groupMap[g.parent_id]) {
        groupMap[g.parent_id].children.push(groupMap[g.id]);
      } else {
        roots.push(groupMap[g.id]);
      }
    });

    res.json({ items: roots });
  } catch (e) {
    next(e);
  }
};

export const supplierOutstandingReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const asOf = req.query.asOf
      ? String(req.query.asOf)
      : new Date().toISOString().split("T")[0];
    const supplierId = req.query.supplierId
      ? Number(req.query.supplierId)
      : null;

    const bills = await query(
      `SELECT b.id, b.bill_no, b.bill_date, b.due_date, b.net_amount AS total_amount,
              COALESCE(b.amount_paid, 0) AS paid,
              (b.net_amount - COALESCE(b.amount_paid, 0)) AS outstanding,
              s.id AS supplier_id, s.supplier_name, s.supplier_code,
              DATEDIFF(:asOf, COALESCE(b.due_date, b.bill_date)) AS days_overdue
       FROM pur_bills b
       LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
       WHERE b.company_id = :companyId
         AND (:branchId IS NULL OR b.branch_id = :branchId)
         AND b.bill_date <= :asOf
         AND b.status IN ('POSTED', 'APPROVED', 'PARTIAL')
         AND (b.net_amount - COALESCE(b.amount_paid, 0)) > 0.005
         AND (:supplierId IS NULL OR b.supplier_id = :supplierId)
       ORDER BY s.supplier_name ASC, b.bill_date ASC`,
      { companyId, branchId: branchId || null, asOf, supplierId },
    );

    // Compute aging
    const items = bills.map((b) => {
      const days = Number(b.days_overdue || 0);
      let aging_bucket;
      if (days <= 0) aging_bucket = "current";
      else if (days <= 30) aging_bucket = "1_30";
      else if (days <= 60) aging_bucket = "31_60";
      else if (days <= 90) aging_bucket = "61_90";
      else aging_bucket = "over_90";
      return { ...b, days_overdue: days, aging_bucket };
    });

    // Group by supplier for summary
    const supplierMap = new Map();
    items.forEach((r) => {
      const sid = r.supplier_id || "UNKNOWN";
      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name || "Unknown",
          supplier_code: r.supplier_code || "",
          current: 0,
          "1_30": 0,
          "31_60": 0,
          "61_90": 0,
          over_90: 0,
          total: 0,
        });
      }
      const sup = supplierMap.get(sid);
      sup[r.aging_bucket] =
        (sup[r.aging_bucket] || 0) + Number(r.outstanding || 0);
      sup.total += Number(r.outstanding || 0);
    });

    const summary = Array.from(supplierMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    const totals = {
      current: 0,
      "1_30": 0,
      "31_60": 0,
      "61_90": 0,
      over_90: 0,
      total: 0,
    };
    summary.forEach((s) => {
      totals.current += s.current;
      totals["1_30"] += s["1_30"];
      totals["31_60"] += s["31_60"];
      totals["61_90"] += s["61_90"];
      totals.over_90 += s.over_90;
      totals.total += s.total;
    });

    res.json({ items, summary, totals, as_of: asOf });
  } catch (e) {
    next(e);
  }
};

export const creditorsLedgerReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups ag ON ag.id = a.group_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND (:accountId IS NULL OR vl.account_id = :accountId)
          AND v.status = 'POSTED'
          AND ag.nature = 'LIABILITY'
        ORDER BY v.voucher_date ASC, v.id ASC, vl.line_no ASC`,
      { companyId, branchId, from, to, accountId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const debtorsLedgerReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups ag ON ag.id = a.group_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND (:accountId IS NULL OR vl.account_id = :accountId)
          AND v.status = 'POSTED'
          AND ag.nature = 'ASSET'
        ORDER BY v.voucher_date ASC, v.id ASC, vl.line_no ASC`,
      { companyId, branchId, from, to, accountId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const generalLedgerReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    if (!accountId)
      throw httpError(400, "VALIDATION_ERROR", "accountId is required");
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND vl.account_id = :accountId
          AND v.status = 'POSTED'
        ORDER BY v.voucher_date ASC, v.id ASC, vl.line_no ASC`,
      { companyId, branchId, from, to, accountId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const chartOfAccountsReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { search } = req.query || {};
    const items = await query(
      `SELECT a.id, a.code, a.name, a.is_postable, a.is_active,
              g.name AS group_name, g.nature, pg.name AS parent_group_name
         FROM fin_accounts a
         JOIN fin_account_groups g ON g.id = a.group_id
         LEFT JOIN fin_account_groups pg ON pg.id = g.parent_id
        WHERE a.company_id = :companyId
          AND (:search IS NULL OR a.name LIKE :searchLike OR a.code LIKE :searchLike OR g.name LIKE :searchLike)
        ORDER BY g.code ASC, a.code ASC`,
      { companyId, search, searchLike: search ? `%${search}%` : null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const bankReconciliationReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { bankAccountId, from, to, reconciled } = req.query || {};
    if (!bankAccountId)
      throw httpError(400, "VALIDATION_ERROR", "bankAccountId is required");

    let reconciledFilter = "";
    if (reconciled === "reconciled")
      reconciledFilter = "AND vl.reconciliation_id IS NOT NULL";
    else if (reconciled === "not_reconciled")
      reconciledFilter = "AND vl.reconciliation_id IS NULL";

    const items = await query(
      `SELECT v.voucher_no, v.voucher_date, vl.description AS narration,
              oa.name AS offset_account_name, vl.debit, vl.credit,
              vl.cheque_no AS cheque_number, vl.cheque_date,
              CASE WHEN vl.reconciliation_id IS NOT NULL THEN 'Reconciled' ELSE 'Unpresented' END AS status
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id
         LEFT JOIN fin_accounts oa ON oa.id = (
           SELECT account_id FROM fin_voucher_lines WHERE voucher_id = vl.voucher_id AND account_id <> vl.account_id LIMIT 1
         )
         JOIN fin_bank_accounts ba ON ba.gl_account_id = vl.account_id
        WHERE v.company_id = :companyId
          AND ba.id = :bankAccountId
          AND (:branchId IS NULL OR v.branch_id = :branchId)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
          ${reconciledFilter}
        ORDER BY v.voucher_date ASC, v.id ASC`,
      { companyId, branchId, bankAccountId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

// Banking & PDC Management
export const listBankAccounts = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const items = await query(
      `SELECT id, company_id, branch_id, name, bank_name, account_number, gl_account_id, currency_id, is_active
         FROM fin_bank_accounts
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR branch_id = :branchId)
        ORDER BY name ASC`,
      { companyId, branchId: branchId || null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createBankAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId || null;
    const { name, bankName, accountNumber, glAccountId, currencyId } =
      req.body || {};
    if (!name || !glAccountId)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "name and glAccountId are required",
      );
    await query(
      `INSERT INTO fin_bank_accounts (company_id, branch_id, name, bank_name, account_number, gl_account_id, currency_id)
       VALUES (:companyId, :branchId, :name, :bankName, :accountNumber, :glAccountId, :currencyId)`,
      {
        companyId,
        branchId,
        name,
        bankName,
        accountNumber,
        glAccountId,
        currencyId,
      },
    );
    res.status(201).json({ message: "Bank account created" });
  } catch (e) {
    next(e);
  }
};

export const listPdcPostings = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { status, bankAccountId, from, to } = req.query || {};
    const items = await query(
      `SELECT p.id, p.company_id, p.branch_id, p.bank_account_id, p.instrument_no,
              p.instrument_date, v.total_debit AS amount, v.voucher_date, p.status,
              ba.name AS bank_account_name
         FROM fin_pdc_postings p
         LEFT JOIN fin_vouchers v ON v.id = p.voucher_id
         LEFT JOIN fin_bank_accounts ba ON ba.id = p.bank_account_id
        WHERE p.company_id = :companyId
          AND (:branchId IS NULL OR p.branch_id = :branchId)
          AND (:status IS NULL OR p.status = :status)
          AND (:bankAccountId IS NULL OR p.bank_account_id = :bankAccountId)
          AND (:from IS NULL OR p.instrument_date >= :from)
          AND (:to IS NULL OR p.instrument_date <= :to)
        ORDER BY p.instrument_date DESC`,
      {
        companyId,
        branchId: branchId || null,
        status: status || null,
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        from: from || null,
        to: to || null,
      },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createPdcPosting = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const { bankAccountId, instrumentNo, instrumentDate, amount, voucherDate } =
      req.body || {};
    if (!bankAccountId || !instrumentNo || !amount)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "bankAccountId, instrumentNo, and amount are required",
      );
    const result = await query(
      `INSERT INTO fin_pdc_postings (company_id, branch_id, bank_account_id, instrument_no, instrument_date, amount, status, voucher_date)
       VALUES (:companyId, :branchId, :bankAccountId, :instrumentNo, :instrumentDate, :amount, 'PENDING', :voucherDate)`,
      {
        companyId,
        branchId,
        bankAccountId,
        instrumentNo,
        instrumentDate,
        amount,
        voucherDate: voucherDate || instrumentDate,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const listBankReconciliations = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const items = await query(
      `SELECT r.id, r.company_id, r.branch_id, r.bank_account_id, r.statement_to AS reconciliation_date,
              r.statement_ending_balance AS bank_statement_balance, 0 AS calculated_balance, r.status,
              ba.name AS bank_account_name
         FROM fin_bank_reconciliations r
         LEFT JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.company_id = :companyId
          AND (:branchId IS NULL OR r.branch_id = :branchId)
        ORDER BY r.statement_to DESC`,
      { companyId, branchId: branchId || null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createBankReconciliation = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const { bankAccountId, reconciliationDate, bankStatementBalance } =
      req.body || {};
    if (!bankAccountId || !reconciliationDate || !bankStatementBalance)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "bankAccountId, reconciliationDate, and bankStatementBalance are required",
      );
    const result = await query(
      `INSERT INTO fin_bank_reconciliations (company_id, branch_id, bank_account_id, reconciliation_date, bank_statement_balance, status)
       VALUES (:companyId, :branchId, :bankAccountId, :reconciliationDate, :bankStatementBalance, 'PENDING')`,
      {
        companyId,
        branchId,
        bankAccountId,
        reconciliationDate,
        bankStatementBalance,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const listFiscalYears = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const items = await query(
      `SELECT id, code, start_date, end_date, is_open, created_at, updated_at
         FROM fin_fiscal_years
        WHERE company_id = :companyId
        ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const forcePostableAccounts = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const result = await query(
      `UPDATE fin_accounts SET is_postable = 1 WHERE company_id = :companyId`,
      { companyId },
    );
    res.json({ updated: result.affectedRows || 0 });
  } catch (e) {
    next(e);
  }
};

export const listCostCenters = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;

    // Schema maintenance
    await query(
      `ALTER TABLE fin_cost_centers ADD COLUMN IF NOT EXISTS branch_id BIGINT UNSIGNED NULL AFTER company_id`,
    );
    await query(
      `ALTER TABLE fin_cost_centers ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`,
    );

    const items = await query(
      `SELECT id, company_id, branch_id, code, name, is_active, created_at, updated_at
         FROM fin_cost_centers
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR branch_id = :branchId)
        ORDER BY code ASC`,
      { companyId, branchId: branchId || null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCostCenter = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const { code, name, isActive } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    const result = await query(
      `INSERT INTO fin_cost_centers (company_id, branch_id, code, name, is_active)
       VALUES (:companyId, :branchId, :code, :name, :isActive)`,
      {
        companyId,
        branchId,
        code,
        name,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const listVoucherTypes = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const items = await query(
      `SELECT id, code, name, category, prefix, next_number, requires_approval, is_active
         FROM fin_voucher_types
        WHERE company_id = :companyId
        ORDER BY code ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createVoucherType = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const {
      code,
      name,
      category,
      prefix,
      next_number,
      requires_approval,
      is_active,
    } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    const result = await query(
      `INSERT INTO fin_voucher_types (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES (:companyId, :code, :name, :category, :prefix, :next_number, :requires_approval, :is_active)`,
      {
        companyId,
        code: String(code).toUpperCase(),
        name,
        category: category || "GENERAL",
        prefix: prefix || String(code).toUpperCase(),
        next_number: next_number || 1,
        requires_approval: requires_approval ? 1 : 0,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};
