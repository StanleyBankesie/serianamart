import React, { useMemo, useState } from "react";
import { api } from "../../../../api/client";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: {
      label: "✓ PAID",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    overdue: {
      label: "⚠ OVERDUE",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    pending: {
      label: "⏳ PENDING",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
  };
  const d = map[s] || map.pending;
  return (
    <span className={`inline-block px-3 py-1 text-xs rounded border ${d.cls}`}>
      {d.label}
    </span>
  );
}

function PaymentBadge({ payment }) {
  const p = String(payment || "").toLowerCase();
  const map = {
    paid: {
      label: "Paid",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    unpaid: {
      label: "Unpaid",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
  };
  const d = map[p] || map.unpaid;
  return (
    <span className={`inline-block px-3 py-1 text-xs rounded border ${d.cls}`}>
      {d.label}
    </span>
  );
}

function ServiceRow({ idx, row, taxCodes, onChange, onRemove, readOnly }) {
  const update = (key, value) => onChange(idx, { ...row, [key]: value });
  const qty = Number(row.qty || 0);
  const rate = Number(row.rate || 0);
  const base = qty * rate;
  const discPct = Number(row.discount_percent || 0);
  const taxRate =
    Number(
      (taxCodes.find((t) => String(t.id) === String(row.tax_code_id)) || {})
        .rate_percent || 0,
    ) || 0;
  const discountAmount = base * (discPct / 100);
  const taxable = base - discountAmount;
  const taxAmount = taxable * (taxRate / 100);
  const amount = taxable + taxAmount;
  return (
    <tr>
      <td className="p-2">{idx + 1}</td>
      <td className="p-2">
        <select
          className={`input ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          value={row.item_id || ""}
          onChange={(e) => update("item_id", e.target.value)}
          disabled={readOnly}
        >
          <option value="">Select service item</option>
          {row.options?.map((it) => (
            <option key={it.id} value={String(it.id)}>
              {it.item_name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <select
          className={`input ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          value={row.category || ""}
          onChange={(e) => update("category", e.target.value)}
          disabled={readOnly}
        >
          <option value="">Select service</option>
          <option value="installation">Installation</option>
          <option value="maintenance">Maintenance</option>
          <option value="repair">Repair</option>
          <option value="consultation">Consultation</option>
        </select>
      </td>
      <td className="p-2">
        <input
          className={`input text-right ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          type="number"
          value={row.qty ?? ""}
          onChange={(e) => update("qty", e.target.value)}
          placeholder="Qty"
          readOnly={readOnly}
          disabled={readOnly}
        />
      </td>
      <td className="p-2">
        <input
          className={`input text-right ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          type="number"
          value={row.rate ?? ""}
          onChange={(e) => update("rate", e.target.value)}
          placeholder="Rate"
          readOnly={readOnly}
          disabled={readOnly}
        />
      </td>
      <td className="p-2">
        <input
          className={`input text-right ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          type="number"
          step="0.01"
          value={row.discount_percent ?? ""}
          onChange={(e) => update("discount_percent", e.target.value)}
          placeholder="Disc %"
          readOnly={readOnly}
          disabled={readOnly}
        />
      </td>
      <td className="p-2">
        <select
          className={`input ${readOnly ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold" : ""}`}
          value={row.tax_code_id || ""}
          onChange={(e) => update("tax_code_id", e.target.value)}
          disabled={readOnly}
        >
          <option value="">No Tax</option>
          {taxCodes.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2 text-right">{Number(amount || 0).toFixed(2)}</td>
      <td className="p-2">
        {!readOnly ? (
          <button
            type="button"
            className="btn-danger"
            onClick={() => onRemove(idx)}
          >
            Remove
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export default function ServiceBillForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const readOnly =
    String(
      new URLSearchParams(location.search).get("mode") || "",
    ).toLowerCase() === "view";
  const disabledClass = readOnly
    ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
    : "";
  const successMsg = location.state?.success || "";
  const [bill, setBill] = useState({
    number: "",
    status: "pending",
    billDate: "",
    dueDate: "",
    supplierId: "",
    relatedExecId: "",
    currency: "GHS",
    exchangeRate: 1,
    paymentTermsDays: "30",
    otherCharges: 0,
    services: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentMethod: "cash",
    paymentReference: "",
    notes: "",
    terms: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [baseCurrencyId, setBaseCurrencyId] = useState(null);
  const [serviceItems, setServiceItems] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [methods] = useState([
    { key: "cash", label: "Cash", icon: "💵" },
    { key: "card", label: "Card", icon: "💳" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
    { key: "bank", label: "Bank Transfer", icon: "🏦" },
  ]);

  const selectPaymentMethod = (v) => {
    setBill((prev) => ({ ...prev, paymentMethod: v }));
  };
  const update = (key, value) => {
    setBill((prev) => ({ ...prev, [key]: value }));
  };
  const addRow = () => {
    setBill((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          item_id: "",
          desc: "",
          category: "",
          qty: "",
          rate: "",
          options: serviceItems,
          discount_percent: "",
          tax_code_id: "",
        },
      ],
    }));
  };
  const removeRow = (idx) => {
    setBill((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== idx),
    }));
  };
  const setRow = (idx, row) => {
    setBill((prev) => ({
      ...prev,
      services: prev.services.map((r, i) => (i === idx ? row : r)),
    }));
    if (row.item_id) {
      const it = serviceItems.find((x) => String(x.id) === String(row.item_id));
      if (it) {
        setBill((p) => ({
          ...p,
          services: p.services.map((r, i) =>
            i === idx ? { ...row, desc: it.item_name } : r,
          ),
        }));
      }
    }
  };

  const totals = useMemo(() => {
    let sub = 0;
    let itemDiscounts = 0;
    let itemTaxTotal = 0;
    for (const r of bill.services) {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const base = qty * rate;
      sub += base;
      const discPct = Number(r.discount_percent || 0);
      const discountAmt = base * (discPct / 100);
      itemDiscounts += discountAmt;
      const taxRate =
        Number(
          (taxCodes.find((t) => String(t.id) === String(r.tax_code_id)) || {})
            .rate_percent || 0,
        ) || 0;
      const taxable = base - discountAmt;
      const taxAmt = taxable * (taxRate / 100);
      itemTaxTotal += taxAmt;
    }
    const otherCharges = Number(bill.otherCharges || 0);
    const total = sub - itemDiscounts + itemTaxTotal + otherCharges;
    return {
      subtotal: sub,
      discountAmount: itemDiscounts,
      taxAmount: itemTaxTotal,
      otherCharges,
      total,
    };
  }, [bill.services, bill.otherCharges, taxCodes]);

  React.useEffect(() => {
    setBill((prev) => ({
      ...prev,
      subtotal: totals.subtotal,
      tax: totals.taxAmount,
      total: totals.total,
    }));
  }, [totals.subtotal, totals.taxAmount, totals.total]);

  React.useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [supRes, execRes, curRes, itemsRes] = await Promise.all([
          api.get("/purchase/suppliers", { params: { contractor: "Y" } }),
          api.get("/purchase/service-executions"),
          api.get("/finance/currencies"),
          api.get("/inventory/items"),
        ]);
        if (!mounted) return;
        setSuppliers(
          Array.isArray(supRes.data?.items) ? supRes.data.items : [],
        );
        setExecutions(
          Array.isArray(execRes.data?.items) ? execRes.data.items : [],
        );
        const currs = Array.isArray(curRes.data?.items)
          ? curRes.data.items
          : [];
        setCurrencies(currs);
        const base =
          currs.find((c) => Number(c.is_base) === 1) ||
          currs.find(
            (c) =>
              String(c.code || c.currency_code || "").toUpperCase() === "GHS",
          ) ||
          currs.find((c) =>
            /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
          );
        setBaseCurrencyId(base ? Number(base.id) : null);
        const items = Array.isArray(itemsRes.data?.items)
          ? itemsRes.data.items
          : [];
        const svc = items.filter(
          (it) => String(it.service_item || "").toUpperCase() === "Y",
        );
        setServiceItems(
          svc.map((x) => ({
            id: x.id,
            item_name: x.item_name,
          })),
        );
        try {
          const taxRes = await api.get("/finance/tax-codes");
          setTaxCodes(
            Array.isArray(taxRes.data?.items) ? taxRes.data.items : [],
          );
        } catch {}
      } catch {}
    }
    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);
  const toYmd = (v) => {
    if (!v) return null;
    try {
      const d = new Date(v);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    } catch {}
    return typeof v === "string" ? v.slice(0, 10) : null;
  };
  const parseDays = (terms) => {
    const m = String(terms || "").match(/(\d+)\s*days?/i);
    return m ? String(Number(m[1])) : "";
  };
  const parseNotesMeta = (notes) => {
    const lines = String(notes || "")
      .split("\n")
      .map((s) => s.trim());
    const get = (key) => {
      const ln = lines.find((l) =>
        l.toLowerCase().startsWith(key.toLowerCase()),
      );
      return ln ? ln.split(":").slice(1).join(":").trim() : "";
    };
    const supplierId = get("SupplierId");
    const relatedExecId = get("RelatedExec");
    const currency = get("Currency");
    const exchangeRate = get("Exchange");
    return {
      supplierId: supplierId || "",
      relatedExecId: relatedExecId || "",
      currency: currency || "",
      exchangeRate: exchangeRate || "",
    };
  };

  React.useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!id) return;
      try {
        const res = await api.get(`/purchase/service-bills/${id}`);
        const item = res.data?.item || {};
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!mounted) return;
        const meta = parseNotesMeta(item.notes);
        const otherCharges =
          Number(item.total_amount || 0) -
          (Number(item.subtotal || 0) -
            Number(item.discount_amount || 0) +
            Number(item.tax_amount || 0));
        setBill((p) => ({
          ...p,
          payment: String(item.payment || p.payment || "UNPAID").toUpperCase(),
          number: item.bill_no || p.number,
          status: String(item.status || p.status).toLowerCase(),
          serviceDate: toYmd(item.service_date) || p.serviceDate,
          billDate: toYmd(item.bill_date) || p.billDate,
          dueDate: toYmd(item.due_date) || p.dueDate,
          supplierId: meta.supplierId || p.supplierId,
          relatedExecId: meta.relatedExecId || p.relatedExecId,
          currency: String(meta.currency || p.currency || "GHS").toUpperCase(),
          exchangeRate: meta.exchangeRate
            ? Number(meta.exchangeRate)
            : p.exchangeRate,
          paymentTermsDays: parseDays(item.payment_terms) || p.paymentTermsDays,
          services: details.map((d) => ({
            item_id: "",
            desc: d.description || "",
            category: d.category || "",
            qty: d.qty,
            rate: d.rate,
            discount_percent: "",
            tax_code_id: "",
            options: serviceItems,
            discountAmount: Number(
              item.discount_amount || p.discountAmount || 0,
            ),
            discountPercent: Number(
              item.discount_percent || p.discountPercent || 0,
            ),
          })),
          taxPercent: Number(item.tax_percent || p.taxPercent || 0),
          subtotal: Number(item.subtotal || p.subtotal || 0),
          tax: Number(item.tax_amount || p.tax || 0),
          total: Number(item.total_amount || p.total || 0),
          otherCharges: Number(otherCharges || 0),
          notes: item.notes || p.notes,
          terms: item.payment_terms || p.terms,
          paymentMethod: item.payment_method || p.paymentMethod,
          paymentReference: item.payment_reference || p.paymentReference,
        }));
      } catch {}
    }
    loadExisting();
    return () => {
      mounted = false;
    };
  }, []);
  const handleCurrencyChange = async (code) => {
    setBill((p) => ({ ...p, currency: code }));
    setBill((p) => ({ ...p, currency: code }));
    const arr = Array.isArray(currencies) ? currencies : [];
    const target = arr.find(
      (c) => String(c.code || c.currency_code || "").toUpperCase() === code,
    );
    const baseId = baseCurrencyId ? Number(baseCurrencyId) : null;
    const targetId = target ? Number(target.id) : null;
    if (!baseId || !targetId || baseId === targetId) {
      setBill((p) => ({ ...p, exchangeRate: 1 }));
      return;
    }
    try {
      const res = await api.get("/finance/currency-rates", {
        params: { fromCurrencyId: targetId, toCurrencyId: baseId },
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const first = items[0];
      if (first && first.rate) {
        setBill((p) => ({ ...p, exchangeRate: Number(first.rate) || 1 }));
      } else {
        setBill((p) => ({ ...p, exchangeRate: 1 }));
      }
    } catch {
      setBill((p) => ({ ...p, exchangeRate: 1 }));
    }
  };

  React.useEffect(() => {
    let mounted = true;
    async function getNextBillNo() {
      try {
        const res = await api.get("/purchase/service-bills/next-no");
        const s = res.data?.nextNo;
        const n = Number(String(s || "").replace(/\D/g, "")) || 1;
        const numStr = String(n).padStart(6, "0");
        if (!mounted) return;
        setBill((p) => (p.number ? p : { ...p, number: `SVB-${numStr}` }));
      } catch {
        if (!mounted) return;
        setBill((p) =>
          p.number ? p : { ...p, number: `SVB-${String(1).padStart(6, "0")}` },
        );
      }
    }
    getNextBillNo();
    return () => {
      mounted = false;
    };
  }, []);

  function saveBill() {
    const supEntry = suppliers.find(
      (s) => String(s.id) === String(bill.supplierId || ""),
    );
    const clientName =
      supEntry?.supplier_name || supEntry?.name || supEntry?.company || null;
    const payload = {
      bill_no: bill.number || null,
      bill_date: toYmd(bill.billDate),
      due_date: toYmd(bill.dueDate),
      supplier_id: bill.supplierId || null,
      service_date: toYmd(bill.serviceDate),
      client_name: clientName,
      status: bill.status?.toUpperCase() || "PENDING",
      payment_method: bill.paymentMethod || "cash",
      payment_reference: bill.paymentReference || null,
      payment_terms: bill.paymentTermsDays
        ? `${bill.paymentTermsDays} days`
        : null,
      notes:
        [
          bill.notes || "",
          bill.supplierId ? `SupplierId: ${bill.supplierId}` : "",
          bill.relatedExecId ? `RelatedExec: ${bill.relatedExecId}` : "",
          bill.currency ? `Currency: ${bill.currency}` : "",
          bill.exchangeRate ? `Exchange: ${bill.exchangeRate}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .trim() || null,
      details: bill.services.map((s) => ({
        description: s.desc || "",
        category: s.category || "",
        qty: Number(s.qty || 0),
        rate: Number(s.rate || 0),
        amount: Number(s.qty || 0) * Number(s.rate || 0),
      })),
      subtotal: Number(totals.subtotal || 0),
      discount_amount: Number(totals.discountAmount || 0),
      tax_amount: Number(totals.taxAmount || 0),
      total_amount: Number(totals.total || 0),
    };
    const isEdit =
      String(
        new URLSearchParams(location.search).get("mode") || "",
      ).toLowerCase() === "edit";
    const req =
      id && isEdit
        ? api.put(`/purchase/service-bills/${id}`, payload)
        : api.post("/purchase/service-bills", payload);
    req
      .then(() => {
        navigate("/purchase/service-bills", {
          state: { success: "Service bill saved successfully" },
        });
      })
      .catch((e) =>
        alert(e?.response?.data?.message || "Failed to save service bill"),
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/purchase/service-bills" className="btn-secondary">
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Service Bill
            </h1>
            <p className="text-sm mt-1">
              Prepare and issue bill for services provided
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-600">Bill No</div>
          <div className="text-lg font-semibold">{bill.number}</div>
        </div>
      </div>
      {successMsg ? (
        <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
          {successMsg}
        </div>
      ) : null}

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Bill Details</div>
            <div className="flex items-center gap-2">
              <StatusBadge status={bill.status} />
              <PaymentBadge payment={bill.payment} />
            </div>
          </div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Bill No</label>
            <input
              className={`input ${disabledClass}`}
              value={bill.number}
              onChange={(e) => update("number", e.target.value)}
              placeholder="Auto-generated"
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Bill Date</label>
            <input
              className={`input ${disabledClass}`}
              type="date"
              value={bill.billDate}
              onChange={(e) => update("billDate", e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Supplier</label>
            <select
              className={`input ${disabledClass}`}
              value={bill.supplierId || ""}
              onChange={(e) => update("supplierId", e.target.value)}
              disabled={readOnly}
            >
              <option value="">-- Select Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.supplier_name || s.name || s.company || s.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Service Execution</label>
            <select
              className={`input ${disabledClass}`}
              value={bill.relatedExecId || ""}
              onChange={(e) => update("relatedExecId", e.target.value)}
              disabled={readOnly}
            >
              <option value="">-- Select Execution --</option>
              {executions.map((ex) => (
                <option key={ex.id} value={String(ex.id)}>
                  {ex.execution_no || ex.order_no || ex.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select
              className={`input ${disabledClass}`}
              value={bill.currency || "GHS"}
              onChange={(e) =>
                handleCurrencyChange(
                  String(e.target.value || "GHS").toUpperCase(),
                )
              }
              disabled={readOnly}
            >
              {currencies.map((c) => (
                <option
                  key={c.id}
                  value={String(c.code || c.currency_code).toUpperCase()}
                >
                  {String(c.code || c.currency_code).toUpperCase()} -{" "}
                  {c.name || c.currency_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Exchange Rate</label>
            <input
              className={`input text-right ${disabledClass}`}
              type="number"
              step="0.000001"
              value={bill.exchangeRate || 1}
              onChange={(e) => update("exchangeRate", e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Payment Terms (Days)</label>
            <input
              className={`input text-right ${disabledClass}`}
              type="number"
              value={bill.paymentTermsDays || ""}
              onChange={(e) => update("paymentTermsDays", e.target.value)}
              placeholder="e.g., 30"
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Bill Information</div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Bill Date</label>
            <input
              className={`input ${disabledClass}`}
              type="date"
              value={bill.billDate}
              onChange={(e) => update("billDate", e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              className={`input ${disabledClass}`}
              type="date"
              value={bill.dueDate}
              onChange={(e) => update("dueDate", e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Service Date</label>
            <input
              className={`input ${disabledClass}`}
              type="date"
              value={bill.serviceDate || ""}
              onChange={(e) => update("serviceDate", e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="md:col-span-2">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc %</th>
                    <th>Tax</th>
                    <th className="text-right">Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.services.map((row, idx) => (
                    <ServiceRow
                      key={idx}
                      idx={idx}
                      row={{ ...row, options: serviceItems }}
                      taxCodes={taxCodes}
                      onChange={setRow}
                      onRemove={removeRow}
                      readOnly={readOnly}
                    />
                  ))}
                  <tr>
                    {!readOnly ? (
                      <td colSpan="7">
                        <button
                          type="button"
                          className="btn-success"
                          onClick={addRow}
                        >
                          + Add Service Line
                        </button>
                      </td>
                    ) : null}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>Sub Total</div>
                <div className="font-semibold">
                  {Number(totals.subtotal || 0).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>Discount Amount</div>
                <div className="font-semibold">
                  {Number(totals.discountAmount || 0).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>Tax Amount</div>
                <div className="font-semibold">
                  {Number(totals.taxAmount || 0).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>Other Charges</div>
                <input
                  className="input w-36 text-right"
                  type="number"
                  step="0.01"
                  value={bill.otherCharges}
                  onChange={(e) => update("otherCharges", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>Grand Total</div>
                <div className="text-xl font-bold">
                  {Number(totals.total || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Payment Details</div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {methods.map((m) => {
                const active = bill.paymentMethod === m.key;
                return (
                  <button
                    type="button"
                    key={m.key}
                    className={`p-3 rounded border text-left ${
                      active
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white"
                    }`}
                    onClick={() => selectPaymentMethod(m.key)}
                  >
                    <div className="text-2xl">{m.icon}</div>
                    <div className="text-sm">{m.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Terms & Notes</div>
        </div>
        <div className="card-body space-y-3">
          <div>
            <label className="label">Payment Terms</label>
            <textarea
              className={`input ${disabledClass}`}
              rows={3}
              value={bill.terms}
              onChange={(e) => update("terms", e.target.value)}
              placeholder="Payment due within 14 days"
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Additional Notes</label>
            <textarea
              className={`input ${disabledClass}`}
              rows={3}
              value={bill.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional information"
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate("/purchase/service-bills")}
        >
          Cancel
        </button>
        {!readOnly ? (
          <button type="button" className="btn-primary" onClick={saveBill}>
            Save Bill
          </button>
        ) : null}
      </div>
    </div>
  );
}
