import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import multer from "multer";
import * as XLSX from "xlsx";
import {
  requireIdParam,
  getNextVoucherNo,
  submitVoucher,
  syncAccounts,
  listAccountGroups,
  createTaxCode,
  updateTaxCode,
  createTaxCodeComponent,
  createCurrency,
  updateCurrency,
  listCurrencyRates,
  createCurrencyRate,
  updateCurrencyRate,
  deleteCurrencyRate,
  createFiscalYear,
  openFiscalYear,
  closeFiscalYear,
  listOpeningBalances,
  upsertOpeningBalance,
  bulkUpsertOpeningBalances,
  getAccountGroupsTree,
  createAccountGroup,
  setAccountGroupActive,
  updateAccountGroup,
} from "../controllers/finance.controller.js";

const router = express.Router();

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
    const seq =
      up === "PV" || up === "CV" || up === "RV" || up === "SV"
        ? String(vt.next_number).padStart(6, "0")
        : String(vt.next_number);
    const voucherNo = `${vt.prefix}-${seq}`;
    await conn.execute(
      "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
      { companyId, voucherTypeId },
    );
    await conn.commit();
    return voucherNo;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function ensureCostCentersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS fin_cost_centers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_fin_cost_center_scope_code (company_id, code),
      KEY idx_fin_cost_center_scope (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT id, code, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId FOR UPDATE",
    { companyId, voucherTypeId },
  );
  const vt = rows?.[0];
  if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
  const up = String(vt.code).toUpperCase();
  const seq =
    up === "PV" || up === "CV" || up === "RV" || up === "JV"
      ? String(vt.next_number).padStart(6, "0")
      : String(vt.next_number);
  const voucherNo = `${vt.prefix}-${seq}`;
  await conn.execute(
    "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
    { companyId, voucherTypeId },
  );
  return voucherNo;
}

async function ensureSalesVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "SV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'SV', 'Sales Voucher', 'SALES', 'SV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "SV" });
  return id || 0;
}

async function ensurePurchaseVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "PUV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'PUV', 'Purchase Voucher', 'PURCHASE', 'PUV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "PUV",
  });
  return id || 0;
}

async function resolveDefaultSalesAccountIdTx(conn, { companyId }) {
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

async function resolveVatOutputAccountIdTx(conn, { companyId, branchId }) {
  const [posRows] = await conn.execute(
    `SELECT tax_account_id FROM pos_tax_settings 
     WHERE company_id = :companyId 
       AND (branch_id = :branchId OR :branchId IS NULL) 
       AND is_active = 1 
     ORDER BY branch_id = :branchId DESC, id DESC 
     LIMIT 1`,
    { companyId, branchId: branchId || null },
  );
  const posAccId = Number(posRows?.[0]?.tax_account_id || 0) || 0;
  if (posAccId) return posAccId;
  const [rows] = await conn.execute(
    `
    SELECT a.id, a.name
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature IN ('LIABILITY','EQUITY')
      AND (
        LOWER(a.name) LIKE '%vat output%' OR
        LOWER(a.name) LIKE '%output vat%' OR
        LOWER(a.name) LIKE '%vat payable%' OR
        LOWER(a.name) LIKE '%tax payable%'
      )
    ORDER BY 
      CASE 
        WHEN LOWER(a.name) LIKE '%vat output%' THEN 0
        WHEN LOWER(a.name) LIKE '%output vat%' THEN 1
        WHEN LOWER(a.name) LIKE '%vat payable%' THEN 2
        WHEN LOWER(a.name) LIKE '%tax payable%' THEN 3
        ELSE 9
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function resolveVatInputAccountIdTx(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id, a.name
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature IN ('ASSET','EXPENSE')
      AND (
        LOWER(a.name) LIKE '%vat input%' OR
        LOWER(a.name) LIKE '%input vat%' OR
        LOWER(a.name) LIKE '%vat receivable%' OR
        LOWER(a.name) LIKE '%tax input%'
      )
    ORDER BY 
      CASE 
        WHEN LOWER(a.name) LIKE '%vat input%' THEN 0
        WHEN LOWER(a.name) LIKE '%input vat%' THEN 1
        WHEN LOWER(a.name) LIKE '%vat receivable%' THEN 2
        WHEN LOWER(a.name) LIKE '%tax input%' THEN 3
        ELSE 9
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function resolveDefaultPurchaseExpenseAccountIdTx(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature = 'EXPENSE'
    ORDER BY
      CASE
        WHEN a.code IN ('5000','500000') THEN 0
        WHEN LOWER(a.name) LIKE '%purchase%' THEN 1
        WHEN LOWER(a.code) LIKE '5%' THEN 2
        ELSE 3
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
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

async function ensureCustomerFinAccountIdTx(conn, { companyId, customerId }) {
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
}
router.get(
  "/vouchers/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  (req, res, next) => getNextVoucherNo(req, res, next),
);

router.post(
  "/vouchers/:voucherId/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  requireIdParam("voucherId"),
  async (req, res, next) => {
    return submitVoucher(req, res, next);
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
      const docTypePrimary = isRV
        ? "RECEIPT_VOUCHER"
        : isPV
          ? "PAYMENT_VOUCHER"
          : isCV
            ? "CONTRA_VOUCHER"
            : "VOUCHER";
      const titleName = isRV
        ? "Receipt Voucher"
        : isPV
          ? "Payment Voucher"
          : isCV
            ? "Contra Voucher"
            : "Voucher";
      const docRouteBase = isRV
        ? "/finance/receipt-voucher"
        : isPV
          ? "/finance/payment-voucher"
          : isCV
            ? "/finance/contra-voucher"
            : null;
      const typeSynonyms = isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : isPV
          ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
          : isCV
            ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
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
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
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
  },
);

router.post(
  "/accounts/sync",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => syncAccounts(req, res, next),
);

router.get(
  "/account-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  (req, res, next) => listAccountGroups(req, res, next),
);

router.post(
  "/tax-codes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createTaxCode(req, res, next),
);

router.put(
  "/tax-codes/:taxCodeId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("taxCodeId"),
  (req, res, next) => updateTaxCode(req, res, next),
);

router.post(
  "/tax-codes/:taxCodeId/components",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createTaxCodeComponent(req, res, next),
);

router.post(
  "/currencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createCurrency(req, res, next),
);

router.put(
  "/currencies/:currencyId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("currencyId"),
  (req, res, next) => updateCurrency(req, res, next),
);

router.get(
  "/currency-rates",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  (req, res, next) => listCurrencyRates(req, res, next),
);

router.post(
  "/currency-rates",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createCurrencyRate(req, res, next),
);

router.put(
  "/currency-rates/:rateId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("rateId"),
  (req, res, next) => updateCurrencyRate(req, res, next),
);

router.delete(
  "/currency-rates/:rateId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("rateId"),
  (req, res, next) => deleteCurrencyRate(req, res, next),
);

router.post(
  "/fiscal-years",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createFiscalYear(req, res, next),
);

router.post(
  "/fiscal-years/:fiscalYearId/open",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("fiscalYearId"),
  (req, res, next) => openFiscalYear(req, res, next),
);

router.post(
  "/fiscal-years/:fiscalYearId/close",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("fiscalYearId"),
  (req, res, next) => closeFiscalYear(req, res, next),
);

router.get(
  "/opening-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  (req, res, next) => listOpeningBalances(req, res, next),
);

router.post(
  "/opening-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => upsertOpeningBalance(req, res, next),
);
router.post(
  "/opening-balances/bulk",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => bulkUpsertOpeningBalances(req, res, next),
);
router.get(
  "/opening-balances/template",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const fiscalYearId = req.query.fiscalYearId
        ? Number(req.query.fiscalYearId)
        : null;
      const format = "xlsx";
      const [baseCur] = await query(
        "SELECT code FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
        { companyId },
      );
      const baseCode = String(baseCur?.code || "").trim() || "BASE";
      const rows = await query(
        `SELECT a.code AS account_code, a.name AS account_name,
                COALESCE(ob.opening_debit,0) AS opening_debit,
                COALESCE(ob.opening_credit,0) AS opening_credit
           FROM fin_accounts a
      LEFT JOIN fin_account_opening_balances ob
             ON ob.company_id = a.company_id
            AND ob.account_id = a.id
            AND (:fiscalYearId IS NOT NULL AND ob.fiscal_year_id = :fiscalYearId)
            AND (ob.branch_id IS NULL OR ob.branch_id = :branchId)
          WHERE a.company_id = :companyId
            AND a.is_postable = 1
          ORDER BY a.code ASC`,
        { companyId, branchId, fiscalYearId },
      );
      const headers = [
        "Account Code",
        "Account Name",
        `Opening Debit (${baseCode})`,
        `Opening Credit (${baseCode})`,
      ];
      const data = [headers];
      for (const r of rows) {
        const od = Math.round(Number(r.opening_debit || 0) * 100) / 100;
        const oc = Math.round(Number(r.opening_credit || 0) * 100) / 100;
        data.push([
          String(r.account_code || ""),
          String(r.account_name || ""),
          od,
          oc,
        ]);
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      // apply 2-decimal number format to debit/credit columns
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (const C of [2, 3]) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && typeof cell.v === "number") {
            cell.z = "0.00";
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "OpeningBalances");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="opening_balances_template.xlsx"',
      );
      res.send(buf);
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/cost-centers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      await ensureCostCentersTable();
      const { companyId } = req.scope;
      const items = await query(
        `SELECT id, code, name, is_active 
         FROM fin_cost_centers 
         WHERE company_id = :companyId 
         ORDER BY code ASC`,
        { companyId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/cost-centers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureCostCentersTable();
      const { companyId } = req.scope;
      const code = String(req.body?.code || "").trim();
      const name = String(req.body?.name || "").trim();
      const isActive =
        req.body?.is_active === undefined
          ? 1
          : Number(Boolean(req.body?.is_active));
      if (!code || !name) {
        throw httpError(400, "VALIDATION_ERROR", "Code and name are required");
      }
      const existing = await query(
        `SELECT id FROM fin_cost_centers 
         WHERE company_id = :companyId AND UPPER(code) = :codeUpper 
         LIMIT 1`,
        { companyId, codeUpper: code.toUpperCase() },
      );
      if (existing.length) {
        const id = Number(existing[0].id);
        await query(
          `UPDATE fin_cost_centers 
             SET name = :name, is_active = :isActive 
           WHERE id = :id AND company_id = :companyId`,
          { id, companyId, name, isActive },
        );
        res.json({ id, updated: true });
        return;
      }
      const ins = await query(
        `INSERT INTO fin_cost_centers (company_id, code, name, is_active) 
         VALUES (:companyId, :code, :name, :isActive)`,
        { companyId, code, name, isActive },
      );
      const id = Number(ins.insertId || 0) || 0;
      res.status(201).json({ id, created: true });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/account-groups/tree",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  (req, res, next) => getAccountGroupsTree(req, res, next),
);

router.post(
  "/account-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  (req, res, next) => createAccountGroup(req, res, next),
);

router.put(
  "/account-groups/:accountGroupId/active",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("accountGroupId"),
  (req, res, next) => setAccountGroupActive(req, res, next),
);

router.put(
  "/account-groups/:accountGroupId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("accountGroupId"),
  (req, res, next) => updateAccountGroup(req, res, next),
);

router.get(
  "/accounts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const groupId = req.query.groupId ? Number(req.query.groupId) : null;
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
      const postable =
        req.query.postable === "0" || req.query.postable === "1"
          ? Number(req.query.postable)
          : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      const items = await query(
        `SELECT a.id, a.code, a.name, a.group_id, g.code AS group_code, g.name AS group_name, g.nature, a.currency_id, c.code AS currency_code,
                a.is_control_account, a.is_postable, a.is_active, a.created_at, a.updated_at
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
           LEFT JOIN fin_currencies c ON c.id = a.currency_id
          WHERE a.company_id = :companyId
            AND (:groupId IS NULL OR a.group_id = :groupId)
            AND (:nature IS NULL OR g.nature = :nature)
            AND (:active IS NULL OR a.is_active = :active)
            AND (:postable IS NULL OR a.is_postable = :postable)
            AND (
              :search IS NULL OR
              a.code LIKE CONCAT('%', :search, '%') OR
              a.name LIKE CONCAT('%', :search, '%')
            )
          ORDER BY a.code ASC`,
        { companyId, groupId, nature, active, postable, search },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/accounts/force-postable",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const result = await query(
        "UPDATE fin_accounts SET is_postable = 1 WHERE company_id = :companyId",
        { companyId },
      );
      res.json({ updated: result?.affectedRows || 0 });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/accounts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const {
        groupId,
        code,
        name,
        currencyId,
        isControlAccount,
        isPostable,
        isActive,
      } = req.body || {};
      if (!groupId || !name)
        throw httpError(400, "VALIDATION_ERROR", "groupId, name are required");
      // Auto-generate code if not provided: base on group code and name token
      let effCode = code;
      if (!effCode) {
        const [gRows] = await query(
          "SELECT code FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
          { companyId, id: Number(groupId) },
        );
        const gCode = gRows?.[0]?.code || "ACC";
        const token =
          String(name || "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase()
            .slice(0, 8) || "NEW";
        if (gCode.includes(".")) effCode = `${gCode}.${token}`;
        else if (gCode.includes("_")) effCode = `${gCode}_${token}`;
        else effCode = `${gCode}.${token}`;
      }

      const result = await query(
        `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
         VALUES (:companyId, :groupId, :code, :name, :currencyId, :isControlAccount, :isPostable, :isActive)`,
        {
          companyId,
          groupId,
          code: effCode,
          name,
          currencyId: currencyId || null,
          isControlAccount: Number(Boolean(isControlAccount)),
          isPostable: 1,
          isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
        },
      );
      res.status(201).json({ id: result.insertId, code: effCode });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/accounts/:accountId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("accountId"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const id = Number(req.params.accountId);
      const { groupId, code, name, currencyId, isControlAccount, isPostable } =
        req.body || {};
      const rows = await query(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id",
        { companyId, id },
      );
      if (!rows.length)
        return next(httpError(404, "NOT_FOUND", "Account not found"));
      if (groupId !== undefined) {
        const gRows = await query(
          "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
          { companyId, id: Number(groupId) },
        );
        if (!gRows.length)
          return next(httpError(400, "VALIDATION_ERROR", "Invalid groupId"));
      }
      await query(
        `UPDATE fin_accounts
            SET group_id = COALESCE(:groupId, group_id),
                code = COALESCE(:code, code),
                name = COALESCE(:name, name),
                currency_id = COALESCE(:currencyId, currency_id),
                is_control_account = COALESCE(:isControlAccount, is_control_account),
                is_postable = COALESCE(:isPostable, is_postable)
          WHERE company_id = :companyId AND id = :id`,
        {
          companyId,
          id,
          groupId: groupId === undefined ? null : Number(groupId),
          code: code || null,
          name: name || null,
          currencyId:
            currencyId === undefined ? null : Number(currencyId || 0) || null,
          isControlAccount:
            isControlAccount === undefined
              ? null
              : Number(Boolean(isControlAccount)),
          isPostable:
            isPostable === undefined ? null : Number(Boolean(isPostable)),
        },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/accounts/:accountId/active",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("accountId"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const id = Number(req.params.accountId);
      const { isActive } = req.body || {};
      if (isActive === undefined)
        return next(httpError(400, "VALIDATION_ERROR", "isActive is required"));
      const rows = await query(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id",
        { companyId, id },
      );
      if (!rows.length)
        return next(httpError(404, "NOT_FOUND", "Account not found"));
      await query(
        "UPDATE fin_accounts SET is_active = :isActive WHERE company_id = :companyId AND id = :id",
        { companyId, id, isActive: Number(Boolean(isActive)) },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/tax-codes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items =
        (await query(
          "SELECT id, code, name, rate_percent, type, is_active, created_at, updated_at FROM fin_tax_codes WHERE company_id = :companyId ORDER BY code ASC",
          { companyId },
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/tax-codes/:taxCodeId/components",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const taxCodeId = Number(req.params.taxCodeId);
      if (!taxCodeId)
        return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
      const items = await query(
        `SELECT c.id, c.tax_detail_id, d.component_name, 
                COALESCE(c.rate_percent, d.rate_percent) AS rate_percent,
                c.sort_order, c.is_active
           FROM fin_tax_components c
           JOIN fin_tax_details d ON d.id = c.tax_detail_id
          WHERE c.company_id = :companyId
            AND c.tax_code_id = :taxCodeId
            AND c.is_active = 1
          ORDER BY c.sort_order ASC, d.component_name ASC`,
        { companyId, taxCodeId },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/tax-components/:componentId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("componentId"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const companyId = req.scope.companyId;
      const componentId = Number(req.params.componentId);
      const { componentName, ratePercent, sortOrder, isActive } =
        req.body || {};
      const [rows] = await conn.execute(
        "SELECT id, tax_detail_id FROM fin_tax_components WHERE company_id = :companyId AND id = :id",
        { companyId, id: componentId },
      );
      const comp = rows?.[0];
      if (!comp) throw httpError(404, "NOT_FOUND", "Tax component not found");
      const isCV = effVoucherTypeCode === "CV";

      if ((isRV || isPV || isCV) && !String(narration || "").trim()) {
        throw httpError(400, "VALIDATION_ERROR", "Description is mandatory");
      }

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE fin_tax_components
            SET rate_percent = COALESCE(:ratePercent, rate_percent),
                sort_order = COALESCE(:sortOrder, sort_order),
                is_active = COALESCE(:isActive, is_active)
          WHERE company_id = :companyId AND id = :id`,
        {
          companyId,
          id: componentId,
          ratePercent:
            ratePercent === undefined ? null : Number(ratePercent || 0),
          sortOrder: sortOrder === undefined ? null : Number(sortOrder || 0),
          isActive: isActive === undefined ? null : Number(Boolean(isActive)),
        },
      );
      if (componentName !== undefined) {
        await conn.execute(
          `UPDATE fin_tax_details
             SET component_name = COALESCE(:componentName, component_name),
                 is_active = COALESCE(:detailActive, is_active)
           WHERE company_id = :companyId AND id = :taxDetailId`,
          {
            companyId,
            taxDetailId: comp.tax_detail_id,
            componentName:
              componentName === null ? null : String(componentName || ""),
            detailActive:
              isActive === undefined ? null : Number(Boolean(isActive)),
          },
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
  },
);

router.delete(
  "/tax-components/:componentId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.MANAGE"),
  requireIdParam("componentId"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const companyId = req.scope.companyId;
      const componentId = Number(req.params.componentId);
      const [rows] = await conn.execute(
        "SELECT id, tax_detail_id FROM fin_tax_components WHERE company_id = :companyId AND id = :id",
        { companyId, id: componentId },
      );
      const comp = rows?.[0];
      if (!comp) throw httpError(404, "NOT_FOUND", "Tax component not found");
      await conn.beginTransaction();
      await conn.execute(
        "UPDATE fin_tax_components SET is_active = 0 WHERE company_id = :companyId AND id = :id",
        { companyId, id: componentId },
      );
      await conn.execute(
        "UPDATE fin_tax_details SET is_active = 0 WHERE company_id = :companyId AND id = :taxDetailId",
        { companyId, taxDetailId: comp.tax_detail_id },
      );
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
  },
);

router.get(
  "/currencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        "SELECT id, code, name, symbol, is_base, is_active, created_at, updated_at FROM fin_currencies WHERE company_id = :companyId ORDER BY is_base DESC, code ASC",
        { companyId },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/item-tax/:itemId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const itemId = Number(req.params.itemId);
      if (!itemId) throw httpError(400, "VALIDATION_ERROR", "Invalid itemId");
      const rows = await query(
        `
        SELECT d.item_id, t.id AS tax_id, t.code AS tax_code, t.name AS tax_name, t.rate_percent AS tax_rate
        FROM fin_item_taxes d
        JOIN fin_tax_codes t ON t.id = d.tax_id
        WHERE d.company_id = :companyId AND d.item_id = :itemId AND d.is_active = 1
        LIMIT 1
        `,
        { companyId, itemId },
      );
      if (!rows.length) {
        return res.json({ itemId, tax: null });
      }
      const r = rows[0];
      res.json({
        itemId: r.item_id,
        tax: {
          id: r.tax_id,
          tax_code: r.tax_code,
          tax_name: r.tax_name,
          tax_rate: r.tax_rate,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/fiscal-years",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.COA.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        "SELECT id, code, start_date, end_date, is_open, created_at, updated_at FROM fin_fiscal_years WHERE company_id = :companyId ORDER BY start_date DESC",
        { companyId },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/voucher-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const code = req.query.code ? String(req.query.code) : null;
      const items = await query(
        "SELECT id, code, name, category, prefix, next_number, requires_approval, is_active FROM fin_voucher_types WHERE company_id = :companyId AND (:code IS NULL OR code = :code) ORDER BY code ASC",
        { companyId, code },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/voucher-types",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
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
      const trimmedCode = String(code || "")
        .trim()
        .toUpperCase();
      const trimmedName = String(name || "").trim();
      const trimmedCategory = String(category || "")
        .trim()
        .toUpperCase();
      const trimmedPrefix =
        String(prefix || "")
          .trim()
          .toUpperCase() || trimmedCode;
      if (!trimmedCode || !trimmedName || !trimmedCategory) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "code, name, category are required",
        );
      }
      await conn.beginTransaction();
      const existingId = await resolveVoucherTypeIdByCode(conn, {
        companyId,
        code: trimmedCode,
      });
      if (existingId) {
        await conn.commit();
        return res.status(200).json({ id: existingId });
      }
      try {
        await conn.execute(
          `INSERT INTO fin_voucher_types
            (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
           VALUES
            (:companyId, :code, :name, :category, :prefix, :next_number, :requires_approval, :is_active)`,
          {
            companyId,
            code: trimmedCode,
            name: trimmedName,
            category: trimmedCategory,
            prefix: trimmedPrefix,
            next_number: Number(next_number || (trimmedCode === "RV" ? 2 : 1)),
            requires_approval: Number(requires_approval || 0),
            is_active: Number(is_active === undefined ? 1 : is_active ? 1 : 0),
          },
        );
      } catch (e) {
        if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
      }
      const id = await resolveVoucherTypeIdByCode(conn, {
        companyId,
        code: trimmedCode,
      });
      await conn.commit();
      if (!id) {
        throw httpError(500, "SERVER_ERROR", "Failed to create voucher type");
      }
      res.status(201).json({ id });
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
  "/vouchers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const voucherTypeCode = req.query.voucherTypeCode
        ? String(req.query.voucherTypeCode)
        : null;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const orderDir =
        String(req.query.order || "")
          .trim()
          .toLowerCase() === "old"
          ? "ASC"
          : "DESC";

      const items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, v.narration, v.total_debit, v.total_credit, v.status,
                vt.code AS voucher_type_code, vt.name AS voucher_type_name,
                u.username AS forwarded_to_username,
                (SELECT COUNT(*) 
                 FROM fin_voucher_lines vl 
                 WHERE vl.voucher_id = v.id 
                   AND vl.payment_method = 'Cheque' 
                   AND vl.cheque_date > v.voucher_date) AS has_future_cheque
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
           LEFT JOIN (
             SELECT t.document_id, t.assigned_to_user_id
             FROM adm_document_workflows t
             JOIN (
               SELECT document_id, MAX(id) AS max_id
               FROM adm_document_workflows
               WHERE company_id = :companyId
                 AND status = 'PENDING'
                 AND (
                  document_type IN ('PAYMENT_VOUCHER','RECEIPT_VOUCHER','CONTRA_VOUCHER','JOURNAL_VOUCHER') OR
                  document_type IN ('Payment Voucher','Receipt Voucher','Contra Voucher','Journal Voucher') OR
                  document_type IN ('PV','RV','CV','JV')
                 )
               GROUP BY document_id
             ) m ON m.max_id = t.id
           ) x ON x.document_id = v.id
           LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (:voucherTypeCode IS NULL OR vt.code = :voucherTypeCode)
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ${orderDir}, v.id ${orderDir}`,
        { companyId, branchId, voucherTypeCode, from, to },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/vouchers/:voucherId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  requireIdParam("voucherId"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const voucherId = Number(req.params.voucherId);

      const vouchers = await query(
        `SELECT v.*, vt.code AS voucher_type_code, vt.name AS voucher_type_name
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId AND v.branch_id = :branchId AND v.id = :voucherId`,
        { companyId, branchId, voucherId },
      );
      const voucher = vouchers?.[0];
      if (!voucher) throw httpError(404, "NOT_FOUND", "Voucher not found");

      const lines = await query(
        `SELECT l.id, l.line_no, l.account_id, a.code AS account_code, a.name AS account_name, l.description, l.debit, l.credit, l.tax_code_id, l.reference_no, l.payment_method
           FROM fin_voucher_lines l
           JOIN fin_accounts a ON a.id = l.account_id
          WHERE l.voucher_id = :voucherId
          ORDER BY l.line_no ASC`,
        { voucherId },
      );

      res.json({ voucher, lines });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/vouchers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const {
        voucherTypeId,
        voucherTypeCode,
        voucherDate,
        narration,
        fiscalYearId,
        currencyId,
        exchangeRate,
        lines,
        apply_to_purchase_bills,
        apply_to_service_bills,
      } = req.body || {};
      if (!voucherTypeId && !voucherTypeCode) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "voucherTypeId or voucherTypeCode is required",
        );
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        throw httpError(400, "VALIDATION_ERROR", "lines are required");
      }

      let effVoucherTypeId = Number(voucherTypeId || 0);
      if (!effVoucherTypeId && voucherTypeCode) {
        const code = String(voucherTypeCode).trim().toUpperCase();
        const existingId = await resolveVoucherTypeIdByCode(conn, {
          companyId,
          code,
        });
        if (existingId) {
          effVoucherTypeId = existingId;
        } else {
          const name =
            code === "PV"
              ? "Payment Voucher"
              : code === "RV"
                ? "Receipt Voucher"
                : code === "CV"
                  ? "Contra Voucher"
                  : code === "CN"
                    ? "Credit Note"
                    : code === "DN"
                      ? "Debit Note"
                      : "Voucher";
          const category =
            code === "PV" ? "PAYMENT" : code === "RV" ? "RECEIPT" : "JOURNAL";
          await conn.beginTransaction();
          try {
            await conn.execute(
              `INSERT INTO fin_voucher_types
                (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
               VALUES
                (:companyId, :code, :name, :category, :prefix, :next_number, 0, 1)`,
              {
                companyId,
                code,
                name,
                category,
                prefix: code,
                next_number: code === "RV" ? 2 : 1,
              },
            );
          } catch (e) {
            if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
          }
          const createdId = await resolveVoucherTypeIdByCode(conn, {
            companyId,
            code,
          });
          await conn.commit();
          effVoucherTypeId = createdId || 0;
        }
      }
      if (!effVoucherTypeId) {
        throw httpError(400, "VALIDATION_ERROR", "Voucher type not configured");
      }

      let effVoucherTypeCode = String(voucherTypeCode || "")
        .trim()
        .toUpperCase();
      if (!effVoucherTypeCode) {
        const [vtRows] = await conn.execute(
          "SELECT code FROM fin_voucher_types WHERE company_id = :companyId AND id = :id LIMIT 1",
          { companyId, id: effVoucherTypeId },
        );
        effVoucherTypeCode = String(vtRows?.[0]?.code || "")
          .trim()
          .toUpperCase();
      }

      const voucherDateObj = voucherDate ? new Date(voucherDate) : new Date();
      const voucherDateYmd = toYmd(voucherDateObj);
      const effFiscalYearId =
        Number(fiscalYearId || 0) ||
        (await resolveFiscalYearIdForDate(conn, {
          companyId,
          dateYmd: voucherDateYmd,
        }));
      if (!effFiscalYearId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Fiscal year could not be resolved",
        );
      }

      const totals = lines.reduce(
        (acc, l) => {
          acc.debit += Number(l.debit || 0);
          acc.credit += Number(l.credit || 0);
          return acc;
        },
        { debit: 0, credit: 0 },
      );

      if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Total debit must equal total credit",
        );
      }

      const voucherNo = await nextVoucherNo({
        companyId,
        voucherTypeId: effVoucherTypeId,
      });

      const isRV = effVoucherTypeCode === "RV";
      const isPV = effVoucherTypeCode === "PV";
      const invoiceApplyMap = new Map();
      if (isRV) {
        for (const l of lines) {
          const credit = Number(l.credit || 0);
          const ref = String(l.referenceNo || l.reference_no || "").trim();
          const accId = Number(l.accountId || 0);
          if (!(credit > 0 && ref)) continue;
          const [invRows] = await conn.execute(
            "SELECT id, invoice_no, customer_id, total_amount, balance_amount, payment_status FROM sal_invoices WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :ref LIMIT 1",
            { companyId, branchId, ref },
          );
          const inv = invRows?.[0] || null;
          if (!inv) {
            throw httpError(404, "NOT_FOUND", `Invoice ${ref} not found`);
          }
          const custAccId = await ensureCustomerFinAccountIdTx(conn, {
            companyId,
            customerId: Number(inv.customer_id),
          });
          if (!custAccId || String(custAccId) !== String(accId)) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Account does not match invoice customer for ${ref}`,
            );
          }
          const bal = Math.round(Number(inv.balance_amount || 0) * 100) / 100;
          if (credit > bal) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Payment exceeds invoice balance for ${ref}`,
            );
          }
          const key = String(inv.id);
          const prev = invoiceApplyMap.get(key) || 0;
          if (prev + credit > bal + 1e-9) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Total payments exceed invoice balance for ${ref}`,
            );
          }
          invoiceApplyMap.set(key, prev + credit);
        }
      }
      const billApplyMap = new Map();
      if (isPV && Array.isArray(apply_to_purchase_bills)) {
        for (const entry of apply_to_purchase_bills) {
          const billId = Number(entry.bill_id || 0);
          const amount = Number(entry.amount || 0);
          if (!billId || !(amount > 0)) continue;
          const key = String(billId);
          const prev = billApplyMap.get(key) || 0;
          billApplyMap.set(key, prev + amount);
        }
      }
      const serviceBillApplyMap = new Map();
      if (isPV && Array.isArray(apply_to_service_bills)) {
        for (const entry of apply_to_service_bills) {
          const billId = Number(entry.bill_id || 0);
          const amount = Number(entry.amount || 0);
          if (!billId || !(amount > 0)) continue;
          const key = String(billId);
          const prev = serviceBillApplyMap.get(key) || 0;
          serviceBillApplyMap.set(key, prev + amount);
        }
      }

      const isCV = effVoucherTypeCode === "CV";
      if ((isRV || isPV || isCV) && !String(narration || "").trim()) {
        throw httpError(400, "VALIDATION_ERROR", "Description is mandatory");
      }

      const createdAt = new Date();
      const createdBy = req.user?.sub || null;

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, created_at)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, 'DRAFT', :createdBy, :createdAt)`,
        {
          companyId,
          branchId,
          fiscalYearId: effFiscalYearId,
          voucherTypeId: effVoucherTypeId,
          voucherNo,
          voucherDate: voucherDateYmd,
          narration: narration || null,
          currencyId: currencyId || null,
          exchangeRate: exchangeRate || 1,
          totalDebit: totals.debit,
          totalCredit: totals.credit,
          createdBy,
          createdAt,
        },
      );
      const voucherId = result.insertId;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, cheque_number, cheque_date, payment_method)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo, :chequeNumber, :chequeDate, :paymentMethod)`,
          {
            companyId,
            voucherId,
            lineNo: i + 1,
            accountId: Number(l.accountId),
            description: l.description || null,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            taxCodeId: l.taxCodeId || null,
            costCenter: l.costCenter || null,
            referenceNo: l.referenceNo || null,
            chequeNumber: l.chequeNumber || null,
            chequeDate: l.chequeDate || null,
            paymentMethod: l.paymentMethod || null,
          },
        );

        // TASK 3: Automatic PDC creation for PV/RV if cheque date is in future
        if (
          (isPV || isRV) &&
          String(l.paymentMethod).toLowerCase() === "cheque" &&
          l.chequeDate
        ) {
          const cDate = new Date(l.chequeDate);
          const vDate = new Date(voucherDateYmd);
          if (cDate > vDate) {
            await conn.execute(
              `INSERT INTO fin_pdc_postings
                (company_id, branch_id, voucher_id, instrument_no, instrument_date, bank_account_id, status, created_at, created_by)
               VALUES
                (:companyId, :branchId, :voucherId, :instrumentNo, :instrumentDate, :bankAccountId, 'HELD', :createdAt, :createdBy)`,
              {
                companyId,
                branchId,
                voucherId,
                instrumentNo: l.chequeNumber || "",
                instrumentDate: l.chequeDate,
                bankAccountId: Number(l.accountId),
                createdAt,
                createdBy,
              },
            );
          }
        }
      }

      if (isRV && invoiceApplyMap.size) {
        for (const [invIdStr, amount] of invoiceApplyMap.entries()) {
          const invId = Number(invIdStr);
          const [curRows] = await conn.execute(
            "SELECT balance_amount FROM sal_invoices WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
            { id: invId, companyId, branchId },
          );
          const bal =
            Math.round(Number(curRows?.[0]?.balance_amount || 0) * 100) / 100;
          const newBal = Math.round((bal - amount) * 100) / 100;
          await conn.execute(
            `UPDATE sal_invoices
               SET balance_amount = :balance,
                   payment_status = :pstatus
             WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            {
              id: invId,
              companyId,
              branchId,
              balance: newBal,
              pstatus: newBal <= 0 ? "PAID" : "PARTIALLY_PAID",
            },
          );
          const [hdrRows] = await conn.execute(
            "SELECT invoice_no, invoice_date, net_amount FROM sal_invoices WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
            { id: invId, companyId, branchId },
          );
          const invNo = String(hdrRows?.[0]?.invoice_no || "");
          const invDate = hdrRows?.[0]?.invoice_date || voucherDateYmd;
          const invGross = Number(hdrRows?.[0]?.net_amount || 0);
          let invNetBase = invGross;
          try {
            const [sumRows] = await conn.execute(
              "SELECT COALESCE(SUM(net_amount),0) AS net_sum FROM sal_invoice_details WHERE invoice_id = :id",
              { id: invId },
            );
            const netSum = Number(sumRows?.[0]?.net_sum || 0);
            if (netSum > 0 && invGross >= netSum) invNetBase = netSum;
          } catch {}
          const vatAmtFull = Math.max(
            0,
            Math.round((invGross - invNetBase) * 100) / 100,
          );
          const applied = Math.max(0, Number(amount || 0));
          if (invNo && applied > 0) {
            const refKey = `${invNo}|${voucherNo}`;
            const [existsRows] = await conn.execute(
              `
              SELECT v.id
              FROM fin_vouchers v
              JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
              JOIN fin_voucher_lines l ON l.voucher_id = v.id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND vt.code = 'SV'
                AND l.reference_no = :ref
              LIMIT 1
              `,
              { companyId, branchId, ref: refKey },
            );
            if (!existsRows?.length) {
              const bankLine = (lines || []).find(
                (x) => Number(x.debit || 0) > 0 && Number(x.accountId || 0) > 0,
              );
              const bankAccountId = Number(bankLine?.accountId || 0);
              if (bankAccountId) {
                const salesAccountId = await resolveDefaultSalesAccountIdTx(
                  conn,
                  { companyId },
                );
                const vatOutputAccountId =
                  vatAmtFull > 0
                    ? await resolveVatOutputAccountIdTx(conn, {
                        companyId,
                        branchId,
                      })
                    : 0;
                // Pro-rate VAT and base according to applied amount
                let basePart = applied;
                let vatPart = 0;
                if (invGross > 0 && vatAmtFull > 0) {
                  const p = Math.min(1, applied / invGross);
                  vatPart = Math.round(vatAmtFull * p * 100) / 100;
                  basePart = Math.round((applied - vatPart) * 100) / 100;
                  if (basePart < 0) basePart = 0;
                }
                const svTypeId = await ensureSalesVoucherTypeIdTx(conn, {
                  companyId,
                });
                const fyId = await resolveFiscalYearIdForDate(conn, {
                  companyId,
                  dateYmd: toYmd(new Date(invDate || voucherDateYmd)),
                });
                const svVoucherNo = await nextVoucherNoTx(conn, {
                  companyId,
                  voucherTypeId: svTypeId,
                });
                const [svHdr] = await conn.execute(
                  `INSERT INTO fin_vouchers
                    (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
                   VALUES
                    (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :td, :tc, 'DRAFT', :createdBy)`,
                  {
                    companyId,
                    branchId,
                    fiscalYearId: fyId,
                    voucherTypeId: svTypeId,
                    voucherNo: svVoucherNo,
                    voucherDate: toYmd(new Date(invDate || voucherDateYmd)),
                    narration: narration,
                    td: applied,
                    tc: applied,
                    createdBy: req.user?.sub || null,
                  },
                );
                const svId = Number(svHdr.insertId || 0);
                let lineNo = 1;
                await conn.execute(
                  `INSERT INTO fin_voucher_lines
                    (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                   VALUES
                    (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref, :paymentMethod)`,
                  {
                    companyId,
                    voucherId: svId,
                    lineNo: lineNo++,
                    accountId: bankAccountId,
                    description: narration,
                    debit: applied,
                    ref: refKey,
                    paymentMethod: "Bank Transfer",
                  },
                );
                await conn.execute(
                  `INSERT INTO fin_voucher_lines
                    (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                   VALUES
                    (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref, :paymentMethod)`,
                  {
                    companyId,
                    voucherId: svId,
                    lineNo: lineNo++,
                    accountId: salesAccountId || bankAccountId,
                    description: narration,
                    credit: basePart,
                    ref: refKey,
                    paymentMethod: "Bank Transfer",
                  },
                );
                if (vatPart > 0 && vatOutputAccountId) {
                  await conn.execute(
                    `INSERT INTO fin_voucher_lines
                      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                     VALUES
                      (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref, :paymentMethod)`,
                    {
                      companyId,
                      voucherId: svId,
                      lineNo: lineNo++,
                      accountId: vatOutputAccountId,
                      description: narration,
                      credit: vatPart,
                      ref: refKey,
                      paymentMethod: "Bank Transfer",
                    },
                  );
                }
              }
            }
          }
        }
      }
      if (isPV && billApplyMap.size) {
        try {
          if (!(await hasColumn(conn, "pur_bills", "amount_paid"))) {
            await conn.execute(
              "ALTER TABLE pur_bills ADD COLUMN amount_paid DECIMAL(18,2) DEFAULT 0",
            );
          }
        } catch {}
        try {
          if (!(await hasColumn(conn, "pur_bills", "payment_status"))) {
            await conn.execute(
              "ALTER TABLE pur_bills ADD COLUMN payment_status ENUM('UNPAID','PARTIALLY_PAID','PAID') NULL",
            );
          }
        } catch {}
        for (const [billIdStr, amount] of billApplyMap.entries()) {
          const billId = Number(billIdStr);
          const [curRows] = await conn.execute(
            "SELECT net_amount, COALESCE(amount_paid,0) AS amount_paid FROM pur_bills WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
            { id: billId, companyId, branchId },
          );
          if (!curRows?.length) {
            throw httpError(
              404,
              "NOT_FOUND",
              `Purchase bill ${billId} not found`,
            );
          }
          const netAmt = Number(curRows[0].net_amount || 0);
          const alreadyPaid = Number(curRows[0].amount_paid || 0);
          const newPaid = alreadyPaid + amount;
          if (newPaid - netAmt > 1e-6) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "Payment amount exceeds bill balance",
            );
          }
          let newStatus = "UNPAID";
          if (newPaid <= 0) newStatus = "UNPAID";
          else if (Math.abs(newPaid - netAmt) <= 1e-6) newStatus = "PAID";
          else newStatus = "PARTIALLY_PAID";
          await conn.execute(
            `UPDATE pur_bills
               SET amount_paid = :amountPaid,
                   payment_status = :status
             WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            {
              id: billId,
              companyId,
              branchId,
              amountPaid: newPaid,
              status: newStatus,
            },
          );
          if (newStatus === "PAID") {
            const [hdrRows] = await conn.execute(
              "SELECT bill_no, bill_date, net_amount, tax_amount FROM pur_bills WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
              { id: billId, companyId, branchId },
            );
            const billNo = String(hdrRows?.[0]?.bill_no || "");
            const billDate = hdrRows?.[0]?.bill_date || voucherDateYmd;
            const grossAmt = Number(hdrRows?.[0]?.net_amount || 0);
            const vatAmt = Math.max(0, Number(hdrRows?.[0]?.tax_amount || 0));
            if (billNo && grossAmt > 0) {
              const [existsRows] = await conn.execute(
                `
                SELECT v.id
                FROM fin_vouchers v
                JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
                JOIN fin_voucher_lines l ON l.voucher_id = v.id
                WHERE v.company_id = :companyId
                  AND v.branch_id = :branchId
                  AND vt.code = 'PUV'
                  AND l.reference_no = :ref
                LIMIT 1
                `,
                { companyId, branchId, ref: billNo },
              );
              if (!existsRows?.length) {
                const bankLine = (lines || []).find(
                  (x) =>
                    Number(x.credit || 0) > 0 && Number(x.accountId || 0) > 0,
                );
                const bankAccountId = Number(bankLine?.accountId || 0);
                const expenseAccountId =
                  await resolveDefaultPurchaseExpenseAccountIdTx(conn, {
                    companyId,
                  });
                const vatInputAccountId = vatAmt
                  ? await resolveVatInputAccountIdTx(conn, { companyId })
                  : 0;
                const puvTypeId = await ensurePurchaseVoucherTypeIdTx(conn, {
                  companyId,
                });
                const fyId = await resolveFiscalYearIdForDate(conn, {
                  companyId,
                  dateYmd: toYmd(new Date(billDate || voucherDateYmd)),
                });
                const puvNo = await nextVoucherNoTx(conn, {
                  companyId,
                  voucherTypeId: puvTypeId,
                });
                const [pvHdr] = await conn.execute(
                  `INSERT INTO fin_vouchers
                    (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
                   VALUES
                    (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :td, :tc, 'DRAFT', :createdBy)`,
                  {
                    companyId,
                    branchId,
                    fiscalYearId: fyId,
                    voucherTypeId: puvTypeId,
                    voucherNo: puvNo,
                    voucherDate: toYmd(new Date(billDate || voucherDateYmd)),
                    narration: narration,
                    td: grossAmt,
                    tc: grossAmt,
                    createdBy: req.user?.sub || null,
                  },
                );
                const puvId = Number(pvHdr.insertId || 0);
                let lineNo = 1;
                await conn.execute(
                  `INSERT INTO fin_voucher_lines
                    (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                   VALUES
                    (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref, :paymentMethod)`,
                  {
                    companyId,
                    voucherId: puvId,
                    lineNo: lineNo++,
                    accountId: expenseAccountId || bankAccountId,
                    description: narration,
                    debit: Math.max(0, grossAmt - vatAmt),
                    ref: billNo,
                    paymentMethod: "Bank Transfer",
                  },
                );
                if (bankAccountId) {
                  await conn.execute(
                    `INSERT INTO fin_voucher_lines
                      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                     VALUES
                      (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref, :paymentMethod)`,
                    {
                      companyId,
                      voucherId: puvId,
                      lineNo: lineNo++,
                      accountId: bankAccountId,
                      description: narration,
                      credit: grossAmt,
                      ref: billNo,
                      paymentMethod: "Bank Transfer",
                    },
                  );
                }
                if (vatAmt > 0 && vatInputAccountId) {
                  await conn.execute(
                    `INSERT INTO fin_voucher_lines
                      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
                     VALUES
                      (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref, :paymentMethod)`,
                    {
                      companyId,
                      voucherId: puvId,
                      lineNo: lineNo++,
                      accountId: vatInputAccountId,
                      description: `VAT on ${billNo}`,
                      debit: vatAmt,
                      ref: billNo,
                      paymentMethod: "Bank Transfer",
                    },
                  );
                }
              }
            }
          }
        }
      }
      if (isPV && serviceBillApplyMap.size) {
        try {
          if (!(await hasColumn(conn, "pur_service_bills", "amount_paid"))) {
            await conn.execute(
              "ALTER TABLE pur_service_bills ADD COLUMN amount_paid DECIMAL(18,2) DEFAULT 0",
            );
          }
        } catch {}
        for (const [billIdStr, amount] of serviceBillApplyMap.entries()) {
          const billId = Number(billIdStr);
          const [curRows] = await conn.execute(
            "SELECT total_amount, COALESCE(amount_paid,0) AS amount_paid, payment, status FROM pur_service_bills WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
            { id: billId, companyId, branchId },
          );
          if (!curRows?.length) {
            throw httpError(
              404,
              "NOT_FOUND",
              `Service bill ${billId} not found`,
            );
          }
          const total = Number(curRows[0].total_amount || 0);
          const alreadyPaid = Number(curRows[0].amount_paid || 0);
          const newPaid = alreadyPaid + amount;
          if (newPaid - total > 1e-6) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "Payment amount exceeds service bill total",
            );
          }
          let newPayment = "UNPAID";
          if (newPaid <= 0) newPayment = "UNPAID";
          else if (Math.abs(newPaid - total) <= 1e-6) newPayment = "PAID";
          else newPayment = "PARTIALLY_PAID";
          const newStatus =
            newPayment === "PAID"
              ? "COMPLETED"
              : curRows[0].status || "PENDING";
          await conn.execute(
            `UPDATE pur_service_bills
               SET amount_paid = :amountPaid,
                   payment = :payment,
                   status = :status
             WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            {
              id: billId,
              companyId,
              branchId,
              amountPaid: newPaid,
              payment: newPayment,
              status: newStatus,
            },
          );
        }
      }

      await conn.commit();
      res.status(201).json({ id: voucherId, voucherNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/vouchers/backfill/tax-split",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId } = req.scope;
      await conn.beginTransaction();
      const [paidInvoices] = await conn.execute(
        `
        SELECT i.id, i.invoice_no, i.invoice_date, i.net_amount
        FROM sal_invoices i
        WHERE i.company_id = :companyId
          AND i.branch_id = :branchId
          AND i.payment_status = 'PAID'
          AND NOT EXISTS (
            SELECT 1
            FROM fin_voucher_lines l
            JOIN fin_vouchers v ON v.id = l.voucher_id AND v.company_id = i.company_id AND v.branch_id = i.branch_id
            JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
            WHERE vt.code = 'SV' AND l.reference_no = i.invoice_no
          )
        ORDER BY i.id DESC
        LIMIT 200
        `,
        { companyId, branchId },
      );
      let svCreated = 0;
      if (paidInvoices && paidInvoices.length) {
        const svTypeId = await ensureSalesVoucherTypeIdTx(conn, { companyId });
        for (const inv of paidInvoices) {
          const invId = Number(inv.id);
          const invNo = String(inv.invoice_no || "");
          const invGross = Number(inv.net_amount || 0);
          if (!invId || !invNo || !(invGross > 0)) continue;
          let base = invGross;
          try {
            const [sumRows] = await conn.execute(
              "SELECT COALESCE(SUM(net_amount),0) AS net_sum FROM sal_invoice_details WHERE invoice_id = :id",
              { id: invId },
            );
            const netSum = Number(sumRows?.[0]?.net_sum || 0);
            if (netSum > 0 && invGross >= netSum) base = netSum;
          } catch {}
          const vatAmt =
            Math.max(0, Math.round((invGross - base) * 100) / 100) || 0;
          const [bankRows] = await conn.execute(
            `
            SELECT l.account_id
            FROM fin_voucher_lines l
            JOIN fin_vouchers v ON v.id = l.voucher_id
            JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND vt.code = 'RV'
              AND l.reference_no = :ref
              AND l.debit > 0
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT 1
            `,
            { companyId, branchId, ref: invNo },
          );
          const bankAccountId = Number(bankRows?.[0]?.account_id || 0);
          const salesAccountId = await resolveDefaultSalesAccountIdTx(conn, {
            companyId,
          });
          if (!bankAccountId || !salesAccountId) continue;
          const fyId = await resolveFiscalYearIdForDate(conn, {
            companyId,
            dateYmd: toYmd(new Date(inv.invoice_date || new Date())),
          });
          const svNo = await nextVoucherNoTx(conn, {
            companyId,
            voucherTypeId: svTypeId,
          });
          const [insHdr] = await conn.execute(
            `INSERT INTO fin_vouchers
              (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
             VALUES
              (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :td, :tc, 'DRAFT', :createdBy)`,
            {
              companyId,
              branchId,
              fiscalYearId: fyId,
              voucherTypeId: svTypeId,
              voucherNo: svNo,
              voucherDate: toYmd(new Date(inv.invoice_date || new Date())),
              narration: `Invoice ${invNo} settled (backfill)`,
              td: invGross,
              tc: invGross,
              createdBy: req.user?.sub || null,
            },
          );
          const vId = Number(insHdr.insertId || 0);
          if (!vId) continue;
          let lineNo = 1;
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: bankAccountId,
              description: `Receipt for ${invNo}`,
              debit: invGross,
              ref: invNo,
            },
          );
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: salesAccountId,
              description: `Sales for ${invNo}`,
              credit: Math.max(0, invGross - vatAmt),
              ref: invNo,
            },
          );
          if (vatAmt > 0) {
            const vatAcc = await resolveVatOutputAccountIdTx(conn, {
              companyId,
              branchId,
            });
            if (vatAcc) {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
                {
                  companyId,
                  voucherId: vId,
                  lineNo: lineNo++,
                  accountId: vatAcc,
                  description: `VAT on ${invNo}`,
                  credit: vatAmt,
                  ref: invNo,
                },
              );
            }
          }
          svCreated++;
        }
      }
      const [paidBills] = await conn.execute(
        `
        SELECT b.id, b.bill_no, b.bill_date, b.net_amount, COALESCE(b.tax_amount,0) AS tax_amount
        FROM pur_bills b
        WHERE b.company_id = :companyId
          AND b.branch_id = :branchId
          AND b.payment_status = 'PAID'
          AND NOT EXISTS (
            SELECT 1
            FROM fin_voucher_lines l
            JOIN fin_vouchers v ON v.id = l.voucher_id AND v.company_id = b.company_id AND v.branch_id = b.branch_id
            JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
            WHERE vt.code = 'PUV' AND l.reference_no = b.bill_no
          )
        ORDER BY b.id DESC
        LIMIT 200
        `,
        { companyId, branchId },
      );
      let puvCreated = 0;
      if (paidBills && paidBills.length) {
        const puvTypeId = await ensurePurchaseVoucherTypeIdTx(conn, {
          companyId,
        });
        for (const bill of paidBills) {
          const billNo = String(bill.bill_no || "");
          const grossAmt = Number(bill.net_amount || 0);
          const vatAmt = Math.max(0, Number(bill.tax_amount || 0));
          if (!billNo || !(grossAmt > 0)) continue;
          const [bankRows] = await conn.execute(
            `
            SELECT l.account_id
            FROM fin_voucher_lines l
            JOIN fin_vouchers v ON v.id = l.voucher_id
            JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND vt.code = 'PV'
              AND l.reference_no = :ref
              AND l.credit > 0
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT 1
            `,
            { companyId, branchId, ref: billNo },
          );
          const bankAccountId = Number(bankRows?.[0]?.account_id || 0);
          const expenseAccountId =
            await resolveDefaultPurchaseExpenseAccountIdTx(conn, {
              companyId,
            });
          if (!bankAccountId || !expenseAccountId) continue;
          const fyId = await resolveFiscalYearIdForDate(conn, {
            companyId,
            dateYmd: toYmd(new Date(bill.bill_date || new Date())),
          });
          const puvNo = await nextVoucherNoTx(conn, {
            companyId,
            voucherTypeId: puvTypeId,
          });
          const [insHdr] = await conn.execute(
            `INSERT INTO fin_vouchers
              (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
             VALUES
              (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :td, :tc, 'DRAFT', :createdBy)`,
            {
              companyId,
              branchId,
              fiscalYearId: fyId,
              voucherTypeId: puvTypeId,
              voucherNo: puvNo,
              voucherDate: toYmd(new Date(bill.bill_date || new Date())),
              narration: `Bill ${billNo} settled (backfill)`,
              td: grossAmt,
              tc: grossAmt,
              createdBy: req.user?.sub || null,
            },
          );
          const vId = Number(insHdr.insertId || 0);
          if (!vId) continue;
          let lineNo = 1;
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: expenseAccountId,
              description: `Purchase for ${billNo}`,
              debit: Math.max(0, grossAmt - vatAmt),
              ref: billNo,
            },
          );
          if (vatAmt > 0) {
            const vatAcc = await resolveVatInputAccountIdTx(conn, {
              companyId,
            });
            if (vatAcc) {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
                {
                  companyId,
                  voucherId: vId,
                  lineNo: lineNo++,
                  accountId: vatAcc,
                  description: `VAT on ${billNo}`,
                  debit: vatAmt,
                  ref: billNo,
                },
              );
            }
          }
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: bankAccountId,
              description: `Payment for ${billNo}`,
              credit: grossAmt,
              ref: billNo,
            },
          );
          puvCreated++;
        }
      }
      const [svCandidates] = await conn.execute(
        `
        SELECT v.id, v.voucher_no
        FROM fin_vouchers v
        JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.company_id = :companyId
          AND v.branch_id = :branchId
          AND vt.code = 'SV'
          AND v.status = 'DRAFT'
        ORDER BY v.id DESC
        LIMIT 500
        `,
        { companyId, branchId },
      );
      let svUpdated = 0;
      for (const r of svCandidates || []) {
        const vid = Number(r.id);
        const [lines] = await conn.execute(
          "SELECT id, line_no, account_id, debit, credit, reference_no FROM fin_voucher_lines WHERE voucher_id = :vid ORDER BY line_no ASC",
          { vid },
        );
        if (!lines || lines.length < 2) continue;
        const ref = String(
          lines[0]?.reference_no || lines[1]?.reference_no || "",
        );
        if (!ref) continue;
        const [invRows] = await conn.execute(
          "SELECT id, net_amount FROM sal_invoices WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :ref LIMIT 1",
          { companyId, branchId, ref },
        );
        if (!invRows?.length) continue;
        const invId = Number(invRows[0].id);
        const invGross = Number(invRows[0].net_amount || 0);
        const [sumRows] = await conn.execute(
          "SELECT COALESCE(SUM(net_amount),0) AS net_sum FROM sal_invoice_details WHERE invoice_id = :id",
          { id: invId },
        );
        const base = Number(sumRows?.[0]?.net_sum || 0);
        const vatAmt = Math.max(0, Math.round((invGross - base) * 100) / 100);
        if (!(vatAmt > 0)) continue;
        const vatAcc = await resolveVatOutputAccountIdTx(conn, {
          companyId,
          branchId,
        });
        if (!vatAcc) continue;
        const creditLine = lines.find((x) => Number(x.credit || 0) > 0);
        if (!creditLine) continue;
        const newCredit = Math.max(0, Number(creditLine.credit || 0) - vatAmt);
        if (newCredit < 0) continue;
        await conn.execute(
          "UPDATE fin_voucher_lines SET credit = :credit WHERE id = :id",
          { id: creditLine.id, credit: newCredit },
        );
        const maxLineNo = Math.max(...lines.map((x) => Number(x.line_no || 0)));
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
          {
            companyId,
            voucherId: vid,
            lineNo: maxLineNo + 1,
            accountId: vatAcc,
            description: `VAT on ${ref}`,
            credit: vatAmt,
            ref,
          },
        );
        svUpdated++;
      }
      const [puvCandidates] = await conn.execute(
        `
        SELECT v.id, v.voucher_no
        FROM fin_vouchers v
        JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.company_id = :companyId
          AND v.branch_id = :branchId
          AND vt.code = 'PUV'
          AND v.status = 'DRAFT'
        ORDER BY v.id DESC
        LIMIT 500
        `,
        { companyId, branchId },
      );
      let puvUpdated = 0;
      for (const r of puvCandidates || []) {
        const vid = Number(r.id);
        const [lines] = await conn.execute(
          "SELECT id, line_no, account_id, debit, credit, reference_no FROM fin_voucher_lines WHERE voucher_id = :vid ORDER BY line_no ASC",
          { vid },
        );
        if (!lines || lines.length < 2) continue;
        const ref = String(
          lines[0]?.reference_no || lines[1]?.reference_no || "",
        );
        if (!ref) continue;
        const [billRows] = await conn.execute(
          "SELECT id, net_amount, tax_amount FROM pur_bills WHERE company_id = :companyId AND branch_id = :branchId AND bill_no = :ref LIMIT 1",
          { companyId, branchId, ref },
        );
        if (!billRows?.length) continue;
        const gross = Number(billRows[0].net_amount || 0);
        const vatAmt = Math.max(0, Number(billRows[0].tax_amount || 0));
        if (!(vatAmt > 0)) continue;
        const vatAcc = await resolveVatInputAccountIdTx(conn, { companyId });
        if (!vatAcc) continue;
        const debitLine = lines.find((x) => Number(x.debit || 0) > 0);
        if (!debitLine) continue;
        const newDebit = Math.max(0, Number(debitLine.debit || 0) - vatAmt);
        if (newDebit < 0) continue;
        await conn.execute(
          "UPDATE fin_voucher_lines SET debit = :debit WHERE id = :id",
          { id: debitLine.id, debit: newDebit },
        );
        const maxLineNo = Math.max(...lines.map((x) => Number(x.line_no || 0)));
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
          {
            companyId,
            voucherId: vid,
            lineNo: maxLineNo + 1,
            accountId: vatAcc,
            description: `VAT on ${ref}`,
            debit: vatAmt,
            ref,
          },
        );
        puvUpdated++;
      }

      // 3) Create missing SV for recent receipt vouchers that referenced invoices (partial or full)
      const [recentRVs] = await conn.execute(
        `
        SELECT v.id AS rv_id, v.voucher_no AS rv_no, v.voucher_date, l.reference_no AS invoice_no, l.credit AS applied
        FROM fin_vouchers v
        JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        JOIN fin_voucher_lines l ON l.voucher_id = v.id
        WHERE v.company_id = :companyId
          AND v.branch_id = :branchId
          AND vt.code = 'RV'
          AND l.reference_no IS NOT NULL
          AND l.credit > 0
        ORDER BY v.id DESC
        LIMIT 400
        `,
        { companyId, branchId },
      );
      let svFromRvCreated = 0;
      if (recentRVs && recentRVs.length) {
        const svTypeId = await ensureSalesVoucherTypeIdTx(conn, { companyId });
        const salesAccountId = await resolveDefaultSalesAccountIdTx(conn, {
          companyId,
        });
        for (const r of recentRVs) {
          const invNo = String(r.invoice_no || "");
          const rvNo = String(r.rv_no || "");
          const applied = Math.max(0, Number(r.applied || 0));
          if (!invNo || !rvNo || !(applied > 0)) continue;
          const refKey = `${invNo}|${rvNo}`;
          const [dup] = await conn.execute(
            `
            SELECT v.id
            FROM fin_vouchers v
            JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
            JOIN fin_voucher_lines l ON l.voucher_id = v.id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND vt.code = 'SV'
              AND l.reference_no = :ref
            LIMIT 1
            `,
            { companyId, branchId, ref: refKey },
          );
          if (dup?.length) continue;
          const [invRows] = await conn.execute(
            "SELECT id, invoice_date, net_amount FROM sal_invoices WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :invNo LIMIT 1",
            { companyId, branchId, invNo },
          );
          if (!invRows?.length) continue;
          const invId = Number(invRows[0].id || 0);
          const invGross = Number(invRows[0].net_amount || 0);
          const invDate = invRows[0].invoice_date || r.voucher_date;
          let invNetBase = invGross;
          try {
            const [sumRows] = await conn.execute(
              "SELECT COALESCE(SUM(net_amount),0) AS net_sum FROM sal_invoice_details WHERE invoice_id = :id",
              { id: invId },
            );
            const netSum = Number(sumRows?.[0]?.net_sum || 0);
            if (netSum > 0 && invGross >= netSum) invNetBase = netSum;
          } catch {}
          const vatFull = Math.max(
            0,
            Math.round((invGross - invNetBase) * 100) / 100,
          );
          let basePart = applied;
          let vatPart = 0;
          if (invGross > 0 && vatFull > 0) {
            const p = Math.min(1, applied / invGross);
            vatPart = Math.round(vatFull * p * 100) / 100;
            basePart = Math.round((applied - vatPart) * 100) / 100;
            if (basePart < 0) basePart = 0;
          }
          // Find bank/cash account from RV voucher's debit line
          const [bankLineRows] = await conn.execute(
            "SELECT l.account_id FROM fin_voucher_lines l WHERE l.voucher_id = :vid AND l.debit > 0 ORDER BY l.line_no ASC LIMIT 1",
            { vid: r.rv_id },
          );
          const bankAccountId = Number(bankLineRows?.[0]?.account_id || 0);
          if (!bankAccountId || !salesAccountId) continue;
          const fyId = await resolveFiscalYearIdForDate(conn, {
            companyId,
            dateYmd: toYmd(new Date(invDate || r.voucher_date || new Date())),
          });
          const svNo = await nextVoucherNoTx(conn, {
            companyId,
            voucherTypeId: svTypeId,
          });
          const [insHdr] = await conn.execute(
            `INSERT INTO fin_vouchers
              (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
             VALUES
              (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :td, :tc, 'DRAFT', :createdBy)`,
            {
              companyId,
              branchId,
              fiscalYearId: fyId,
              voucherTypeId: svTypeId,
              voucherNo: svNo,
              voucherDate: toYmd(
                new Date(invDate || r.voucher_date || new Date()),
              ),
              narration: `Invoice ${invNo} receipt ${rvNo}`,
              td: applied,
              tc: applied,
              createdBy: req.user?.sub || null,
            },
          );
          const vId = Number(insHdr.insertId || 0);
          if (!vId) continue;
          let lineNo = 1;
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: bankAccountId,
              description: `Receipt for ${invNo}`,
              debit: applied,
              ref: refKey,
            },
          );
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
            {
              companyId,
              voucherId: vId,
              lineNo: lineNo++,
              accountId: salesAccountId,
              description: `Sales for ${invNo}`,
              credit: basePart,
              ref: refKey,
            },
          );
          if (vatPart > 0) {
            const vatAcc = await resolveVatOutputAccountIdTx(conn, {
              companyId,
              branchId,
            });
            if (vatAcc) {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)`,
                {
                  companyId,
                  voucherId: vId,
                  lineNo: lineNo++,
                  accountId: vatAcc,
                  description: `VAT on ${invNo}`,
                  credit: vatPart,
                  ref: refKey,
                },
              );
            }
          }
          svFromRvCreated++;
        }
      }
      await conn.commit();
      res.json({
        sales_vouchers_created: svCreated + svFromRvCreated,
        purchase_vouchers_created: puvCreated,
        sales_vouchers_updated: svUpdated,
        purchase_vouchers_updated: puvUpdated,
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

router.post(
  "/vouchers/:voucherId/reverse",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  requireIdParam("voucherId"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const originalVoucherId = Number(req.params.voucherId);
      const { reason, voucherDate } = req.body || {};

      const originals = await query(
        "SELECT * FROM fin_vouchers WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id: originalVoucherId },
      );
      const original = originals?.[0];
      if (!original)
        throw httpError(404, "NOT_FOUND", "Original voucher not found");
      if (original.status === "REVERSED")
        throw httpError(400, "VALIDATION_ERROR", "Voucher already reversed");

      const existing = await query(
        "SELECT id FROM fin_voucher_reversals WHERE company_id = :companyId AND original_voucher_id = :id",
        { companyId, id: originalVoucherId },
      );
      if (existing?.length)
        throw httpError(400, "VALIDATION_ERROR", "Reversal already exists");

      const origLines = await query(
        "SELECT line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method FROM fin_voucher_lines WHERE voucher_id = :id ORDER BY line_no ASC",
        { id: originalVoucherId },
      );

      const reversalVoucherNo = await nextVoucherNo({
        companyId,
        voucherTypeId: original.voucher_type_id,
      });

      await conn.beginTransaction();
      const [ins] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, 'APPROVED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId,
          fiscalYearId: original.fiscal_year_id,
          voucherTypeId: original.voucher_type_id,
          voucherNo: reversalVoucherNo,
          voucherDate: voucherDate || original.voucher_date,
          narration: `Reversal of ${original.voucher_no}${
            reason ? ` - ${reason}` : ""
          }`,
          currencyId: original.currency_id,
          exchangeRate: original.exchange_rate,
          totalDebit: original.total_credit,
          totalCredit: original.total_debit,
          createdBy: req.user?.sub || null,
          approvedBy: req.user?.sub || null,
          postedBy: req.user?.sub || null,
        },
      );
      const reversalVoucherId = ins.insertId;

      for (let i = 0; i < origLines.length; i++) {
        const l = origLines[i];
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo, :paymentMethod)`,
          {
            companyId,
            voucherId: reversalVoucherId,
            lineNo: i + 1,
            accountId: l.account_id,
            description: l.description,
            debit: Number(l.credit || 0),
            credit: Number(l.debit || 0),
            taxCodeId: l.tax_code_id || null,
            costCenter: l.cost_center || null,
            referenceNo: l.reference_no || null,
            paymentMethod: l.payment_method || null,
          },
        );
      }

      await conn.execute(
        "INSERT INTO fin_voucher_reversals (company_id, original_voucher_id, reversal_voucher_id, reason, created_by) VALUES (:companyId, :originalId, :reversalId, :reason, :createdBy)",
        {
          companyId,
          originalId: originalVoucherId,
          reversalId: reversalVoucherId,
          reason: reason || null,
          createdBy: req.user?.sub || null,
        },
      );

      await conn.execute(
        "UPDATE fin_vouchers SET status = 'REVERSED' WHERE company_id = :companyId AND id = :id",
        { companyId, id: originalVoucherId },
      );

      await conn.commit();
      res.status(201).json({ reversalVoucherId, reversalVoucherNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/vouchers/:voucherId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.MANAGE"),
  requireIdParam("voucherId"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const voucherId = Number(req.params.voucherId);
      const {
        voucherDate,
        narration,
        fiscalYearId,
        currencyId,
        exchangeRate,
        lines,
      } = req.body || {};
      if (!Array.isArray(lines) || lines.length === 0) {
        throw httpError(400, "VALIDATION_ERROR", "lines are required");
      }
      const totals = lines.reduce(
        (acc, l) => {
          acc.debit += Number(l.debit || 0);
          acc.credit += Number(l.credit || 0);
          return acc;
        },
        { debit: 0, credit: 0 },
      );
      if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Total debit must equal total credit",
        );
      }
      const rows = await query(
        `SELECT v.id, v.status, vt.code AS voucher_type_code
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId AND v.branch_id = :branchId AND v.id = :id`,
        { companyId, branchId, id: voucherId },
      );
      const v = rows?.[0];
      if (!v) throw httpError(404, "NOT_FOUND", "Voucher not found");
      if (String(v.status) === "REVERSED") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Cannot update a reversed voucher",
        );
      }
      const isRV = String(v?.voucher_type_code || "").toUpperCase() === "RV";
      const invoiceApplyMapNew = new Map();
      if (isRV) {
        for (const l of lines) {
          const credit = Number(l.credit || 0);
          const ref = String(l.referenceNo || l.reference_no || "").trim();
          const accId = Number(l.accountId || 0);
          if (!(credit > 0 && ref)) continue;
          const [invRows] = await conn.execute(
            "SELECT id, invoice_no, customer_id, total_amount, balance_amount, payment_status FROM sal_invoices WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :ref LIMIT 1",
            { companyId, branchId, ref },
          );
          const inv = invRows?.[0] || null;
          if (!inv) {
            throw httpError(404, "NOT_FOUND", `Invoice ${ref} not found`);
          }
          const custAccId = await ensureCustomerFinAccountIdTx(conn, {
            companyId,
            customerId: Number(inv.customer_id),
          });
          if (!custAccId || String(custAccId) !== String(accId)) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Account does not match invoice customer for ${ref}`,
            );
          }
          const bal = Math.round(Number(inv.balance_amount || 0) * 100) / 100;
          if (credit > bal) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Payment exceeds invoice balance for ${ref}`,
            );
          }
          const key = String(inv.id);
          const prev = invoiceApplyMapNew.get(key) || 0;
          if (prev + credit > bal + 1e-9) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Total payments exceed invoice balance for ${ref}`,
            );
          }
          invoiceApplyMapNew.set(key, prev + credit);
        }
      }
      await conn.beginTransaction();
      if (isRV) {
        const prevLines = await query(
          `SELECT credit, reference_no
             FROM fin_voucher_lines
            WHERE voucher_id = :voucherId
              AND reference_no IS NOT NULL
              AND credit > 0`,
          { voucherId },
        );
        for (const pl of prevLines || []) {
          const refPrev = String(pl.reference_no || "").trim();
          const amtPrev = Number(pl.credit || 0);
          if (!(refPrev && amtPrev > 0)) continue;
          const [invPrevRows] = await conn.execute(
            "SELECT id, total_amount, balance_amount FROM sal_invoices WHERE company_id = :companyId AND branch_id = :branchId AND invoice_no = :ref LIMIT 1",
            { companyId, branchId, ref: refPrev },
          );
          const invPrev = invPrevRows?.[0] || null;
          if (!invPrev) continue;
          const totalAmt =
            Math.round(Number(invPrev.total_amount || 0) * 100) / 100;
          const balPrev =
            Math.round(Number(invPrev.balance_amount || 0) * 100) / 100;
          let newBalPrev = Math.round((balPrev + amtPrev) * 100) / 100;
          if (newBalPrev > totalAmt) newBalPrev = totalAmt;
          await conn.execute(
            `UPDATE sal_invoices
               SET balance_amount = :balance,
                   payment_status = :pstatus
             WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            {
              id: Number(invPrev.id),
              companyId,
              branchId,
              balance: newBalPrev,
              pstatus:
                newBalPrev <= 0
                  ? "PAID"
                  : newBalPrev >= totalAmt
                    ? "UNPAID"
                    : "PARTIALLY_PAID",
            },
          );
        }
      }
      await conn.execute(
        `UPDATE fin_vouchers
           SET voucher_date = COALESCE(:voucherDate, voucher_date),
               narration = COALESCE(:narration, narration),
               fiscal_year_id = COALESCE(:fiscalYearId, fiscal_year_id),
               currency_id = COALESCE(:currencyId, currency_id),
               exchange_rate = COALESCE(:exchangeRate, exchange_rate),
               total_debit = :totalDebit,
               total_credit = :totalCredit
         WHERE company_id = :companyId AND branch_id = :branchId AND id = :id`,
        {
          companyId,
          branchId,
          id: voucherId,
          voucherDate: voucherDate || null,
          narration: narration || null,
          fiscalYearId:
            fiscalYearId === undefined
              ? null
              : Number(fiscalYearId || 0) || null,
          currencyId:
            currencyId === undefined ? null : Number(currencyId || 0) || null,
          exchangeRate:
            exchangeRate === undefined ? null : Number(exchangeRate || 1),
          totalDebit: totals.debit,
          totalCredit: totals.credit,
        },
      );
      await conn.execute(
        "DELETE FROM fin_voucher_lines WHERE voucher_id = :voucherId",
        {
          voucherId,
        },
      );
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await conn.execute(
          `INSERT INTO fin_voucher_lines
             (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no, payment_method)
           VALUES
             (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo, :paymentMethod)`,
          {
            companyId,
            voucherId,
            lineNo: i + 1,
            accountId: Number(l.accountId),
            description: l.description || null,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            taxCodeId: l.taxCodeId || null,
            costCenter: l.costCenter || null,
            referenceNo: l.referenceNo || null,
            paymentMethod: l.paymentMethod || null,
          },
        );
      }
      if (isRV && invoiceApplyMapNew.size) {
        for (const [invIdStr, amount] of invoiceApplyMapNew.entries()) {
          const invId = Number(invIdStr);
          const [curRows] = await conn.execute(
            "SELECT total_amount, balance_amount FROM sal_invoices WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1",
            { id: invId, companyId, branchId },
          );
          const totalAmt =
            Math.round(Number(curRows?.[0]?.total_amount || 0) * 100) / 100;
          const bal =
            Math.round(Number(curRows?.[0]?.balance_amount || 0) * 100) / 100;
          const newBal = Math.round((bal - amount) * 100) / 100;
          await conn.execute(
            `UPDATE sal_invoices
               SET balance_amount = :balance,
                   payment_status = :pstatus
             WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            {
              id: invId,
              companyId,
              branchId,
              balance: newBal,
              pstatus:
                newBal <= 0
                  ? "PAID"
                  : newBal >= totalAmt
                    ? "UNPAID"
                    : "PARTIALLY_PAID",
            },
          );
        }
      }
      await conn.commit();
      res.json({ ok: true, message: "Updated voucher" });
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
  "/bank-accounts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT b.id, b.name, b.bank_name, b.account_number, b.gl_account_id, a.code AS gl_account_code, a.name AS gl_account_name,
                b.currency_id, c.code AS currency_code, b.is_active
           FROM fin_bank_accounts b
           JOIN fin_accounts a ON a.id = b.gl_account_id
           LEFT JOIN fin_currencies c ON c.id = b.currency_id
          WHERE b.company_id = :companyId AND b.branch_id = :branchId
          ORDER BY b.name ASC`,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-accounts/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const rows = await query(
        `SELECT b.*, a.code AS gl_account_code, a.name AS gl_account_name,
                c.code AS currency_code
           FROM fin_bank_accounts b
           JOIN fin_accounts a ON a.id = b.gl_account_id
           LEFT JOIN fin_currencies c ON c.id = b.currency_id
          WHERE b.company_id = :companyId AND b.branch_id = :branchId AND b.id = :id`,
        { companyId, branchId, id },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Bank account not found");
      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-reconciliations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT r.id, r.bank_account_id, b.name AS bank_account_name, r.statement_from, r.statement_to, r.statement_ending_balance, r.status, r.created_at
           FROM fin_bank_reconciliations r
           JOIN fin_bank_accounts b ON b.id = r.bank_account_id
          WHERE r.company_id = :companyId AND r.branch_id = :branchId
          ORDER BY r.id DESC`,
        { companyId, branchId },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bank-reconciliations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const {
        bankAccountId,
        statementFrom,
        statementTo,
        statementEndingBalance,
        status,
      } = req.body || {};
      if (!bankAccountId || !statementFrom || !statementTo) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "bankAccountId, statementFrom, statementTo are required",
        );
      }
      if (new Date(statementFrom) > new Date(statementTo)) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "statementFrom must be before or equal to statementTo",
        );
      }
      const result = await query(
        `INSERT INTO fin_bank_reconciliations
           (company_id, branch_id, bank_account_id, statement_from, statement_to, statement_ending_balance, status, created_by)
         VALUES
           (:companyId, :branchId, :bankAccountId, :statementFrom, :statementTo, :statementEndingBalance, :status, :createdBy)`,
        {
          companyId,
          branchId,
          bankAccountId: Number(bankAccountId),
          statementFrom,
          statementTo,
          statementEndingBalance: Number(statementEndingBalance || 0),
          status: status || "DRAFT",
          createdBy: req.user?.sub || null,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-reconciliations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const headers = await query(
        `SELECT r.*, b.name AS bank_account_name, b.account_number, b.bank_name
           FROM fin_bank_reconciliations r
           JOIN fin_bank_accounts b ON b.id = r.bank_account_id
          WHERE r.company_id = :companyId AND r.branch_id = :branchId AND r.id = :id`,
        { companyId, branchId, id },
      );
      const header = headers?.[0];
      if (!header)
        throw httpError(404, "NOT_FOUND", "Reconciliation not found");
      const lines = await query(
        `SELECT l.id, l.voucher_id, v.voucher_no, l.statement_date, l.description, l.amount, l.cleared
           FROM fin_bank_reconciliation_lines l
           LEFT JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE l.reconciliation_id = :id
          ORDER BY l.statement_date ASC, l.id ASC`,
        { id },
      );
      res.json({ header, lines });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/bank-reconciliations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const { statementFrom, statementTo, statementEndingBalance, status } =
        req.body || {};
      const rows = await query(
        "SELECT id, statement_from, statement_to FROM fin_bank_reconciliations WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id },
      );
      const current = rows?.[0];
      if (!current)
        throw httpError(404, "NOT_FOUND", "Reconciliation not found");
      const effFrom = statementFrom || current.statement_from;
      const effTo = statementTo || current.statement_to;
      if (effFrom && effTo) {
        if (new Date(effFrom) > new Date(effTo)) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "statementFrom must be before or equal to statementTo",
          );
        }
      }
      await query(
        `UPDATE fin_bank_reconciliations
           SET statement_from = COALESCE(:statementFrom, statement_from),
               statement_to = COALESCE(:statementTo, statement_to),
               statement_ending_balance = COALESCE(:statementEndingBalance, statement_ending_balance),
               status = COALESCE(:status, status)
         WHERE company_id = :companyId AND branch_id = :branchId AND id = :id`,
        {
          companyId,
          branchId,
          id,
          statementFrom: statementFrom || null,
          statementTo: statementTo || null,
          statementEndingBalance:
            statementEndingBalance === undefined
              ? null
              : Number(statementEndingBalance || 0),
          status: status || null,
        },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bank-reconciliations/:id/complete",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const rows = await query(
        "SELECT id, status FROM fin_bank_reconciliations WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id },
      );
      const r = rows?.[0];
      if (!r) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
      if (String(r.status) === "COMPLETED")
        throw httpError(400, "VALIDATION_ERROR", "Already completed");
      await query(
        "UPDATE fin_bank_reconciliations SET status = 'COMPLETED' WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bank-reconciliations/:id/lines",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const reconciliationId = Number(req.params.id);
      const { voucherId, statementDate, description, amount, cleared } =
        req.body || {};

      if (!statementDate) {
        throw httpError(400, "VALIDATION_ERROR", "statementDate is required");
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount === 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Valid non-zero amount is required",
        );
      }

      const headers = await query(
        "SELECT statement_from, statement_to FROM fin_bank_reconciliations WHERE id = :id",
        { id: reconciliationId },
      );
      const h = headers?.[0];
      if (!h) throw httpError(404, "NOT_FOUND", "Reconciliation not found");

      // Permissive date check using string comparison to avoid timezone issues
      const lineDateStr = String(statementDate).slice(0, 10);
      const fromStr = String(h.statement_from).slice(0, 10);
      const toStr = String(h.statement_to).slice(0, 10);

      if (lineDateStr < fromStr || lineDateStr > toStr) {
        // Log warning but allow if it's a linked voucher (optional, but safer for now)
        console.warn(
          `Statement date ${lineDateStr} is outside recon range ${fromStr} - ${toStr}`,
        );
      }

      const result = await query(
        `INSERT INTO fin_bank_reconciliation_lines
           (reconciliation_id, voucher_id, statement_date, description, amount, cleared)
         VALUES
           (:reconciliationId, :voucherId, :statementDate, :description, :amount, :cleared)`,
        {
          reconciliationId,
          voucherId: voucherId ? Number(voucherId) : null,
          statementDate,
          description: description || null,
          amount: Number(amount || 0),
          cleared: cleared ? 1 : 0,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/bank-reconciliation-lines/:lineId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("lineId"),
  async (req, res, next) => {
    try {
      const lineId = Number(req.params.lineId);
      const { voucherId, statementDate, description, amount, cleared } =
        req.body || {};
      if (amount !== undefined && Number(amount || 0) === 0) {
        throw httpError(400, "VALIDATION_ERROR", "amount must be non-zero");
      }
      if (statementDate) {
        const rows = await query(
          "SELECT reconciliation_id FROM fin_bank_reconciliation_lines WHERE id = :id",
          { id: lineId },
        );
        const r = rows?.[0];
        if (!r) throw httpError(404, "NOT_FOUND", "Line not found");
        const headers = await query(
          "SELECT statement_from, statement_to FROM fin_bank_reconciliations WHERE id = :id",
          { id: r.reconciliation_id },
        );
        const h = headers?.[0];
        if (!h) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
        const d = new Date(statementDate);
        const from = new Date(h.statement_from);
        const to = new Date(h.statement_to);
        if (d < from || d > to) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "statementDate must be within reconciliation date range",
          );
        }
      }
      await query(
        `UPDATE fin_bank_reconciliation_lines
           SET voucher_id = COALESCE(:voucherId, voucher_id),
               statement_date = COALESCE(:statementDate, statement_date),
               description = COALESCE(:description, description),
               amount = COALESCE(:amount, amount),
               cleared = COALESCE(:cleared, cleared)
         WHERE id = :lineId`,
        {
          lineId,
          voucherId: voucherId === undefined ? null : voucherId || null,
          statementDate: statementDate || null,
          description: description || null,
          amount: amount === undefined ? null : Number(amount || 0),
          cleared:
            cleared === undefined ? null : Number(Boolean(cleared)) ? 1 : 0,
        },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/bank-reconciliation-lines/:lineId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("lineId"),
  async (req, res, next) => {
    try {
      const lineId = Number(req.params.lineId);
      await query("DELETE FROM fin_bank_reconciliation_lines WHERE id = :id", {
        id: lineId,
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/bank-reconciliations/:id/lines/import",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const reconciliationId = Number(req.params.id);
      if (!req.file || !req.file.buffer) {
        throw httpError(400, "VALIDATION_ERROR", "file is required");
      }
      let mapping = null;
      if (req.body?.mapping) {
        try {
          const parsed = JSON.parse(String(req.body.mapping));
          if (parsed && typeof parsed === "object") {
            mapping = Object.fromEntries(
              Object.entries(parsed).map(([k, v]) => [
                String(k).toLowerCase().trim(),
                String(v).toLowerCase().trim(),
              ]),
            );
          }
        } catch {
          // ignore invalid mapping
        }
      }
      const headers = await query(
        "SELECT statement_from, statement_to FROM fin_bank_reconciliations WHERE id = :id",
        { id: reconciliationId },
      );
      const h = headers?.[0];
      if (!h) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
      const from = new Date(h.statement_from);
      const to = new Date(h.statement_to);

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: false });

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        const lower = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            String(k).toLowerCase().trim(),
            v,
          ]),
        );
        const pick = (...names) => {
          for (const n of names) {
            if (
              lower[n] !== undefined &&
              lower[n] !== null &&
              String(lower[n]).trim() !== ""
            ) {
              return lower[n];
            }
          }
          return undefined;
        };
        const getByMap = (key, fallbackNames) => {
          if (mapping && mapping[key]) {
            const v = lower[mapping[key]];
            if (v !== undefined && v !== null && String(v).trim() !== "")
              return v;
          }
          return pick(...fallbackNames);
        };
        const statementDate = getByMap("date", [
          "statement_date",
          "date",
          "trans_date",
          "posting_date",
        ]);
        const description = getByMap("description", [
          "description",
          "narration",
          "details",
          "memo",
        ]);
        const amountVal = getByMap("amount", ["amount", "amt", "value"]);
        const clearedVal = getByMap("cleared", ["cleared", "status"]);
        const voucherNo = getByMap("voucher_no", [
          "voucher_no",
          "voucher",
          "reference",
        ]);

        if (amountVal === undefined || Number(amountVal || 0) === 0) {
          skipped++;
          continue;
        }
        if (!statementDate) {
          skipped++;
          continue;
        }
        const d = new Date(statementDate);
        if (isNaN(d.getTime()) || d < from || d > to) {
          skipped++;
          continue;
        }
        let voucherId = null;
        if (voucherNo) {
          const vRows = await query(
            "SELECT id FROM fin_vouchers WHERE company_id = :companyId AND branch_id = :branchId AND voucher_no = :voucherNo LIMIT 1",
            { companyId, branchId, voucherNo: String(voucherNo).trim() },
          );
          if (vRows?.[0]?.id) {
            voucherId = Number(vRows[0].id);
          }
        }
        const cleared =
          typeof clearedVal === "string"
            ? ["1", "true", "yes", "y", "cleared"].includes(
                String(clearedVal).toLowerCase(),
              )
              ? 1
              : 0
            : Number(Boolean(clearedVal))
              ? 1
              : 0;

        await query(
          `INSERT INTO fin_bank_reconciliation_lines
             (reconciliation_id, voucher_id, statement_date, description, amount, cleared)
           VALUES
             (:reconciliationId, :voucherId, :statementDate, :description, :amount, :cleared)`,
          {
            reconciliationId,
            voucherId,
            statementDate: d.toISOString().slice(0, 10),
            description: description || null,
            amount: Number(amountVal),
            cleared,
          },
        );
        inserted++;
      }

      res.json({ insertedCount: inserted, skippedCount: skipped });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-reconciliations/lines/import-template",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const format = String(req.query.format || "csv").toLowerCase();
      const headersRow = [
        "Statement Date",
        "Description",
        "Amount",
        "Cleared",
        "Voucher No",
      ];
      if (format === "xlsx") {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headersRow, ["", "", "", "", ""]]);
        XLSX.utils.book_append_sheet(wb, ws, "ImportTemplate");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="reconciliation_import_template.xlsx"',
        );
        res.send(buf);
      } else {
        const csv = `${headersRow.join(",")}\n`;
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="reconciliation_import_template.csv"',
        );
        res.send(csv);
      }
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-reconciliations/:id/summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const rows = await query(
        `SELECT r.statement_from, r.statement_to, r.statement_ending_balance, 
                r.bank_account_id, b.gl_account_id
           FROM fin_bank_reconciliations r
           JOIN fin_bank_accounts b ON b.id = r.bank_account_id
          WHERE r.company_id = :companyId AND r.branch_id = :branchId AND r.id = :id`,
        { companyId, branchId, id },
      );
      const rec = rows?.[0];
      if (!rec) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
      const glAccountId = Number(rec.gl_account_id);
      const from = String(rec.statement_from).slice(0, 10);
      const to = String(rec.statement_to).slice(0, 10);

      // Check for the previous reconciliation ending balance first (must be COMPLETED)
      const [prevRecRow] = await query(
        `SELECT statement_ending_balance 
         FROM fin_bank_reconciliations
         WHERE company_id = :companyId AND bank_account_id = :bankAccountId
           AND statement_to < :from AND status = 'COMPLETED'
         ORDER BY statement_to DESC LIMIT 1`,
        { companyId, bankAccountId: rec.bank_account_id, from },
      );

      let opening = 0;
      if (prevRecRow) {
        opening = Number(prevRecRow.statement_ending_balance || 0);
      } else {
        // Fallback to fiscal year opening balance + movements before 'from'
        const [fyRow] = await query(
          `SELECT id FROM fin_fiscal_years
           WHERE company_id = :companyId
             AND (:from >= start_date AND :from <= end_date)
           ORDER BY start_date DESC LIMIT 1`,
          { companyId, from },
        );
        const fyId = fyRow?.id || null;

        const [obRow] = await query(
          `SELECT COALESCE(opening_debit, 0) - COALESCE(opening_credit, 0) AS setup_ob
           FROM fin_account_opening_balances
           WHERE company_id = :companyId AND account_id = :glAccountId
             AND (:fyId IS NOT NULL AND fiscal_year_id = :fyId)
             AND (branch_id IS NULL OR branch_id = :branchId)`,
          { companyId, glAccountId, fyId, branchId },
        );

        const [openRow] = await query(
          `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS bal
             FROM fin_voucher_lines l
             JOIN fin_vouchers v ON v.id = l.voucher_id
            WHERE v.company_id = :companyId AND v.branch_id = :branchId
              AND l.account_id = :glAccountId
              AND v.voucher_date < :from`,
          { companyId, branchId, glAccountId, from },
        );
        opening = Number(obRow?.setup_ob || 0) + Number(openRow?.bal || 0);
      }

      // Total of items marked as cleared in this specific reconciliation
      const [clearedRow] = await query(
        `SELECT COALESCE(SUM(amount), 0) AS amt
           FROM fin_bank_reconciliation_lines
          WHERE reconciliation_id = :id AND cleared = 1`,
        { id },
      );
      const clearedTotal = Number(clearedRow?.amt || 0);

      // Total of all book movements (vouchers) in this period (regardless of cleared status)
      const [moveRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS mov
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE v.company_id = :companyId AND v.branch_id = :branchId
            AND l.account_id = :glAccountId
            AND v.voucher_date >= :from AND v.voucher_date <= :to`,
        { companyId, branchId, glAccountId, from, to },
      );
      const totalBookMovement = Number(moveRow?.mov || 0);

      // For bank reconciliation purposes, "Book Balance" shown to the user
      // is the "Adjusted Book Balance" or "Cleared Book Balance"
      // which should equal the bank statement balance when reconciled.
      const clearedBookEnding = opening + clearedTotal;
      const bankEnding = Number(rec.statement_ending_balance || 0);

      // Uncleared items total (for informational purposes)
      const unclearedTotal = totalBookMovement - clearedTotal;

      res.json({
        openingBookBalance: opening,
        periodBookMovement: clearedTotal, // Showing cleared movement only as requested
        endingBookBalance: clearedBookEnding, // This is what the user wants to see change
        statementEndingBalance: bankEnding,
        clearedTotal,
        unclearedTotal,
        diffBankVsCleared: bankEnding - clearedBookEnding,
        diffBankVsBook: bankEnding - clearedBookEnding, // Sync difference with cleared items
        outstandingEstimate: unclearedTotal,
        glAccountId,
        from,
        to,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bank-reconciliations/:id/transactions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const id = Number(req.params.id);

      const reconRows = await query(
        `SELECT b.gl_account_id, r.statement_from, r.statement_to
         FROM fin_bank_reconciliations r
         JOIN fin_bank_accounts b ON b.id = r.bank_account_id
         WHERE r.id = :id AND r.company_id = :companyId`,
        { id, companyId },
      );
      if (!reconRows.length)
        throw httpError(404, "NOT_FOUND", "Reconciliation not found");

      const { gl_account_id, statement_from, statement_to } = reconRows[0];
      const statusFilter = req.query.status || "APPROVED";

      let where = `v.company_id = :companyId 
           AND v.branch_id = :branchId
           AND l.account_id = :glAccountId
           AND v.voucher_date >= :from 
           AND v.voucher_date <= :to`;

      const params = {
        id,
        companyId,
        branchId,
        glAccountId: gl_account_id,
        from: statement_from,
        to: statement_to,
      };

      if (statusFilter !== "BOTH") {
        where += ` AND v.status = :status`;
        params.status = statusFilter;
      }

      const transactions = await query(
        `SELECT 
          v.id AS voucher_id,
          v.voucher_no, 
          v.voucher_date, 
          v.narration AS header_narration,
          l.description AS line_narration,
          v.status AS voucher_status,
          l.debit, 
          l.credit,
          l.account_id,
          l.cheque_number,
          l.cheque_date,
          (SELECT a2.name 
           FROM fin_voucher_lines l2 
           JOIN fin_accounts a2 ON a2.id = l2.account_id
           WHERE l2.voucher_id = v.id AND l2.account_id <> l.account_id
           LIMIT 1) AS account_name,
          (SELECT COUNT(*) FROM fin_bank_reconciliation_lines rl 
           WHERE rl.voucher_id = v.id AND rl.reconciliation_id = :id AND rl.cleared = 1) AS is_cleared
         FROM fin_vouchers v
         JOIN fin_voucher_lines l ON v.id = l.voucher_id
         WHERE ${where}
         ORDER BY v.voucher_date ASC, v.voucher_no ASC`,
        params,
      );

      const processed = transactions.map((t) => ({
        voucher_no: t.voucher_no,
        voucher_date: t.voucher_date,
        narration: t.line_narration || t.header_narration,
        debit: t.debit,
        credit: t.credit,
        account_name: t.account_name,
        cleared: !!t.is_cleared,
        checkNumber: t.cheque_number,
        chequeDate: t.cheque_date,
        voucher_id: t.voucher_id,
      }));

      res.json({ items: processed });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/pdc-postings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const { from, to, bankAccountId, status } = req.query || {};

      let where = "p.company_id = :companyId AND p.branch_id = :branchId";
      const params = { companyId, branchId };

      if (from) {
        where += " AND p.instrument_date >= :from";
        params.from = from;
      }
      if (to) {
        where += " AND p.instrument_date <= :to";
        params.to = to;
      }
      if (bankAccountId) {
        where += " AND p.bank_account_id = :bankAccountId";
        params.bankAccountId = Number(bankAccountId);
      }
      if (status && status !== "ALL") {
        where += " AND p.status = :status";
        params.status = status;
      }

      const items = await query(
        `SELECT p.id, p.instrument_no, p.instrument_date, p.status, p.voucher_id, 
                v.voucher_no, p.created_at, p.created_by,
                a.name AS bank_account_name,
                u.username AS creator_username
           FROM fin_pdc_postings p
           JOIN fin_vouchers v ON v.id = p.voucher_id
           LEFT JOIN fin_accounts a ON a.id = p.bank_account_id
           LEFT JOIN adm_users u ON u.id = p.created_by
          WHERE ${where}
          ORDER BY p.id DESC`,
        params,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/pdc-postings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const { voucherId, instrumentNo, instrumentDate, bankAccountId, status } =
        req.body || {};
      if (!voucherId || !instrumentNo || !instrumentDate) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "voucherId, instrumentNo, instrumentDate are required",
        );
      }
      const vRows = await query(
        "SELECT voucher_date FROM fin_vouchers WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id: Number(voucherId) },
      );
      const v = vRows?.[0];
      if (!v) throw httpError(404, "NOT_FOUND", "Voucher not found");
      if (new Date(instrumentDate) < new Date(v.voucher_date)) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "instrumentDate must be on or after voucher date",
        );
      }
      const createdAt = new Date();
      const createdBy = req.user?.sub || null;
      const result = await query(
        `INSERT INTO fin_pdc_postings
           (company_id, branch_id, voucher_id, instrument_no, instrument_date, bank_account_id, status, created_at, created_by)
         VALUES
           (:companyId, :branchId, :voucherId, :instrumentNo, :instrumentDate, :bankAccountId, :status, :createdAt, :createdBy)`,
        {
          companyId,
          branchId,
          voucherId: Number(voucherId),
          instrumentNo: String(instrumentNo),
          instrumentDate: instrumentDate,
          bankAccountId: bankAccountId ? Number(bankAccountId) : null,
          status: status || "HELD",
          createdAt,
          createdBy,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/pdc-postings/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const { voucherId, instrumentNo, instrumentDate, bankAccountId, status } =
        req.body || {};
      const rows = await query(
        "SELECT id, voucher_id, instrument_date FROM fin_pdc_postings WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id },
      );
      const current = rows?.[0];
      if (!current) throw httpError(404, "NOT_FOUND", "PDC not found");
      const effVoucherId =
        voucherId === undefined || voucherId === null
          ? current.voucher_id
          : Number(voucherId);
      const effInstrumentDate =
        instrumentDate === undefined || instrumentDate === null
          ? current.instrument_date
          : instrumentDate;
      if (effVoucherId) {
        const vRows = await query(
          "SELECT voucher_date FROM fin_vouchers WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
          { companyId, branchId, id: Number(effVoucherId) },
        );
        const v = vRows?.[0];
        if (!v) throw httpError(404, "NOT_FOUND", "Voucher not found");
        if (effInstrumentDate) {
          if (new Date(effInstrumentDate) < new Date(v.voucher_date)) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "instrumentDate must be on or after voucher date",
            );
          }
        }
      }
      await query(
        `UPDATE fin_pdc_postings
           SET voucher_id = COALESCE(:voucherId, voucher_id),
               instrument_no = COALESCE(:instrumentNo, instrument_no),
               instrument_date = COALESCE(:instrumentDate, instrument_date),
               bank_account_id = COALESCE(:bankAccountId, bank_account_id),
               status = COALESCE(:status, status)
         WHERE company_id = :companyId AND branch_id = :branchId AND id = :id`,
        {
          companyId,
          branchId,
          id,
          voucherId: voucherId === undefined ? null : Number(voucherId),
          instrumentNo: instrumentNo || null,
          instrumentDate: instrumentDate || null,
          bankAccountId:
            bankAccountId === undefined
              ? null
              : bankAccountId
                ? Number(bankAccountId)
                : null,
          status: status || null,
        },
      );

      // If status changed to POSTED, also approve the voucher
      if (status === "POSTED" && effVoucherId) {
        await query(
          "UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :voucherId AND company_id = :companyId",
          { voucherId: Number(effVoucherId), companyId },
        );
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/pdc-postings/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.MANAGE"),
  requireIdParam("id"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const id = Number(req.params.id);
      const rows = await query(
        "SELECT status FROM fin_pdc_postings WHERE company_id = :companyId AND branch_id = :branchId AND id = :id",
        { companyId, branchId, id },
      );
      const r = rows?.[0];
      if (!r) throw httpError(404, "NOT_FOUND", "PDC not found");
      if (String(r.status) !== "HELD")
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Only HELD PDC can be deleted",
        );
      await query("DELETE FROM fin_pdc_postings WHERE id = :id", { id });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/voucher-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const orderDir =
        String(req.query.order || "")
          .trim()
          .toLowerCase() === "old"
          ? "ASC"
          : "DESC";

      const items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
                v.narration, v.total_debit, v.total_credit, v.status
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ${orderDir}, v.id ${orderDir}`,
        { companyId, branchId, from, to },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/trial-balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const groupId = req.query.groupId ? Number(req.query.groupId) : null;
      const [fyRow] = await query(
        `SELECT id
           FROM fin_fiscal_years
          WHERE company_id = :companyId
            AND (:from IS NULL OR (:from >= start_date AND :from <= end_date))
          ORDER BY start_date DESC
          LIMIT 1`,
        { companyId, from },
      );
      const fyId = fyRow?.id || null;
      const items = await query(
        `SELECT a.id, a.code, a.name, g.nature,
                g.code AS group_code, g.name AS group_name,
                pg.code AS parent_code, pg.name AS parent_name,
                gp.code AS root_code, gp.name AS root_name,
               t1.name AS type_name,
               t2.name AS category_name,
               t3.name AS subcategory_name,
                COALESCE(ob.opening_debit,0) - COALESCE(ob.opening_credit,0) AS ob,
                COALESCE(prev.prev,0) AS prev,
                COALESCE(mov.mov,0) AS mov
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
      LEFT JOIN fin_account_groups pg ON pg.id = g.parent_id AND pg.company_id = g.company_id
      LEFT JOIN fin_account_groups gp ON gp.id = pg.parent_id AND gp.company_id = g.company_id
      LEFT JOIN fin_account_groups t1
             ON t1.company_id = g.company_id
            AND t1.code = SUBSTRING_INDEX(SUBSTRING_INDEX(g.code,'_',1),'.',1)
      LEFT JOIN fin_account_groups t2
             ON t2.company_id = g.company_id
            AND INSTR(g.code,'.') > 0
            AND t2.code = SUBSTRING_INDEX(g.code,'.',2)
      LEFT JOIN fin_account_groups t3
             ON t3.company_id = g.company_id
            AND (INSTR(g.code,'_') > 0 OR (LENGTH(g.code) - LENGTH(REPLACE(g.code,'.',''))) >= 2)
            AND t3.code = g.code
      LEFT JOIN fin_account_opening_balances ob
             ON ob.company_id = a.company_id
            AND ob.account_id = a.id
            AND (:fyId IS NOT NULL AND ob.fiscal_year_id = :fyId)
            AND (ob.branch_id IS NULL OR ob.branch_id = :branchId)
      LEFT JOIN (
                SELECT l.account_id, COALESCE(SUM(l.debit) - SUM(l.credit),0) AS prev
                  FROM fin_voucher_lines l
                  JOIN fin_vouchers v ON v.id = l.voucher_id
                 WHERE v.company_id = :companyId
                   AND v.branch_id = :branchId
                   AND :from IS NOT NULL
                   AND v.voucher_date < :from
                 GROUP BY l.account_id
               ) prev ON prev.account_id = a.id
      LEFT JOIN (
                SELECT l.account_id, COALESCE(SUM(l.debit) - SUM(l.credit),0) AS mov
                  FROM fin_voucher_lines l
                  JOIN fin_vouchers v ON v.id = l.voucher_id
                 WHERE v.company_id = :companyId
                   AND v.branch_id = :branchId
                   AND (:from IS NULL OR v.voucher_date >= :from)
                   AND (:to IS NULL OR v.voucher_date <= :to)
                 GROUP BY l.account_id
               ) mov ON mov.account_id = a.id
          WHERE a.company_id = :companyId
            AND a.is_postable = 1
            AND (:groupId IS NULL OR a.group_id = :groupId)
          ORDER BY a.code`,
        { companyId, branchId, from, to, fyId, groupId },
      );
      const rows = (items || []).map((r) => {
        const opening = Number(r.ob || 0) + Number(r.prev || 0);
        const movement = Number(r.mov || 0);
        const closing = opening + movement;
        const opening_debit = opening > 0 ? opening : 0;
        const opening_credit = opening < 0 ? Math.abs(opening) : 0;
        const movement_debit = movement > 0 ? movement : 0;
        const movement_credit = movement < 0 ? Math.abs(movement) : 0;
        const closing_debit = closing > 0 ? closing : 0;
        const closing_credit = closing < 0 ? Math.abs(closing) : 0;
        const account_type =
          r.type_name || r.root_name || r.parent_name || r.group_name || null;
        const account_category =
          r.category_name ||
          r.parent_name ||
          r.type_name ||
          r.root_name ||
          r.group_name ||
          null;
        const account_subcategory = r.subcategory_name || null;
        return {
          account_id: r.id,
          account_code: r.code,
          account_name: r.name,
          account_type,
          account_category,
          account_subcategory,
          group_code: r.group_code,
          opening_debit,
          opening_credit,
          movement_debit,
          movement_credit,
          closing_debit,
          closing_credit,
        };
      });
      res.json({ items: rows });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/journals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const type = req.query.type ? String(req.query.type).toUpperCase() : null;
      const orderDir =
        String(req.query.order || "")
          .trim()
          .toLowerCase() === "old"
          ? "ASC"
          : "DESC";
      const items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, vt.code AS voucher_type_code,
                l.line_no, a.code AS account_code, a.name AS account_name,
                l.description, l.debit, l.credit
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
           JOIN fin_accounts a ON a.id = l.account_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (:type IS NULL OR vt.code = :type)
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ${orderDir}, v.id ${orderDir}, l.line_no ${orderDir}`,
        { companyId, branchId, from, to, type },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/bank-reconciliation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId } = req.scope;
      const bankAccountId = req.query.bankAccountId
        ? Number(req.query.bankAccountId)
        : null;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const reconciled = req.query.reconciled; // 'reconciled', 'not_reconciled', or 'both'

      if (!bankAccountId) {
        throw httpError(400, "VALIDATION_ERROR", "Bank Account is required");
      }

      const [bankAcc] = await query(
        `SELECT gl_account_id, name FROM fin_bank_accounts WHERE id = :bankAccountId AND company_id = :companyId`,
        { bankAccountId, companyId },
      );
      if (!bankAcc) throw httpError(404, "NOT_FOUND", "Bank Account not found");

      const glAccountId = bankAcc.gl_account_id;

      let sql = `
        SELECT 
          v.voucher_no, 
          v.voucher_date, 
          l.description AS narration, 
          l.debit, 
          l.credit,
          l.cheque_number,
          l.cheque_date,
          (SELECT a2.name 
           FROM fin_voucher_lines l2 
           JOIN fin_accounts a2 ON a2.id = l2.account_id
           WHERE l2.voucher_id = v.id AND l2.account_id <> l.account_id
           LIMIT 1) AS offset_account_name,
          EXISTS(SELECT 1 FROM fin_bank_reconciliation_lines rl WHERE rl.voucher_id = v.id AND rl.cleared = 1) AS is_reconciled
        FROM fin_vouchers v
        JOIN fin_voucher_lines l ON v.id = l.voucher_id
        WHERE v.company_id = :companyId 
          AND v.branch_id = :branchId
          AND l.account_id = :glAccountId
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
        ORDER BY v.voucher_date ASC, v.voucher_no ASC
      `;

      const rows = await query(sql, {
        companyId,
        branchId,
        glAccountId,
        from,
        to,
      });

      const items = rows
        .map((r) => {
          let status = "";
          if (r.is_reconciled) {
            status = "Reconciled";
          } else {
            if (r.credit > 0) status = "Unpresented";
            else if (r.debit > 0) status = "Uncleared";
          }
          return { ...r, status };
        })
        .filter((i) => {
          if (reconciled === "reconciled") return i.is_reconciled;
          if (reconciled === "not_reconciled") return !i.is_reconciled;
          return true;
        });

      res.json({ items, bankName: bankAcc.name });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/general-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const accountId = req.query.accountId
        ? Number(req.query.accountId)
        : null;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      if (!accountId)
        throw httpError(400, "VALIDATION_ERROR", "accountId is required");
      const [accRow] = await query(
        `SELECT a.id, a.code, a.name, g.nature
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE a.company_id = :companyId AND a.id = :accountId`,
        { companyId, accountId },
      );
      if (!accRow) throw httpError(404, "NOT_FOUND", "Account not found");
      const [fyRow] = await query(
        `SELECT id
           FROM fin_fiscal_years
          WHERE company_id = :companyId
            AND (:from IS NULL OR (:from >= start_date AND :from <= end_date))
          ORDER BY start_date DESC
          LIMIT 1`,
        { companyId, from },
      );
      const fyId = fyRow?.id || null;
      const [obRow] = await query(
        `SELECT COALESCE(opening_debit,0) - COALESCE(opening_credit,0) AS ob
           FROM fin_account_opening_balances
          WHERE company_id = :companyId AND account_id = :accountId
            AND (:fyId IS NOT NULL AND fiscal_year_id = :fyId)
            AND (branch_id IS NULL OR branch_id = :branchId)
          LIMIT 1`,
        { companyId, branchId, accountId, fyId },
      );
      const [prevRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit),0) AS prev
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND l.account_id = :accountId
            AND :from IS NOT NULL
            AND v.voucher_date < :from`,
        { companyId, branchId, accountId, from },
      );
      const opening = Number(obRow?.ob || 0) + Number(prevRow?.prev || 0);
      const lines = await query(
        `SELECT v.voucher_date, v.voucher_no, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
                l.line_no, l.description, l.debit, l.credit
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND l.account_id = :accountId
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ASC, v.id ASC, l.line_no ASC`,
        { companyId, branchId, accountId, from, to },
      );
      let balance = opening;
      const items = (lines || []).map((r) => {
        balance += Number(r.debit || 0) - Number(r.credit || 0);
        return {
          voucher_date: r.voucher_date,
          voucher_no: r.voucher_no,
          voucher_type_code: r.voucher_type_code,
          voucher_type_name: r.voucher_type_name,
          line_no: r.line_no,
          description: r.description,
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          balance,
        };
      });
      res.json({
        account: {
          id: accRow.id,
          code: accRow.code,
          name: accRow.name,
          nature: accRow.nature,
        },
        opening_balance: opening,
        items,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/profit-and-loss",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const rows = await query(
        `SELECT g.nature, g.name AS group_name, a.id AS account_id, a.code, a.name,
                COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
      LEFT JOIN fin_voucher_lines l ON l.account_id = a.id
      LEFT JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE a.company_id = :companyId
            AND a.is_postable = 1
            AND (v.id IS NULL OR (v.company_id = :companyId AND v.branch_id = :branchId))
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          GROUP BY g.nature, g.name, a.id, a.code, a.name
          HAVING g.nature IN ('INCOME','EXPENSE')
          ORDER BY g.nature, a.code`,
        { companyId, branchId, from, to },
      );
      const incomeItems = [];
      const expenseItems = [];
      let totalIncome = 0;
      let totalExpense = 0;
      for (const r of rows || []) {
        const amt =
          String(r.nature) === "INCOME"
            ? Number(r.credit || 0) - Number(r.debit || 0)
            : Number(r.debit || 0) - Number(r.credit || 0);
        const item = {
          account_id: r.account_id,
          account_code: r.code,
          account_name: r.name,
          amount: amt,
        };
        if (String(r.nature) === "INCOME") {
          incomeItems.push(item);
          totalIncome += amt;
        } else {
          expenseItems.push(item);
          totalExpense += amt;
        }
      }
      const netProfit = totalIncome - totalExpense;
      res.json({
        income: { items: incomeItems, total: totalIncome },
        expenses: { items: expenseItems, total: totalExpense },
        net_profit: netProfit,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/balance-sheet",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const to = req.query.to ? String(req.query.to) : null;
      const [fyRow] = await query(
        `SELECT id
           FROM fin_fiscal_years
          WHERE company_id = :companyId
          ORDER BY start_date DESC
          LIMIT 1`,
        { companyId },
      );
      const fyId = fyRow?.id || null;
      const rows = await query(
        `SELECT a.id, a.code, a.name, g.nature,
                COALESCE(ob.opening_debit,0) - COALESCE(ob.opening_credit,0) AS ob,
                COALESCE(mov.mov,0) AS mov
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
      LEFT JOIN fin_account_opening_balances ob
             ON ob.company_id = a.company_id
            AND ob.account_id = a.id
            AND (:fyId IS NOT NULL AND ob.fiscal_year_id = :fyId)
            AND (ob.branch_id IS NULL OR ob.branch_id = :branchId)
      LEFT JOIN (
                SELECT l.account_id, COALESCE(SUM(l.debit) - SUM(l.credit),0) AS mov
                  FROM fin_voucher_lines l
                  JOIN fin_vouchers v ON v.id = l.voucher_id
                 WHERE v.company_id = :companyId
                   AND v.branch_id = :branchId
                   AND (:to IS NULL OR v.voucher_date <= :to)
                 GROUP BY l.account_id
               ) mov ON mov.account_id = a.id
          WHERE a.company_id = :companyId
            AND a.is_postable = 1
          ORDER BY a.code`,
        { companyId, branchId, to, fyId },
      );
      const assets = [];
      const liabilities = [];
      const equity = [];
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      for (const r of rows || []) {
        const closingRaw = Number(r.ob || 0) + Number(r.mov || 0);
        const nature = String(r.nature);
        let amount = 0;
        if (nature === "ASSET") amount = closingRaw;
        else amount = -closingRaw;
        const item = {
          account_id: r.id,
          account_code: r.code,
          account_name: r.name,
          amount,
        };
        if (nature === "ASSET") {
          assets.push(item);
          totalAssets += amount;
        } else if (nature === "LIABILITY") {
          liabilities.push(item);
          totalLiabilities += amount;
        } else if (nature === "EQUITY") {
          equity.push(item);
          totalEquity += amount;
        }
      }
      res.json({
        assets: { items: assets, total: totalAssets },
        liabilities: { items: liabilities, total: totalLiabilities },
        equity: { items: equity, total: totalEquity },
        balance: totalAssets - (totalLiabilities + totalEquity),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/cash-flow",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const accounts = await query(
        `SELECT b.id, b.name AS bank_name, a.id AS account_id, a.code, a.name
           FROM fin_bank_accounts b
           JOIN fin_accounts a ON a.id = b.gl_account_id
          WHERE b.company_id = :companyId AND b.branch_id = :branchId`,
        { companyId, branchId },
      );
      const perAccount = [];
      let totalInflow = 0;
      let totalOutflow = 0;
      for (const acc of accounts || []) {
        const [mov] = await query(
          `SELECT COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
             FROM fin_voucher_lines l
             JOIN fin_vouchers v ON v.id = l.voucher_id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND l.account_id = :accountId
              AND (:from IS NULL OR v.voucher_date >= :from)
              AND (:to IS NULL OR v.voucher_date <= :to)`,
          { companyId, branchId, accountId: acc.account_id, from, to },
        );
        const inflow = Number(mov?.debit || 0);
        const outflow = Number(mov?.credit || 0);
        totalInflow += inflow;
        totalOutflow += outflow;
        perAccount.push({
          bank_account_id: acc.id,
          bank_name: acc.bank_name,
          account_id: acc.account_id,
          account_code: acc.code,
          account_name: acc.name,
          inflow,
          outflow,
          net: inflow - outflow,
        });
      }
      res.json({
        items: perAccount,
        totals: {
          inflow: totalInflow,
          outflow: totalOutflow,
          net: totalInflow - totalOutflow,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/payment-due",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items =
        (await query(
          `SELECT 
              b.id,
              b.due_date,
              b.bill_no AS ref_no,
              s.supplier_name AS party_name,
              COALESCE(b.net_amount,0) AS amount,
              (COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)) AS outstanding,
              COALESCE(b.payment_status,'UNPAID') AS status
           FROM pur_bills b
           LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
          WHERE b.company_id = :companyId
            AND b.branch_id = :branchId
            AND (:from IS NULL OR b.due_date >= :from)
            AND (:to IS NULL OR b.due_date <= :to)
            AND (COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)) > 0
          ORDER BY b.due_date ASC, b.bill_no ASC`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/customer-outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const asOf = req.query.asOf ? String(req.query.asOf) : null;
      const items =
        (await query(
          `SELECT 
              i.id,
              c.customer_name,
              i.invoice_no,
              i.invoice_date,
              NULL AS due_date,
              COALESCE(i.total_amount,0) AS amount,
              (COALESCE(i.total_amount,0) - COALESCE(i.balance_amount,0)) AS received,
              COALESCE(i.balance_amount,0) AS outstanding
           FROM sal_invoices i
           LEFT JOIN sal_customers c ON c.id = i.customer_id
          WHERE i.company_id = :companyId
            AND i.branch_id = :branchId
            AND (:asOf IS NULL OR i.invoice_date <= :asOf)
            AND COALESCE(i.balance_amount,0) > 0
          ORDER BY c.customer_name ASC, i.invoice_date ASC, i.id ASC`,
          { companyId, branchId, asOf },
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/supplier-outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const asOf = req.query.asOf ? String(req.query.asOf) : null;
      const items =
        (await query(
          `SELECT 
              b.id,
              s.supplier_name,
              b.bill_no,
              b.bill_date,
              b.due_date,
              COALESCE(b.net_amount,0) AS amount,
              COALESCE(b.amount_paid,0) AS paid,
              (COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)) AS outstanding
           FROM pur_bills b
           LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
          WHERE b.company_id = :companyId
            AND b.branch_id = :branchId
            AND (:asOf IS NULL OR b.bill_date <= :asOf)
            AND (COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)) > 0
          ORDER BY s.supplier_name ASC, b.bill_date ASC, b.id ASC`,
          { companyId, branchId, asOf },
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/debtors-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items =
        (await query(
          `SELECT 
              v.voucher_date AS txn_date,
              v.voucher_no AS doc_no,
              COALESCE(l.description,'') AS description,
              COALESCE(l.debit,0) AS debit,
              COALESCE(l.credit,0) AS credit
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_accounts a ON a.id = l.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (g.code = 'DEBTORS' OR g.name = 'Debtors')
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ASC, v.id ASC, l.line_no ASC`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      // Compute opening from fin_account_opening_balances at fiscal year start plus prior movements
      const [fyRow] = await query(
        `SELECT id
           FROM fin_fiscal_years
          WHERE company_id = :companyId
            AND (:from IS NULL OR (:from >= start_date AND :from <= end_date))
          ORDER BY start_date DESC
          LIMIT 1`,
        { companyId, from },
      );
      const fyId = fyRow?.id || null;
      const [obRow] = await query(
        `SELECT COALESCE(SUM(ob.opening_debit) - SUM(ob.opening_credit),0) AS ob
           FROM fin_account_opening_balances ob
           JOIN fin_accounts a ON a.id = ob.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE ob.company_id = :companyId
            AND (:fyId IS NOT NULL AND ob.fiscal_year_id = :fyId)
            AND (ob.branch_id IS NULL OR ob.branch_id = :branchId)
            AND (g.code = 'DEBTORS' OR g.name = 'Debtors')`,
        { companyId, branchId, fyId },
      );
      const [prevRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit),0) AS prev
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_accounts a ON a.id = l.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (g.code = 'DEBTORS' OR g.name = 'Debtors')
            AND :from IS NOT NULL
            AND v.voucher_date < :from`,
        { companyId, branchId, from },
      );
      const opening = Number(obRow?.ob || 0) + Number(prevRow?.prev || 0);
      const openingRow = {
        txn_date: from || null,
        doc_no: "OPEN",
        description: "Opening Balance",
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? Math.abs(opening) : 0,
      };
      const resultItems = Array.isArray(items)
        ? [openingRow, ...items]
        : [openingRow];
      res.json({ items: resultItems });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/creditors-ledger",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const items =
        (await query(
          `SELECT 
              v.voucher_date AS txn_date,
              v.voucher_no AS doc_no,
              COALESCE(l.description,'') AS description,
              COALESCE(l.debit,0) AS debit,
              COALESCE(l.credit,0) AS credit
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_accounts a ON a.id = l.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (g.code = 'CREDITORS' OR g.name = 'Creditors')
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ASC, v.id ASC, l.line_no ASC`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      // Compute opening from fin_account_opening_balances at fiscal year start plus prior movements
      const [fyRow] = await query(
        `SELECT id
           FROM fin_fiscal_years
          WHERE company_id = :companyId
            AND (:from IS NULL OR (:from >= start_date AND :from <= end_date))
          ORDER BY start_date DESC
          LIMIT 1`,
        { companyId, from },
      );
      const fyId = fyRow?.id || null;
      const [obRow] = await query(
        `SELECT COALESCE(SUM(ob.opening_debit) - SUM(ob.opening_credit),0) AS ob
           FROM fin_account_opening_balances ob
           JOIN fin_accounts a ON a.id = ob.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE ob.company_id = :companyId
            AND (:fyId IS NOT NULL AND ob.fiscal_year_id = :fyId)
            AND (ob.branch_id IS NULL OR ob.branch_id = :branchId)
            AND (g.code = 'CREDITORS' OR g.name = 'Creditors')`,
        { companyId, branchId, fyId },
      );
      const [prevRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit),0) AS prev
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
           JOIN fin_accounts a ON a.id = l.account_id
           JOIN fin_account_groups g ON g.id = a.group_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (g.code = 'CREDITORS' OR g.name = 'Creditors')
            AND :from IS NOT NULL
            AND v.voucher_date < :from`,
        { companyId, branchId, from },
      );
      const opening = Number(obRow?.ob || 0) + Number(prevRow?.prev || 0);
      const openingRow = {
        txn_date: from || null,
        doc_no: "OPEN",
        description: "Opening Balance",
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? Math.abs(opening) : 0,
      };
      const resultItems = Array.isArray(items)
        ? [openingRow, ...items]
        : [openingRow];
      res.json({ items: resultItems });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/audit-trail",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      const params = {};
      const clauses = [];
      if (from) {
        clauses.push("s.event_time >= :from");
        params.from = from;
      }
      if (to) {
        clauses.push("s.event_time < DATE_ADD(:to, INTERVAL 1 DAY)");
        params.to = to;
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const items =
        (await query(
          `
          SELECT 
            s.id,
            s.event_time AS action_time,
            COALESCE(u.username, '') AS user_name,
            COALESCE(s.action,'') AS action,
            COALESCE(s.module_name,'') AS entity,
            COALESCE(s.ref_no,'') AS ref_no,
            COALESCE(s.message,'') AS details
          FROM adm_system_logs s
          LEFT JOIN adm_users u ON u.id = s.user_id
          ${where}
          ORDER BY s.event_time DESC
          LIMIT 500
          `,
          params,
        ).catch(() => [])) || [];
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/ratio-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const from = req.query.from ? String(req.query.from) : null;
      const to = req.query.to ? String(req.query.to) : null;
      const plRows =
        (await query(
          `SELECT g.nature,
                  COALESCE(SUM(l.debit),0) AS debit, 
                  COALESCE(SUM(l.credit),0) AS credit
             FROM fin_accounts a
             JOIN fin_account_groups g ON g.id = a.group_id
        LEFT JOIN fin_voucher_lines l ON l.account_id = a.id
        LEFT JOIN fin_vouchers v ON v.id = l.voucher_id
            WHERE a.company_id = :companyId
              AND a.is_postable = 1
              AND (v.id IS NULL OR (v.company_id = :companyId AND v.branch_id = :branchId))
              AND (:from IS NULL OR v.voucher_date >= :from)
              AND (:to IS NULL OR v.voucher_date <= :to)
            GROUP BY g.nature
            HAVING g.nature IN ('INCOME','EXPENSE')`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      let totalIncome = 0;
      let totalExpense = 0;
      for (const r of plRows) {
        if (String(r.nature) === "INCOME") {
          totalIncome += Number(r.credit || 0) - Number(r.debit || 0);
        } else if (String(r.nature) === "EXPENSE") {
          totalExpense += Number(r.debit || 0) - Number(r.credit || 0);
        }
      }
      const bsRows =
        (await query(
          `SELECT g.nature,
                  a.id AS account_id,
                  COALESCE(ob.opening_debit,0) - COALESCE(ob.opening_credit,0) AS ob,
                  COALESCE(mov.mov,0) AS mov
             FROM fin_accounts a
             JOIN fin_account_groups g ON g.id = a.group_id
        LEFT JOIN fin_account_opening_balances ob
               ON ob.company_id = a.company_id
              AND ob.account_id = a.id
        LEFT JOIN (
                  SELECT l.account_id, COALESCE(SUM(l.debit) - SUM(l.credit),0) AS mov
                    FROM fin_voucher_lines l
                    JOIN fin_vouchers v ON v.id = l.voucher_id
                   WHERE v.company_id = :companyId
                     AND v.branch_id = :branchId
                     AND (:to IS NULL OR v.voucher_date <= :to)
                   GROUP BY l.account_id
                 ) mov ON mov.account_id = a.id
            WHERE a.company_id = :companyId
              AND a.is_postable = 1`,
          { companyId, branchId, to },
        ).catch(() => [])) || [];
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      for (const r of bsRows) {
        const closing = Number(r.ob || 0) + Number(r.mov || 0);
        if (String(r.nature) === "ASSET") {
          totalAssets += closing;
        } else if (String(r.nature) === "LIABILITY") {
          totalLiabilities += -closing;
        } else if (String(r.nature) === "EQUITY") {
          totalEquity += -closing;
        }
      }
      const netProfit = totalIncome - totalExpense;
      const items = [];
      const safeDiv = (a, b) => {
        const x = Number(a || 0);
        const y = Number(b || 0);
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(y) < 1e-9)
          return 0;
        return x / y;
      };
      items.push({
        key: "net_profit_margin",
        name: "Net Profit Margin",
        value: safeDiv(netProfit, totalIncome),
        notes: "Net Profit / Total Income",
      });
      items.push({
        key: "assets_to_liabilities",
        name: "Assets to Liabilities",
        value: safeDiv(totalAssets, totalLiabilities),
        notes: "Total Assets / Total Liabilities",
      });
      items.push({
        key: "debt_to_equity",
        name: "Debt to Equity",
        value: safeDiv(totalLiabilities, totalEquity),
        notes: "Total Liabilities / Total Equity",
      });
      items.push({
        key: "return_on_equity",
        name: "Return on Equity",
        value: safeDiv(netProfit, totalEquity),
        notes: "Net Profit / Total Equity",
      });
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

// Dashboard metrics: YTD cards + AR/AP monthly trend
router.get(
  "/dashboard/metrics",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.VOUCHER.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const [fyRow] =
        (await query(
          `SELECT id, start_date
             FROM fin_fiscal_years
            WHERE company_id = :companyId
            ORDER BY start_date DESC
            LIMIT 1`,
          { companyId },
        ).catch(() => [])) || [];
      const now = new Date();
      const fromDefault =
        fyRow?.start_date || new Date(now.getFullYear(), 0, 1);
      const qFrom = req.query.from ? new Date(String(req.query.from)) : null;
      const qTo = req.query.to ? new Date(String(req.query.to)) : null;
      const from =
        qFrom && !Number.isNaN(qFrom.getTime()) ? qFrom : fromDefault;
      const to = qTo && !Number.isNaN(qTo.getTime()) ? qTo : now;
      async function sumMovementsForAccounts(accIds) {
        if (!accIds || !accIds.length) return 0;
        const rows = (await query(
          `SELECT COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
               FROM fin_voucher_lines l
               JOIN fin_vouchers v ON v.id = l.voucher_id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND v.voucher_date BETWEEN :from AND :to
                AND l.account_id IN (${accIds
                  .map((_, i) => `:a${i}`)
                  .join(",")})`,
          accIds.reduce((p, id, i) => Object.assign(p, { [`a${i}`]: id }), {
            companyId,
            branchId,
            from,
            to,
          }),
        ).catch(() => [])) || [{ debit: 0, credit: 0 }];
        const d = Number(rows?.[0]?.debit || 0);
        const c = Number(rows?.[0]?.credit || 0);
        return d - c;
      }
      const bankAccRows =
        (await query(
          `SELECT b.gl_account_id AS id
             FROM fin_bank_accounts b
            WHERE b.company_id = :companyId AND b.branch_id = :branchId`,
          { companyId, branchId },
        ).catch(() => [])) || [];
      const bankAccIds = bankAccRows
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n));
      const ytdBank = await sumMovementsForAccounts(bankAccIds);
      const cashAccRows =
        (await query(
          `SELECT a.id
             FROM fin_accounts a
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE a.company_id = :companyId
              AND g.nature = 'ASSET'
              AND (LOWER(a.name) LIKE '%cash%' OR LOWER(a.code) LIKE 'cash%')`,
          { companyId },
        ).catch(() => [])) || [];
      const cashAccIds = cashAccRows
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n));
      const ytdCash = await sumMovementsForAccounts(cashAccIds);
      const expAccRows =
        (await query(
          `SELECT a.id 
             FROM fin_accounts a 
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE a.company_id = :companyId AND g.nature = 'EXPENSE'`,
          { companyId },
        ).catch(() => [])) || [];
      const expIds = expAccRows
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n));
      const ytdIndirectExpenses = await sumMovementsForAccounts(expIds);
      const incAccRows =
        (await query(
          `SELECT a.id 
             FROM fin_accounts a 
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE a.company_id = :companyId AND g.nature = 'INCOME'`,
          { companyId },
        ).catch(() => [])) || [];
      const incIds = incAccRows
        .map((r) => Number(r.id))
        .filter((n) => Number.isFinite(n));
      const ytdSales = (await sumMovementsForAccounts(incIds)) * -1;
      const arAccRows =
        (await query(
          `SELECT a.id
             FROM fin_accounts a
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE a.company_id = :companyId
              AND (LOWER(g.name) LIKE '%debtor%' OR LOWER(g.name) LIKE '%receiv%')`,
          { companyId },
        ).catch(() => [])) || [];
      const apAccRows =
        (await query(
          `SELECT a.id
             FROM fin_accounts a
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE a.company_id = :companyId
              AND (LOWER(g.name) LIKE '%creditor%' OR LOWER(g.name) LIKE '%payabl%')`,
          { companyId },
        ).catch(() => [])) || [];
      async function monthlyTrendFor(accIds) {
        if (!accIds || !accIds.length) return [];
        const rows =
          (await query(
            `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                    COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS mov
               FROM fin_voucher_lines l
               JOIN fin_vouchers v ON v.id = l.voucher_id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND v.voucher_date BETWEEN :from AND :to
                AND l.account_id IN (${accIds
                  .map((_, i) => `:m${i}`)
                  .join(",")})
              GROUP BY ym
              ORDER BY ym`,
            accIds.reduce((p, id, i) => Object.assign(p, { [`m${i}`]: id }), {
              companyId,
              branchId,
              from,
              to,
            }),
          ).catch(() => [])) || [];
        return rows.map((r) => ({
          ym: r.ym,
          value: Number(r.mov || 0),
        }));
      }
      // Prefer transactional trends from invoices/bills (db-agnostic of group names)
      const arTrendRows =
        (await query(
          `SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS ym,
                  COALESCE(SUM(i.balance_amount),0) AS val
             FROM sal_invoices i
            WHERE i.company_id = :companyId
              AND i.branch_id = :branchId
              AND i.invoice_date BETWEEN :from AND :to
            GROUP BY ym
            ORDER BY ym`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      const apTrendRows =
        (await query(
          `SELECT DATE_FORMAT(b.bill_date, '%Y-%m') AS ym,
                  COALESCE(SUM(COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)),0) AS val
             FROM pur_bills b
            WHERE b.company_id = :companyId
              AND b.branch_id = :branchId
              AND b.bill_date BETWEEN :from AND :to
            GROUP BY ym
            ORDER BY ym`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      const arTrend = arTrendRows.map((r) => ({
        ym: r.ym,
        value: Number(r.val || 0),
      }));
      const apTrend = apTrendRows.map((r) => ({
        ym: r.ym,
        value: Number(r.val || 0),
      }));
      // Receivables/Payables breakdown from transactions
      const recvRows =
        (await query(
          `SELECT 
              UPPER(COALESCE(c.customer_type,'OTHER')) AS customer_type,
              COALESCE(SUM(i.balance_amount),0) AS outstanding
           FROM sal_invoices i
           LEFT JOIN sal_customers c
             ON c.id = i.customer_id AND c.company_id = i.company_id
          WHERE i.company_id = :companyId
            AND i.branch_id = :branchId
            AND i.invoice_date BETWEEN :from AND :to
          GROUP BY UPPER(COALESCE(c.customer_type,'OTHER'))`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      const payRows =
        (await query(
          `SELECT 
              UPPER(COALESCE(s.supplier_type, b.bill_type, 'OTHER')) AS supplier_type,
              COALESCE(SUM(COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)),0) AS outstanding
           FROM pur_bills b
           LEFT JOIN pur_suppliers s
             ON s.id = b.supplier_id AND s.company_id = b.company_id
          WHERE b.company_id = :companyId
            AND b.branch_id = :branchId
            AND b.bill_date BETWEEN :from AND :to
          GROUP BY UPPER(COALESCE(s.supplier_type, b.bill_type, 'OTHER'))`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      function bucketReceivable(row) {
        const t = String(row.customer_type || "").toUpperCase();
        return t.includes("TRADE") ? "Trade Debtors" : "Debtors";
      }
      function bucketPayable(row) {
        const t = String(row.supplier_type || "").toUpperCase();
        if (t.includes("IMPORT") || t.includes("TAX") || t.includes("DUTY"))
          return "Duties and Taxes";
        if (t.includes("TRADE")) return "Trade Creditors";
        if (t.includes("LOCAL")) return "Creditors";
        return "Other Creditors";
      }
      const arBreakdownMap = new Map();
      for (const r of recvRows) {
        const k = bucketReceivable(r);
        arBreakdownMap.set(
          k,
          (arBreakdownMap.get(k) || 0) + Number(r.outstanding || 0),
        );
      }
      const apBreakdownMap = new Map();
      for (const r of payRows) {
        const k = bucketPayable(r);
        apBreakdownMap.set(
          k,
          (apBreakdownMap.get(k) || 0) + Number(r.outstanding || 0),
        );
      }
      const arBreakdown = Array.from(arBreakdownMap.entries()).map(
        ([label, value]) => ({
          label,
          value,
        }),
      );
      const apBreakdown = Array.from(apBreakdownMap.entries()).map(
        ([label, value]) => ({
          label,
          value,
        }),
      );
      // Bank/Cash trend line (monthly net)
      async function monthlyNetFor(accIds) {
        if (!accIds || !accIds.length) return [];
        const rows =
          (await query(
            `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                    COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS net
               FROM fin_voucher_lines l
               JOIN fin_vouchers v ON v.id = l.voucher_id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND v.voucher_date BETWEEN :from AND :to
                AND l.account_id IN (${bankAccIds.map((_, i) => `:bn${i}`).join(",")})
              GROUP BY ym
              ORDER BY ym`,
            bankAccIds.reduce(
              (p, id, i) => Object.assign(p, { [`bn${i}`]: id }),
              { companyId, branchId, from, to },
            ),
          ).catch(() => [])) || [];
        return rows.map((r) => ({ ym: r.ym, value: Number(r.net || 0) }));
      }
      const bankTrend = await monthlyNetFor(bankAccIds);
      async function monthlyNetForCash(accIds) {
        if (!accIds || !accIds.length) return [];
        const rows =
          (await query(
            `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                    COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS net
               FROM fin_voucher_lines l
               JOIN fin_vouchers v ON v.id = l.voucher_id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND v.voucher_date BETWEEN :from AND :to
                AND l.account_id IN (${cashAccIds.map((_, i) => `:cn${i}`).join(",")})
              GROUP BY ym
              ORDER BY ym`,
            cashAccIds.reduce(
              (p, id, i) => Object.assign(p, { [`cn${i}`]: id }),
              { companyId, branchId, from, to },
            ),
          ).catch(() => [])) || [];
        return rows.map((r) => ({ ym: r.ym, value: Number(r.net || 0) }));
      }
      const cashTrend = await monthlyNetForCash(cashAccIds);
      // Inflow vs Outflow (bank accounts) monthly
      async function monthlyInflowOutflowFor(accIds) {
        if (!accIds || !accIds.length) return [];
        const rows =
          (await query(
            `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                    COALESCE(SUM(l.debit),0) AS inflow,
                    COALESCE(SUM(l.credit),0) AS outflow
               FROM fin_voucher_lines l
               JOIN fin_vouchers v ON v.id = l.voucher_id
              WHERE v.company_id = :companyId
                AND v.branch_id = :branchId
                AND v.voucher_date BETWEEN :from AND :to
                AND l.account_id IN (${accIds.map((_, i) => `:io${i}`).join(",")})
              GROUP BY ym
              ORDER BY ym`,
            accIds.reduce((p, id, i) => Object.assign(p, { [`io${i}`]: id }), {
              companyId,
              branchId,
              from,
              to,
            }),
          ).catch(() => [])) || [];
        return rows.map((r) => ({
          ym: r.ym,
          inflow: Number(r.inflow || 0),
          outflow: Number(r.outflow || 0),
        }));
      }
      const cashflowTrend = await monthlyInflowOutflowFor(bankAccIds);
      // Income vs Expense monthly
      const incMonthly =
        (await query(
          `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                  COALESCE(SUM(l.credit),0) - COALESCE(SUM(l.debit),0) AS income
             FROM fin_voucher_lines l
             JOIN fin_vouchers v ON v.id = l.voucher_id
             JOIN fin_accounts a ON a.id = l.account_id
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND v.voucher_date BETWEEN :from AND :to
              AND g.nature = 'INCOME'
            GROUP BY ym
            ORDER BY ym`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      const expMonthly =
        (await query(
          `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
                  COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS expense
             FROM fin_voucher_lines l
             JOIN fin_vouchers v ON v.id = l.voucher_id
             JOIN fin_accounts a ON a.id = l.account_id
             JOIN fin_account_groups g ON g.id = a.group_id
            WHERE v.company_id = :companyId
              AND v.branch_id = :branchId
              AND v.voucher_date BETWEEN :from AND :to
              AND g.nature = 'EXPENSE'
            GROUP BY ym
            ORDER BY ym`,
          { companyId, branchId, from, to },
        ).catch(() => [])) || [];
      const incomeExpenseTrend = [];
      const idx = new Map();
      for (const r of incMonthly) {
        const ym = r.ym;
        idx.set(ym, { ym, income: Number(r.income || 0), expense: 0 });
      }
      for (const r of expMonthly) {
        const ym = r.ym;
        const cur = idx.get(ym) || { ym, income: 0, expense: 0 };
        cur.expense = Number(r.expense || 0);
        idx.set(ym, cur);
      }
      for (const v of idx.values()) incomeExpenseTrend.push(v);
      // YTD Customers (Debtors) and Suppliers (Creditors) from transactions
      const [arYtdRow] = (await query(
        `SELECT COALESCE(SUM(i.balance_amount),0) AS ar
             FROM sal_invoices i
            WHERE i.company_id = :companyId
              AND i.branch_id = :branchId
              AND i.invoice_date BETWEEN :from AND :to`,
        { companyId, branchId, from, to },
      ).catch(() => [])) || [{ ar: 0 }];
      const [apYtdRow] = (await query(
        `SELECT COALESCE(SUM(COALESCE(b.net_amount,0) - COALESCE(b.amount_paid,0)),0) AS ap
             FROM pur_bills b
            WHERE b.company_id = :companyId
              AND b.branch_id = :branchId
              AND b.bill_date BETWEEN :from AND :to`,
        { companyId, branchId, from, to },
      ).catch(() => [])) || [{ ap: 0 }];
      const ytdDebtors = Math.abs(Number(arYtdRow?.ar || 0));
      const ytdDebtorsSide = "DR";
      const ytdCreditors = Math.abs(Number(apYtdRow?.ap || 0));
      const ytdCreditorsSide = "CR";
      res.json({
        ytd: {
          bank_total: ytdBank,
          cash_in_hand: ytdCash,
          indirect_expenses: ytdIndirectExpenses,
          sales: ytdSales,
          debtors: ytdDebtors,
          debtors_side: ytdDebtorsSide,
          creditors: ytdCreditors,
          creditors_side: ytdCreditorsSide,
        },
        ar_trend: arTrend,
        ap_trend: apTrend,
        ar_breakdown: arBreakdown,
        ap_breakdown: apBreakdown,
        bank_trend: bankTrend,
        cash_trend: cashTrend,
        cashflow_trend: cashflowTrend,
        income_expense_trend: incomeExpenseTrend,
        from,
        to,
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
