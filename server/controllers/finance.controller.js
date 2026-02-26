import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as XLSX from "xlsx";

function requireIdParam(name) {
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
      up === "PV" || up === "CV" || up === "RV"
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
      const [accRows] = await conn.execute(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(debtorsGroupId)) {
        await conn.execute(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: debtorsGroupId, id: acc.id, companyId },
        );
        customersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.execute(
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
    const [supRows] = await conn.execute(
      "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId",
      { companyId },
    );
    for (const r of supRows || []) {
      let code =
        r.supplier_code && String(r.supplier_code).trim()
          ? String(r.supplier_code).trim()
          : `SU-${String(Number(r.id || 0)).padStart(6, "0")}`;
      const [accRows] = await conn.execute(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(creditorsGroupId)) {
        await conn.execute(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: creditorsGroupId, id: acc.id, companyId },
        );
        suppliersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.execute(
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
    await conn.execute(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code REGEXP '^C[0-9]{5}$'",
      { companyId, groupId: debtorsGroupId },
    );
    await conn.execute(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code REGEXP '^SU-[0-9]{6}$'",
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

export const createTaxCode = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { code, name, ratePercent, type, isActive } = req.body || {};
    if (!code || !name || !type)
      throw httpError(400, "VALIDATION_ERROR", "code, name, type are required");
    if (!["TAX", "DEDUCTION"].includes(String(type)))
      throw httpError(400, "VALIDATION_ERROR", "Invalid type");
    const result = await query(
      `INSERT INTO fin_tax_codes (company_id, code, name, rate_percent, type, is_active)
       VALUES (:companyId, :code, :name, :ratePercent, :type, :isActive)`,
      {
        companyId,
        code,
        name,
        ratePercent: Number(ratePercent || 0),
        type: String(type),
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
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
    const taxCodeId = Number(req.params.taxCodeId);
    const { name, ratePercent, type, isActive } = req.body || {};
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
             is_active = COALESCE(:isActive, is_active)
       WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: taxCodeId,
        name: name || null,
        ratePercent:
          ratePercent === undefined ? null : Number(ratePercent || 0),
        type: type || null,
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
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
    const taxCodeId = Number(req.params.taxCodeId);
    const { componentName, ratePercent, sortOrder, isActive } = req.body || {};
    if (!taxCodeId)
      return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
    if (!componentName)
      throw httpError(400, "VALIDATION_ERROR", "componentName is required");
    const detail = await query(
      `INSERT INTO fin_tax_details (company_id, tax_code_id, component_name, rate_percent, is_active)
       VALUES (:companyId, :taxCodeId, :componentName, :ratePercent, :isActive)`,
      {
        companyId,
        taxCodeId,
        componentName,
        ratePercent: Number(ratePercent || 0),
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

export { requireIdParam };

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
    const currencyId = Number(req.params.currencyId);
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
    const rateId = Number(req.params.rateId);
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
    const rateId = Number(req.params.rateId);
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
    const fiscalYearId = Number(req.params.fiscalYearId);
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
    const fiscalYearId = Number(req.params.fiscalYearId);
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
    const id = Number(req.params.accountGroupId);
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
    const id = Number(req.params.accountGroupId);
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
