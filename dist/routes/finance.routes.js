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
      up === "PV" || up === "CV" || up === "RV"
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
      if (!groupId || !code || !name)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "groupId, code, name are required",
        );

      const result = await query(
        `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
         VALUES (:companyId, :groupId, :code, :name, :currencyId, :isControlAccount, :isPostable, :isActive)`,
        {
          companyId,
          groupId,
          code,
          name,
          currencyId: currencyId || null,
          isControlAccount: Number(Boolean(isControlAccount)),
          isPostable:
            isPostable === undefined ? 1 : Number(Boolean(isPostable)),
          isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
        },
      );
      res.status(201).json({ id: result.insertId });
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
      const items = await query(
        "SELECT id, code, name, rate_percent, type, is_active, created_at, updated_at FROM fin_tax_codes WHERE company_id = :companyId ORDER BY code ASC",
        { companyId },
      );
      res.json({ items });
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

      const items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, v.narration, v.total_debit, v.total_credit, v.status,
                vt.code AS voucher_type_code, vt.name AS voucher_type_name
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (:voucherTypeCode IS NULL OR vt.code = :voucherTypeCode)
          ORDER BY v.voucher_date DESC, v.id DESC`,
        { companyId, branchId, voucherTypeCode },
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
        `SELECT l.id, l.line_no, l.account_id, a.code AS account_code, a.name AS account_name, l.description, l.debit, l.credit, l.tax_code_id, l.reference_no
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

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, 'DRAFT', :createdBy)`,
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
          createdBy: req.user?.sub || null,
        },
      );
      const voucherId = result.insertId;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo)`,
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
          },
        );
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
        "SELECT line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no FROM fin_voucher_lines WHERE voucher_id = :id ORDER BY line_no ASC",
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
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo)`,
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
             (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
             (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :costCenter, :referenceNo)`,
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
      if (!statementDate || amount === undefined) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "statementDate and amount are required",
        );
      }
      if (Number(amount || 0) === 0) {
        throw httpError(400, "VALIDATION_ERROR", "amount must be non-zero");
      }
      const headers = await query(
        "SELECT statement_from, statement_to FROM fin_bank_reconciliations WHERE id = :id",
        { id: reconciliationId },
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
        `SELECT r.statement_from, r.statement_to, r.statement_ending_balance, b.gl_account_id
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

      const [openRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS bal
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE v.company_id = :companyId AND v.branch_id = :branchId
            AND l.account_id = :glAccountId
            AND v.voucher_date < :from`,
        { companyId, branchId, glAccountId, from },
      );
      const [moveRow] = await query(
        `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) AS mov
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
          WHERE v.company_id = :companyId AND v.branch_id = :branchId
            AND l.account_id = :glAccountId
            AND v.voucher_date >= :from AND v.voucher_date <= :to`,
        { companyId, branchId, glAccountId, from, to },
      );
      const [clearedRow] = await query(
        `SELECT COALESCE(SUM(amount), 0) AS amt
           FROM fin_bank_reconciliation_lines
          WHERE reconciliation_id = :id AND cleared = 1`,
        { id },
      );
      const [unclearedRow] = await query(
        `SELECT COALESCE(SUM(amount), 0) AS amt
           FROM fin_bank_reconciliation_lines
          WHERE reconciliation_id = :id AND (cleared IS NULL OR cleared = 0)`,
        { id },
      );
      const opening = Number(openRow?.bal || 0);
      const movement = Number(moveRow?.mov || 0);
      const bookEnding = opening + movement;
      const bankEnding = Number(rec.statement_ending_balance || 0);
      const clearedTotal = Number(clearedRow?.amt || 0);
      const unclearedTotal = Number(unclearedRow?.amt || 0);
      const diffBankVsCleared = bankEnding - clearedTotal;
      const diffBankVsBook = bankEnding - bookEnding;
      const outstandingEstimate = bookEnding - clearedTotal;

      res.json({
        openingBookBalance: opening,
        periodBookMovement: movement,
        endingBookBalance: bookEnding,
        statementEndingBalance: bankEnding,
        clearedTotal,
        unclearedTotal,
        diffBankVsCleared,
        diffBankVsBook,
        outstandingEstimate,
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
  "/pdc-postings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("FIN.BANK_RECON.VIEW"),
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const branchId = req.scope.branchId;
      const items = await query(
        `SELECT p.id, p.instrument_no, p.instrument_date, p.status, p.voucher_id, v.voucher_no, p.created_at
           FROM fin_pdc_postings p
           JOIN fin_vouchers v ON v.id = p.voucher_id
          WHERE p.company_id = :companyId AND p.branch_id = :branchId
          ORDER BY p.id DESC`,
        { companyId, branchId },
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
      const result = await query(
        `INSERT INTO fin_pdc_postings
           (company_id, branch_id, voucher_id, instrument_no, instrument_date, bank_account_id, status)
         VALUES
           (:companyId, :branchId, :voucherId, :instrumentNo, :instrumentDate, :bankAccountId, :status)`,
        {
          companyId,
          branchId,
          voucherId: Number(voucherId),
          instrumentNo: String(instrumentNo),
          instrumentDate: instrumentDate,
          bankAccountId: bankAccountId ? Number(bankAccountId) : null,
          status: status || "HELD",
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

      const items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
                v.narration, v.total_debit, v.total_credit, v.status
           FROM fin_vouchers v
           JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
          WHERE v.company_id = :companyId
            AND v.branch_id = :branchId
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date DESC, v.id DESC`,
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
                COALESCE(ob.opening_debit,0) - COALESCE(ob.opening_credit,0) AS ob,
                COALESCE(prev.prev,0) AS prev,
                COALESCE(mov.mov,0) AS mov
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
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
          ORDER BY a.code`,
        { companyId, branchId, from, to, fyId },
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
        return {
          account_id: r.id,
          account_code: r.code,
          account_name: r.name,
          nature: r.nature,
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
            AND vt.category = 'JOURNAL'
            AND (:from IS NULL OR v.voucher_date >= :from)
            AND (:to IS NULL OR v.voucher_date <= :to)
          ORDER BY v.voucher_date ASC, v.id ASC, l.line_no ASC`,
        { companyId, branchId, from, to },
      );
      res.json({ items });
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
        `SELECT v.voucher_date, v.voucher_no, l.line_no, l.description, l.debit, l.credit
           FROM fin_voucher_lines l
           JOIN fin_vouchers v ON v.id = l.voucher_id
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

export default router;
