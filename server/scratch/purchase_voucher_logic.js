async function loadTaxComponentsByCodeTx(conn, { companyId, taxCodeId }) {
  const [rows] = await conn.execute(
    `SELECT c.tax_detail_id,
            COALESCE(c.rate_percent, d.rate_percent, 0) AS rate_percent,
            COALESCE(c.compound_level, 0) AS compound_level,
            COALESCE(c.sort_order, 100) AS sort_order,
            d.component_name
       FROM fin_tax_components c
       JOIN fin_tax_details d
         ON d.id = c.tax_detail_id
      WHERE c.company_id = :companyId
        AND c.tax_code_id = :taxCodeId
        AND c.is_active = 1
      ORDER BY c.compound_level ASC, c.sort_order ASC, d.component_name ASC`,
    { companyId, taxCodeId },
  );
  return Array.isArray(rows) ? rows : [];
}
function allocateTaxComponents(baseAmount, taxAmount, components) {
  const base = Math.max(0, Number(baseAmount || 0));
  const expectedTax = Math.max(0, Number(taxAmount || 0));
  const list = Array.isArray(components) ? components : [];
  if (!list.length || !(expectedTax > 0)) return [];
  const grouped = new Map();
  for (const comp of list) {
    const level = Number(comp.compound_level || 0);
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(comp);
  }
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  let currentBase = base;
  const raw = [];
  for (const level of levels) {
    const comps = grouped.get(level) || [];
    let levelTotal = 0;
    for (const comp of comps) {
      const amt = (currentBase * Number(comp.rate_percent || 0)) / 100;
      raw.push({ ...comp, amount: amt });
      levelTotal += amt;
    }
    currentBase += levelTotal;
  }
  const rounded = raw.map((r) => ({
    ...r,
    amount: Math.round(Number(r.amount || 0) * 100) / 100,
  }));
  const totalRounded = rounded.reduce((s, r) => s + Number(r.amount || 0), 0);
  const diff = Math.round((expectedTax - totalRounded) * 100) / 100;
  if (rounded.length && Math.abs(diff) > 0.00001) {
    rounded[rounded.length - 1].amount =
      Math.round(
        (Number(rounded[rounded.length - 1].amount || 0) + diff) * 100,
      ) / 100;
  }
  return rounded.filter((r) => Number(r.amount || 0) > 0);
}

async function calculateInvoiceTaxLines(
  conn,
  { companyId, details, taxTotal },
) {
  const voucherTaxLines = [];
  for (const l of details) {
    const qty = Number(l.qty || l.quantity || 0);
    const price = Number(l.unit_price || 0);
    const discPct = Number(l.discount_percent || 0);
    const gross = qty * price;
    const discount = (gross * discPct) / 100;
    const net = gross - discount;
    const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
    const taxCodeId = Number(l.tax_type || l.taxType || l.tax_id || 0) || 0;
    if (taxCodeId && taxAmt > 0) {
      const components = await loadTaxComponentsByCodeTx(conn, {
        companyId,
        taxCodeId,
      });
      const allocations = allocateTaxComponents(net, taxAmt, components);
      if (allocations.length) {
        voucherTaxLines.push(...allocations);
      }
    }

function allocateTaxComponents(baseAmount, taxAmount, components) {
  const base = Math.max(0, Number(baseAmount || 0));
  const expectedTax = Math.max(0, Number(taxAmount || 0));
  const list = Array.isArray(components) ? components : [];
  if (!list.length || !(expectedTax > 0)) return [];
  const grouped = new Map();
  for (const comp of list) {
    const level = Number(comp.compound_level || 0);
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(comp);
  }
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  let currentBase = base;
  const raw = [];
  for (const level of levels) {
    const comps = grouped.get(level) || [];
    let levelTotal = 0;
    for (const comp of comps) {
      const amt = (currentBase * Number(comp.rate_percent || 0)) / 100;
      raw.push({ ...comp, amount: amt });
      levelTotal += amt;
    }
    currentBase += levelTotal;
  }
  const rounded = raw.map((r) => ({
    ...r,
    amount: Math.round(Number(r.amount || 0) * 100) / 100,
  }));
  const totalRounded = rounded.reduce((s, r) => s + Number(r.amount || 0), 0);
  const diff = Math.round((expectedTax - totalRounded) * 100) / 100;
  if (rounded.length && Math.abs(diff) > 0.00001) {
    rounded[rounded.length - 1].amount =
      Math.round(
        (Number(rounded[rounded.length - 1].amount || 0) + diff) * 100,
      ) / 100;
  }
  return rounded.filter((r) => Number(r.amount || 0) > 0);
}

async function calculateInvoiceTaxLines(
  conn,
  { companyId, details, taxTotal },
) {
  const voucherTaxLines = [];
  for (const l of details) {
    const qty = Number(l.qty || l.quantity || 0);
    const price = Number(l.unit_price || 0);
    const discPct = Number(l.discount_percent || 0);
    const gross = qty * price;
    const discount = (gross * discPct) / 100;
    const net = gross - discount;
    const taxAmt = Number(l.taxAmt || l.tax_amount || 0);
    const taxCodeId = Number(l.tax_type || l.taxType || l.tax_id || 0) || 0;
    if (taxCodeId && taxAmt > 0) {
      const components = await loadTaxComponentsByCodeTx(conn, {
        companyId,
        taxCodeId,
      });
      const allocations = allocateTaxComponents(net, taxAmt, components);
      if (allocations.length) {
        voucherTaxLines.push(...allocations);
      }
    }

async function ensureGroupIdTx(
  conn,
  { companyId, code, name, nature, parentId = null },
) {
  const [existingRows] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND (code = :code OR name = :name) LIMIT 1",
    { companyId, code, name },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  if (existingId) return existingId;
  const [ins] = await conn.execute(
    `INSERT INTO fin_account_groups
      (company_id, code, name, nature, parent_id, is_active)
     VALUES
      (:companyId, :code, :name, :nature, :parentId, 1)`,
    { companyId, code, name, nature, parentId },
  );
  return Number(ins?.insertId || 0) || 0;
}
async function resolveUniqueAccountCodeTx(
  conn,
  { companyId, preferredCode, ownerAccountId, fallbackPrefix },
) {
  const preferred = String(preferredCode || "").trim();
  const ownerId = Number(ownerAccountId || 0) || 0;
  const baseFallback = String(fallbackPrefix || "ACC")
    .trim()
    .replace(/\s+/g, "-");
  const candidates = [];
  if (preferred) candidates.push(preferred);
  candidates.push(baseFallback);
  for (let i = 1; i <= 50; i += 1) candidates.push(`${baseFallback}-${i}`);
  for (const candidate of candidates) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code: candidate },
    );
    const existingId = Number(rows?.[0]?.id || 0) || 0;
    if (!existingId || existingId === ownerId) return candidate;
  }
  return preferred || `${baseFallback}-${Date.now()}`;
}
async function resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code }) {
  const wanted = String(code || "")
    .trim()
    .toUpperCase();
  if (wanted) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND UPPER(code) = :code LIMIT 1",
      { companyId, code: wanted },
    );
    const id = Number(rows?.[0]?.id || 0) || 0;
    if (id) return id;
  }
  const [baseRows] = await conn.execute(
    "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
    { companyId },
  );
  return Number(baseRows?.[0]?.id || 0) || 0;
}
async function ensureCustomerFinAccountIdTx(conn, { companyId, customerId }) {
  const [custRows] = await conn.execute(
    "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: customerId },
  );
  const cust = custRows?.[0] || null;
  if (!cust) return 0;
  const targetId = Number(cust.id || 0) || 0;
  const code = await resolveUniqueAccountCodeTx(conn, {
    companyId,
    preferredCode: `C${String(targetId).padStart(5, "0")}`,
    ownerAccountId: targetId,
    fallbackPrefix: `CUST-${targetId}`,
  });
  const debtorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "DEBTORS",
    name: "Debtors",
    nature: "ASSET",
  });
  const [accByIdRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: targetId },
  );
  const existingById = Number(accByIdRows?.[0]?.id || 0) || 0;
  if (existingById) {
    await conn.execute(
      `UPDATE fin_accounts
          SET group_id = :groupId,
              code = :code,
              name = :name,
              currency_id = :currencyId,
              is_active = 1,
              is_postable = 1
        WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: targetId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId: Number(cust.currency_id || 0) || null,
      },
    );
    return existingById;
  }
  const currencyId =
    Number(cust.currency_id || 0) ||
    (await resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code: "GHS" })) ||
    null;
  try {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts
        (id, company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES
        (:id, :companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      {
        id: targetId,
        companyId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId,
      },
    );
    return Number(ins?.insertId || 0) || targetId;
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
    const [accRows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    return Number(accRows?.[0]?.id || 0) || 0;
  }
}

async function resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code }) {
  const wanted = String(code || "")
    .trim()
    .toUpperCase();
  if (wanted) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND UPPER(code) = :code LIMIT 1",
      { companyId, code: wanted },
    );
    const id = Number(rows?.[0]?.id || 0) || 0;
    if (id) return id;
  }
  const [baseRows] = await conn.execute(
    "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
    { companyId },
  );
  return Number(baseRows?.[0]?.id || 0) || 0;
}
async function ensureCustomerFinAccountIdTx(conn, { companyId, customerId }) {
  const [custRows] = await conn.execute(
    "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: customerId },
  );
  const cust = custRows?.[0] || null;
  if (!cust) return 0;
  const targetId = Number(cust.id || 0) || 0;
  const code = await resolveUniqueAccountCodeTx(conn, {
    companyId,
    preferredCode: `C${String(targetId).padStart(5, "0")}`,
    ownerAccountId: targetId,
    fallbackPrefix: `CUST-${targetId}`,
  });
  const debtorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "DEBTORS",
    name: "Debtors",
    nature: "ASSET",
  });
  const [accByIdRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: targetId },
  );
  const existingById = Number(accByIdRows?.[0]?.id || 0) || 0;
  if (existingById) {
    await conn.execute(
      `UPDATE fin_accounts
          SET group_id = :groupId,
              code = :code,
              name = :name,
              currency_id = :currencyId,
              is_active = 1,
              is_postable = 1
        WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: targetId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId: Number(cust.currency_id || 0) || null,
      },
    );
    return existingById;
  }
  const currencyId =
    Number(cust.currency_id || 0) ||
    (await resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code: "GHS" })) ||
    null;
  try {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts
        (id, company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES
        (:id, :companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      {
        id: targetId,
        companyId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId,
      },
    );
    return Number(ins?.insertId || 0) || targetId;
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
    const [accRows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    return Number(accRows?.[0]?.id || 0) || 0;
  }
}

async function ensurePurchaseTaxComponentAccountTx(conn, { companyId, taxDetailId, componentName }) {
  const safeName = String(componentName || "").trim();
  if (!safeName) return 0;
  
  // First check if the tax detail ALREADY has an account_id
  const [detRows] = await conn.execute(
    "SELECT account_id FROM fin_tax_details WHERE id = :taxDetailId",
    { taxDetailId }
  );
  if (detRows && detRows[0] && detRows[0].account_id) {
    return Number(detRows[0].account_id);
  }

  // Create or resolve an account
  const groupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "TAXREC",
    name: "Tax Receivables",
    nature: "ASSET",
  });
  const currencyId = (await resolveCurrencyIdByCodeOrBaseTx(conn, { companyId, code: "GHS" })) || null;
  const code = `PTAX-${String(Number(taxDetailId || 0)).padStart(4, "0")}`;
  
  const [existingRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  let finalAccountId = existingId;
  
  if (existingId) {
    await conn.execute(
      `UPDATE fin_accounts
          SET group_id = :groupId,
              name = :name,
              currency_id = :currencyId,
              is_active = 1
        WHERE company_id = :companyId AND id = :id`,
      { companyId, id: existingId, groupId, name: safeName, currencyId },
    );
  } else {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts
        (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES
        (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      { companyId, groupId, code, name: safeName, currencyId },
    );
    finalAccountId = Number(ins?.insertId || 0) || 0;
  }
  
  if (finalAccountId) {
    // Update the fin_tax_details with the new account_id
    await conn.execute(
      "UPDATE fin_tax_details SET account_id = :accountId WHERE id = :taxDetailId",
      { accountId: finalAccountId, taxDetailId }
    );
  }
  return finalAccountId;
}

async function postPurchaseBillVoucherTx(conn, { companyId, branchId, billId, userId, isDirectPurchase = false }) {
  const [setupRows] = await conn.execute(
    "SELECT freight_account_id, other_charges_account_id FROM pur_setup WHERE company_id = :companyId LIMIT 1",
    { companyId }
  );
  const setup = setupRows?.[0] || {};
  let defaultFreightAcc = Number(setup.freight_account_id || 0);
  let defaultOtherAcc = Number(setup.other_charges_account_id || 0);

  if (!defaultFreightAcc) {
    defaultFreightAcc = await resolveChargesExpenseAccountIdAuto(conn, { companyId });
  }
  if (!defaultOtherAcc) {
    defaultOtherAcc = await resolveChargesExpenseAccountIdAuto(conn, { companyId });
  }

  // Fetch Header
  let hdr;
  if (isDirectPurchase) {
    const [rows] = await conn.execute(
      "SELECT id, dp_no AS bill_no, dp_date AS bill_date, supplier_id, currency_id, exchange_rate, net_amount, 0 AS freight_charges, 0 AS other_charges, tax_amount FROM pur_direct_purchase_hdr WHERE id = :billId",
      { billId }
    );
    hdr = rows?.[0];
  } else {
    const [rows] = await conn.execute(
      "SELECT id, bill_no, bill_date, supplier_id, currency_id, exchange_rate, net_amount, freight_charges, other_charges, tax_amount FROM pur_bills WHERE id = :billId",
      { billId }
    );
    hdr = rows?.[0];
  }
  if (!hdr) return 0;
  
  if (!(Number(hdr.net_amount || 0) > 0)) return 0;

  // Supplier
  const supplierAccountId = await ensureSupplierFinAccountIdTx(conn, { companyId, supplierId: hdr.supplier_id });
  if (!supplierAccountId) {
    throw httpError(400, "VALIDATION_ERROR", "Supplier account could not be resolved");
  }

  // Delete existing voucher
  const [existingRows] = await conn.execute(
    `SELECT v.id
       FROM fin_vouchers v
       JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
       JOIN fin_voucher_lines l ON l.voucher_id = v.id
      WHERE v.company_id = :companyId
        AND v.branch_id = :branchId
        AND vt.code = 'PV'
        AND l.reference_no = :ref
      LIMIT 1`,
    { companyId, branchId, ref: hdr.bill_no },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  if (existingId) {
    await conn.execute("DELETE FROM fin_voucher_lines WHERE voucher_id = :vid", { vid: existingId });
    await conn.execute("DELETE FROM fin_vouchers WHERE id = :vid", { vid: existingId });
  }

  const voucherTypeId = await ensureJournalVoucherTypeIdTx(conn, { companyId }); // or Purchase Voucher?
  // Let's use PV for Purchase Voucher.
  let pvTypeId = await resolveVoucherTypeIdByCode(conn, { companyId, code: "PV" });
  if (!pvTypeId) {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'PV', 'Purchase Voucher', 'PURCHASE', 'PV', 1, 0, 1)`,
      { companyId },
    ).catch(() => null);
    pvTypeId = await resolveVoucherTypeIdByCode(conn, { companyId, code: "PV" });
  }
  const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
  const voucherNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId: pvTypeId });

  // Details
  let details;
  if (isDirectPurchase) {
    const [rows] = await conn.execute(
      "SELECT item_id, qty, unit_price, discount_percent, tax_amount, tax_code_id FROM pur_direct_purchase_dtl WHERE hdr_id = :billId",
      { billId }
    );
    details = rows || [];
  } else {
    const [rows] = await conn.execute(
      "SELECT item_id, qty, unit_price, discount_percent, tax_amount, tax_code_id FROM pur_bill_details WHERE bill_id = :billId",
      { billId }
    );
    details = rows || [];
  }

  // Map item purchase accounts
  const itemIds = Array.from(new Set(details.map(d => Number(d.item_id)).filter(id => id > 0)));
  const itemAccountMap = new Map();
  if (itemIds.length) {
    const placeholders = itemIds.map((_, i) => \`:id\${i}\`).join(",");
    const params = { companyId };
    itemIds.forEach((id, i) => params[\`id\${i}\`] = id);
    const [itemsRows] = await conn.execute(
      \`SELECT id, purchase_account_id FROM inv_items WHERE company_id = :companyId AND id IN (\${placeholders})\`,
      params
    );
    for (const r of itemsRows || []) {
      itemAccountMap.set(Number(r.id), Number(r.purchase_account_id));
    }
  }

  // fallback purchase account
  let defaultPurchaseAccountId = await resolveChargesExpenseAccountIdAuto(conn, { companyId }); // or a default COGS

  const rate = Number(hdr.exchange_rate || 1);
  const purchaseDebits = new Map();
  const taxLines = [];
  
  for (const d of details) {
    const qty = Number(d.qty || 0);
    const price = Number(d.unit_price || 0);
    const discPct = Number(d.discount_percent || 0);
    const gross = qty * price;
    const disc = gross * (discPct / 100);
    const net = gross - disc;
    const baseNet = net * rate;

    const accId = itemAccountMap.get(Number(d.item_id)) || defaultPurchaseAccountId;
    purchaseDebits.set(accId, (purchaseDebits.get(accId) || 0) + baseNet);

    const taxAmt = Number(d.tax_amount || 0);
    const taxCodeId = Number(d.tax_code_id || 0);
    if (taxCodeId && taxAmt > 0) {
      const components = await loadTaxComponentsByCodeTx(conn, { companyId, taxCodeId });
      const allocations = allocateTaxComponents(net, taxAmt, components);
      if (allocations.length) {
        taxLines.push(...allocations);
      }
    }
  }

  // Calculate tax debits
  const taxDebits = new Map();
  for (const tl of taxLines) {
    const tlAmountBase = Number(tl.amount || 0) * rate;
    const accId = await ensurePurchaseTaxComponentAccountTx(conn, { companyId, taxDetailId: tl.tax_detail_id, componentName: tl.component_name });
    if (accId) {
      taxDebits.set(accId, (taxDebits.get(accId) || 0) + tlAmountBase);
    }
  }

  // Charges
  const freightBase = Number(hdr.freight_charges || 0) * rate;
  const otherBase = Number(hdr.other_charges || 0) * rate;
  const totalDebit = Array.from(purchaseDebits.values()).reduce((a,b)=>a+b, 0) 
                   + Array.from(taxDebits.values()).reduce((a,b)=>a+b, 0)
                   + freightBase + otherBase;

  const totalCredit = Number(hdr.net_amount || 0) * rate;

  const [vIns] = await conn.execute(
    \`INSERT INTO fin_vouchers
      (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
     VALUES
      (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :td, :tc, 'POSTED', :createdBy, :approvedBy, :postedBy)\`,
    {
      companyId, branchId, fiscalYearId, voucherTypeId: pvTypeId, voucherNo,
      voucherDate: hdr.bill_date || toYmd(new Date()),
      narration: \`Purchase Bill \${hdr.bill_no} posting\`,
      currencyId: hdr.currency_id, exchangeRate: hdr.exchange_rate,
      td: totalDebit, tc: totalCredit,
      createdBy: userId || null, approvedBy: userId || null, postedBy: userId || null
    }
  );
  const voucherId = Number(vIns?.insertId || 0) || 0;
  let lineNo = 1;

  // Credit Supplier
  await conn.execute(
    \`INSERT INTO fin_voucher_lines
      (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
     VALUES
      (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :ref)\`,
    {
      companyId, voucherId, lineNo: lineNo++, accountId: supplierAccountId,
      description: \`Payable for \${hdr.bill_no}\`, credit: totalCredit, ref: hdr.bill_no
    }
  );

  // Debit Purchases
  for (const [accId, amt] of purchaseDebits) {
    if (Math.round(amt*100) <= 0) continue;
    await conn.execute(
      \`INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)\`,
      {
        companyId, voucherId, lineNo: lineNo++, accountId: accId,
        description: \`Purchases for \${hdr.bill_no}\`, debit: amt, ref: hdr.bill_no
      }
    );
  }

  // Debit Taxes
  for (const [accId, amt] of taxDebits) {
    if (Math.round(amt*100) <= 0) continue;
    await conn.execute(
      \`INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)\`,
      {
        companyId, voucherId, lineNo: lineNo++, accountId: accId,
        description: \`Tax on \${hdr.bill_no}\`, debit: amt, ref: hdr.bill_no
      }
    );
  }

  // Debit Freight
  if (Math.round(freightBase*100) > 0) {
    await conn.execute(
      \`INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)\`,
      {
        companyId, voucherId, lineNo: lineNo++, accountId: defaultFreightAcc,
        description: \`Freight for \${hdr.bill_no}\`, debit: freightBase, ref: hdr.bill_no
      }
    );
  }

  // Debit Other Charges
  if (Math.round(otherBase*100) > 0) {
    await conn.execute(
      \`INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :ref)\`,
      {
        companyId, voucherId, lineNo: lineNo++, accountId: defaultOtherAcc,
        description: \`Other Charges for \${hdr.bill_no}\`, debit: otherBase, ref: hdr.bill_no
      }
    );
  }

  return { voucherId, voucherNo };
}
