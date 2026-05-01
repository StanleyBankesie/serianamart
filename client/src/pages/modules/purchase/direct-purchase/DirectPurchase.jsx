import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import UnitConversionModal from "../../../../components/UnitConversionModal.jsx";
import { useUoms } from "../../../../hooks/useUoms.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

export default function DirectPurchase() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { canEditDiscount } = usePermission();
  const dpId = params?.id ? Number(params.id) : null;
  const isViewMode =
    location?.pathname?.endsWith(`/direct-purchase/${params?.id || ""}`) &&
    String(new URLSearchParams(location.search).get("mode") || "") === "view";
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [approvedItemRequisitions, setApprovedItemRequisitions] = useState([]);
  const [selectedGeneralRequisitionId, setSelectedGeneralRequisitionId] =
    useState("");
  const [currencies, setCurrencies] = useState([]);
  const [baseCurrencyId, setBaseCurrencyId] = useState(null);
  const [standardPrices, setStandardPrices] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const { uoms } = useUoms();
  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);
  const [form, setForm] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    warehouse_id: "",
    currency_id: "",
    exchange_rate: 1,
    payment_type: "CASH",
    payment_terms: "",
    remarks: "",
  });
  const [lines, setLines] = useState([]);
  const [newItem, setNewItem] = useState({
    item_id: "",
    qty: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_code_id: "",
    tax_percent: 0,
    uom: "PCS",
    batch_no: "",
    mfg_date: "",
    exp_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowIdx: null,
  });
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadExisting() {
      if (!dpId) return;
      try {
        const res = await api.get(`/purchase/direct-purchases/${dpId}`);
        const hdr = res?.data || null;
        if (!hdr) return;
        if (cancelled) return;
        setForm({
          supplier_id: hdr.supplier_id || "",
          purchase_date: String(hdr.dp_date || "").slice(0, 10),
          warehouse_id: hdr.warehouse_id || "",
          currency_id: hdr.currency_id || "",
          exchange_rate: Number(hdr.exchange_rate || 1),
          payment_type: hdr.payment_type || "CASH",
          payment_terms: hdr.payment_terms || "",
          remarks: hdr.remarks || "",
        });
        const details = Array.isArray(hdr.details) ? hdr.details : [];
        setLines(
          details.length
            ? details.map((d) => ({
                item_id: d.item_id,
                qty: d.qty,
                unit_price: d.unit_price,
                discount_percent: d.discount_percent,
                tax_percent: d.tax_percent,
                uom: d.uom || "PCS",
                batch_no: d.batch_no || "",
                mfg_date: d.mfg_date ? String(d.mfg_date).slice(0, 10) : "",
                exp_date: d.exp_date ? String(d.exp_date).slice(0, 10) : "",
                line_total: d.line_total,
              }))
            : [
                {
                  item_id: "",
                  qty: "",
                  unit_price: "",
                  discount_percent: "",
                  tax_percent: "",
                  uom: "PCS",
                  batch_no: "",
                  mfg_date: "",
                  exp_date: "",
                  line_total: 0,
                },
              ],
        );
      } catch {}
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [dpId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [sup, wh, it, cur, std, conv, tax, reqs] = await Promise.all([
          api.get("/purchase/suppliers").then((r) => r.data.items || []),
          api.get("/inventory/warehouses").then((r) => r.data.items || []),
          api.get("/inventory/items").then((r) => r.data.items || []),
          api.get("/finance/currencies").then((r) => r.data.items || []),
          api
            .get("/sales/prices/standard")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/inventory/unit-conversions")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/finance/tax-codes?form=DIRECT_PURCHASE")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/purchase/general-requisitions", {
              params: {
                status: "APPROVED",
                requisition_type: "ITEM",
                only_unlinked: 1,
              },
            })
            .then((r) => r.data.items || []),
        ]);
        if (mounted) {
          setSuppliers(sup);
          setWarehouses(wh);
          setItems(it);
          setCurrencies(cur);
          setStandardPrices(Array.isArray(std) ? std : []);
          setUnitConversions(Array.isArray(conv) ? conv : []);
          const mappedTaxes = (Array.isArray(tax) ? tax : []).map((t) => ({
            value: t.id,
            label: t.name,
            rate: Number(t.rate_percent),
          }));
          setTaxes(mappedTaxes);
          setApprovedItemRequisitions(Array.isArray(reqs) ? reqs : []);
          const base =
            (cur || []).find((c) => Number(c.is_base) === 1)?.id || null;
          setBaseCurrencyId(base);
          if (!form.currency_id && base) {
            setForm((prev) => ({ ...prev, currency_id: base }));
          }
        }
      } catch (e) {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function updateRate() {
      const fromId = Number(form.currency_id || 0) || null;
      const toId = Number(baseCurrencyId || 0) || null;
      if (!fromId || !toId) return;
      try {
        const res = await api.get("/finance/currency-rates", {
          params: { fromCurrencyId: fromId, toCurrencyId: toId },
        });
        const arr = Array.isArray(res?.data?.items) ? res.data.items : [];
        const latest = arr[0] || null;
        const rate = latest ? Number(latest.rate || 1) : 1;
        if (!ignore) {
          setForm((prev) => ({ ...prev, exchange_rate: rate || 1 }));
        }
      } catch {}
    }
    updateRate();
    return () => {
      ignore = true;
    };
  }, [form.currency_id, baseCurrencyId]);

  const fetchTaxComponentsForCode = async (taxCodeId) => {
    const key = String(taxCodeId || "");
    if (!key) return;
    try {
      const resp = await api.get(`/finance/tax-codes/${taxCodeId}/components`);
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
    } catch {}
  };

  useEffect(() => {
    const ids = lines.map((l) => l.tax_code_id);
    if (newItem.tax_code_id) ids.push(newItem.tax_code_id);

    const uniqueTaxIds = Array.from(
      new Set(ids.filter((id) => id && id !== "undefined")),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [lines, newItem.tax_code_id]);

  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const price = Number(newItem.unit_price || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * price;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];

    if (comps.length > 0) {
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        const amt = (taxableTotal * rate) / 100;
        components.push({
          name: c.component_name,
          rate,
          amount: amt,
        });
        taxTotal += amt;
      });
    } else {
      const rate = Number(newItem.tax_percent || 0);
      const amt = (taxableTotal * rate) / 100;
      if (rate > 0) {
        components.push({
          name: "Tax",
          rate,
          amount: amt,
        });
        taxTotal = amt;
      }
    }

    return { components, taxTotal, taxableTotal };
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem((prev) => {
      let next = { ...prev, [name]: value };
      if (name === "item_id") {
        const it = items.find((x) => Number(x.id) === Number(value));
        const fallbackUom = it?.uom || defaultUomCode;
        let unitPrice = it && Number(it.cost_price) ? Number(it.cost_price) : 0;
        if (Array.isArray(standardPrices) && standardPrices.length) {
          const filtered = standardPrices
            .filter((p) => String(p.product_id) === String(value))
            .sort((a, b) => {
              const ad = a.effective_date ? new Date(a.effective_date).getTime() : 0;
              const bd = b.effective_date ? new Date(b.effective_date).getTime() : 0;
              return bd - ad || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
          if (filtered.length > 0) {
            unitPrice = Number(filtered[0].cost_price) || unitPrice;
          }
        }
        next.uom = String(fallbackUom || "PCS");
        next.unit_price = unitPrice;

        // Try to fetch item tax if applicable (added in modernize)
        const fetchTax = async () => {
          try {
            const res = await api.get(`/finance/item-tax/${value}`);
            const tax = res.data?.tax;
            if (tax && tax.id) {
              setNewItem(p => (p.item_id === value ? { ...p, tax_code_id: String(tax.id), tax_percent: Number(tax.tax_rate) } : p));
            }
          } catch {}
        };
        fetchTax();
      }
      if (name === "tax_code_id") {
        const tax = taxes.find((t) => String(t.value) === String(value));
        next.tax_percent = tax ? tax.rate : 0;
      }
      return next;
    });
  };

  const addItemToLines = () => {
    if (!newItem.item_id || !newItem.qty) return;
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    const it = items.find((x) => Number(x.id) === Number(newItem.item_id));
    
    setLines((prev) => [
      ...prev,
      {
        ...newItem,
        id: Date.now(),
        item_name: it?.item_name || "",
        item_code: it?.item_code || "",
        line_total: taxableTotal + taxTotal,
      },
    ]);
    
    setNewItem({
      item_id: "",
      qty: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_code_id: "",
      tax_percent: 0,
      uom: defaultUomCode,
      batch_no: "",
      mfg_date: "",
      exp_date: "",
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    const compTotals = {};

    for (const l of lines) {
      const qty = Number(l.qty || 0);
      const unit = Number(l.unit_price || 0);
      const discP = Number(l.discount_percent || 0);
      const gross = qty * unit;
      const disc = gross * (discP / 100);
      const base = Math.max(0, gross - disc);
      subtotal += gross;
      totalDiscount += disc;

      const taxCodeId = l.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = (base * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) {
            compTotals[name] = {
              amount: 0,
              rate,
              sort_order: c.sort_order || 0,
            };
          }
          compTotals[name].amount += amt;
        });
      } else {
        const taxP = Number(l.tax_percent || 0);
        const taxVal = (base * taxP) / 100;
        if (taxP > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: taxP, sort_order: 99 };
          }
          compTotals[name].amount += taxVal;
        }
      }
    }

    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const totalTax = components.reduce((s, c) => s + c.amount, 0);
    const grandTotal = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, grandTotal, components };
  }, [lines, taxComponentsByCode]);

  function updateForm(k, v) {
    if (k === "payment_type") {
      setForm((prev) => {
        return { ...prev, payment_type: v };
      });
      return;
    }
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function onSupplierChange(id) {
    const sid = id ? Number(id) : null;
    const sup = suppliers.find((s) => Number(s.id) === sid) || null;
    const curId = sup?.currency_id ?? baseCurrencyId ?? "";
    const terms = sup?.payment_terms ?? "";
    setForm((prev) => ({
      ...prev,
      supplier_id: id,
      currency_id: curId || "",
      payment_terms: terms,
    }));
  }
  function recomputeLineTotals(row) {
    const qty = Number(row.qty || 0);
    const price = Number(row.unit_price || 0);
    const discPct = Number(row.discount_percent || 0);
    const taxPct = Number(row.tax_percent || 0);
    const base = qty * price;
    const disc = base * (discPct / 100);
    const taxable = base - disc;

    const comps = taxComponentsByCode[String(row.tax_code_id)] || [];
    let tax = 0;
    if (comps.length > 0) {
      comps.forEach((c) => {
        tax += (taxable * Number(c.rate_percent || 0)) / 100;
      });
    } else {
      tax = taxable * (taxPct / 100);
    }
    return { ...row, line_total: taxable + tax };
  }
  function updateLine(i, k, v) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = recomputeLineTotals({ ...next[i], [k]: v });
      return next;
    });
  }
  function onItemChange(i, itemId) {
    const it = items.find((x) => Number(x.id) === Number(itemId));
    const fallbackUom = it?.uom || defaultUomCode;
    let unitPrice =
      it && Number(it.cost_price)
        ? Number(it.cost_price)
        : Number(lines[i]?.unit_price || 0);
    if (Array.isArray(standardPrices) && standardPrices.length) {
      const filtered = standardPrices
        .filter((p) => String(p.product_id) === String(itemId))
        .sort((a, b) => {
          const ad = a.effective_date
            ? new Date(a.effective_date).getTime()
            : 0;
          const bd = b.effective_date
            ? new Date(b.effective_date).getTime()
            : 0;
          return (
            bd - ad ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      if (filtered.length > 0) {
        unitPrice = Number(filtered[0].cost_price) || unitPrice;
      }
    }
    setLines((prev) => {
      const next = [...prev];
      next[i] = recomputeLineTotals({
        ...next[i],
        item_id: itemId,
        uom: String(fallbackUom || "PCS"),
        unit_price: unitPrice,
      });
      return next;
    });
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        item_id: "",
        qty: "",
        unit_price: "",
        discount_percent: "",
        tax_percent: "",
        uom: "PCS",
        mfg_date: "",
        exp_date: "",
        line_total: 0,
      },
    ]);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function openVerifyQty(i, row) {
    if (isViewMode) return;
    const it = items.find((ai) => Number(ai.id) === Number(row.item_id));
    const defaultUom =
      (it?.uom && String(it.uom)) ||
      String(row.uom || "") ||
      String(defaultUomCode || "");
    const nonDefaults = (Array.isArray(unitConversions) ? unitConversions : [])
      .filter(
        (c) =>
          Number(c.is_active) &&
          Number(c.item_id) === Number(row.item_id) &&
          String(c.to_uom) === defaultUom,
      )
      .map((c) => String(c.from_uom));
    const currentUom = String(row.uom || "");
    const preferredUom =
      currentUom && currentUom !== defaultUom
        ? currentUom
        : nonDefaults[0] || "";
    const hasConv =
      nonDefaults.length > 0 && preferredUom && preferredUom !== defaultUom;
    if (!hasConv) return;
    setConvModal({
      open: true,
      itemId: row.item_id,
      defaultUom: defaultUom,
      currentUom: preferredUom,
      rowIdx: i,
    });
  }
  function applyConversion({ item_id, to_uom, converted_qty }) {
    setLines((prev) => {
      const next = [...prev];
      const idx = convModal.rowIdx;
      if (idx != null && next[idx]) {
        next[idx] = recomputeLineTotals({
          ...next[idx],
          qty: converted_qty,
          uom: to_uom,
        });
      }
      return next;
    });
  }

  async function submit(action) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        supplier_id: Number(form.supplier_id),
        purchase_date: form.purchase_date,
        warehouse_id: Number(form.warehouse_id),
        currency_id: form.currency_id ? Number(form.currency_id) : null,
        exchange_rate: Number(form.exchange_rate || 1),
        payment_type: String(form.payment_type || "CASH"),
        payment_terms: form.payment_terms ? Number(form.payment_terms) : null,
        remarks: form.remarks || null,
        status: action === "post" ? "POST" : "DRAFT",
        details: lines
          .filter((l) => Number(l.item_id) && Number(l.qty))
          .map((l) => ({
            item_id: Number(l.item_id),
            qty: Number(l.qty),
            unit_price: Number(l.unit_price || 0),
            discount_percent: Number(l.discount_percent || 0),
            tax_percent: Number(l.tax_percent || 0),
            uom: String(l.uom || "PCS"),
            tax_code_id: l.tax_code_id || null,
            batch_no: l.batch_no || null,
            mfg_date: l.mfg_date || null,
            exp_date: l.exp_date || null,
          })),
      };
      if (!payload.details.length) {
        setError("Add at least one item with quantity");
        setSaving(false);
        return;
      }
      const resp = dpId
        ? await api.put(`/purchase/direct-purchases/${dpId}`, payload)
        : await api.post("/purchase/direct-purchases", payload);
      const dp = resp?.data || {};
      const createdId = dp?.id || dpId || null;
      if (createdId && selectedGeneralRequisitionId) {
        try {
          await api.post(
            `/purchase/general-requisitions/${selectedGeneralRequisitionId}/link`,
            { ref_type: "DIRECT_PURCHASE", ref_id: Number(createdId) },
          );
        } catch {}
      }
      toast.success(dpId ? "Direct Purchase updated successfully" : "Direct Purchase created successfully");
      navigate("/purchase/direct-purchase");
    } catch (e) {
      setError(String(e?.response?.data?.message || e.message || "Error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border border-[#dee2e6] bg-white shadow-erp">
        <div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Direct Purchase</h1>
            <p className="text-sm mt-1 opacity-90">
              Complete a full purchase in one step
            </p>
          </div>
          <Link
            to="/purchase/direct-purchase"
            className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100"
          >
            ← Back to List
          </Link>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error ? <div className="alert alert-error">{error}</div> : null}
          {success ? (
            <div className="alert alert-success">{success}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label">Supplier</label>
              <select
                className="input"
                value={form.supplier_id}
                onChange={(e) => onSupplierChange(e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Requisition</label>
              <select
                className="input"
                value={selectedGeneralRequisitionId}
                onChange={async (e) => {
                  const val = e.target.value;
                  setSelectedGeneralRequisitionId(val);
                  const rid = Number(val);
                  if (Number.isFinite(rid) && rid > 0) {
                    try {
                      const res = await api.get(
                        `/purchase/general-requisitions/${rid}`,
                      );
                      const gr = res.data || null;
                      const grItems = Array.isArray(gr?.items) ? gr.items : [];
                      const mapped = grItems
                        .filter((ln) => Number(ln.item_id))
                        .map((ln) => ({
                          item_id: String(ln.item_id),
                          qty: Number(ln.qty || 0),
                          unit_price: Number(ln.estimated_unit_cost || 0),
                          discount_percent: "",
                          tax_percent: "",
                          uom: String(ln.uom || "PCS"),
                          line_total:
                            Number(ln.qty || 0) *
                            Number(ln.estimated_unit_cost || 0),
                        }));
                      if (mapped.length) setLines(mapped);
                    } catch {}
                  }
                }}
                disabled={isViewMode}
              >
                <option value="">Select Approved Requisition</option>
                {approvedItemRequisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requisition_no} — {r.department || ""} —{" "}
                    {String(r.requisition_date || "").slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Purchase Date</label>
              <input
                type="date"
                className="input"
                value={form.purchase_date}
                onChange={(e) => updateForm("purchase_date", e.target.value)}
                disabled={isViewMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={form.warehouse_id}
                onChange={(e) => updateForm("warehouse_id", e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Currency</label>
              <select
                className="input"
                value={form.currency_id}
                onChange={(e) => updateForm("currency_id", e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select currency</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.is_base ? "(Base)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Exchange Rate</label>
              <input
                type="number"
                className="input"
                value={form.exchange_rate}
                onChange={(e) => updateForm("exchange_rate", e.target.value)}
                disabled={isViewMode}
              />
            </div>
            {form.payment_type === "CREDIT" && (
              <div className="flex flex-col gap-1">
                <label className="label">Payment Terms</label>
                <input
                  type="number"
                  className="input"
                  value={form.payment_terms}
                  onChange={(e) => updateForm("payment_terms", e.target.value)}
                  disabled={isViewMode}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="label">Payment Type</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_type"
                    value="CASH"
                    checked={(form.payment_type || "CASH") === "CASH"}
                    onChange={(e) => updateForm("payment_type", e.target.value)}
                    disabled={isViewMode}
                  />
                  <span>Cash</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_type"
                    value="CREDIT"
                    checked={form.payment_type === "CREDIT"}
                    onChange={(e) => updateForm("payment_type", e.target.value)}
                    disabled={isViewMode}
                  />
                  <span>Credit</span>
                </label>
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="label">Remarks</label>
              <textarea
                className="input"
                rows="3"
                value={form.remarks}
                onChange={(e) => updateForm("remarks", e.target.value)}
                disabled={isViewMode}
              />
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <h3 className="text-sm font-semibold text-[#0E3646] mb-3">Add Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Item *</label>
                <select
                  name="item_id"
                  className="input"
                  value={newItem.item_id}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                >
                  <option value="">Select item</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_code} - {it.item_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Qty *</label>
                <input
                  type="number"
                  name="qty"
                  className="input"
                  value={newItem.qty}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UOM</label>
                <select
                  name="uom"
                  className="input"
                  value={newItem.uom}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                >
                  {uoms.map((u) => (
                    <option key={u.id} value={u.uom_code}>
                      {u.uom_code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  name="unit_price"
                  className="input"
                  value={newItem.unit_price}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Disc %</label>
                <input
                  type="number"
                  name="discount_percent"
                  className="input"
                  value={newItem.discount_percent}
                  onChange={handleNewItemChange}
                  disabled={isViewMode || !canEditDiscount()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tax Code</label>
                <select
                  name="tax_code_id"
                  className="input"
                  value={newItem.tax_code_id}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                >
                  <option value="">No Tax</option>
                  {taxes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Batch No</label>
                <input
                  type="text"
                  name="batch_no"
                  className="input"
                  value={newItem.batch_no}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mfg Date</label>
                <input
                  type="date"
                  name="mfg_date"
                  className="input"
                  value={newItem.mfg_date}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Exp Date</label>
                <input
                  type="date"
                  name="exp_date"
                  className="input"
                  value={newItem.exp_date}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>
              <div className="lg:col-span-1 flex items-end">
                {newItem.tax_code_id && calcNewItemTaxBreakdown().components.length > 0 ? (
                  <div className="w-full mt-2 border border-slate-200 rounded-md p-2 bg-slate-50 text-xs">
                    <div className="font-semibold text-slate-700 mb-1 border-b pb-1">Tax Breakdown</div>
                    {calcNewItemTaxBreakdown().components.map((c) => (
                      <div key={c.name} className="flex justify-between items-center py-0.5">
                        <span className="text-gray-600">{c.name} ({c.rate}%):</span>
                        <span className="font-medium">{c.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-slate-200 mt-1 pt-1 font-bold">
                      <span>Total Tax:</span>
                      <span>{calcNewItemTaxBreakdown().taxTotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end mt-3 px-1">
              {!isViewMode && (
                <button
                  type="button"
                  className="btn btn-primary px-6 flex items-center gap-2"
                  onClick={addItemToLines}
                  disabled={!newItem.item_id || !newItem.qty}
                >
                  <span className="text-lg leading-none">+</span> Add Item
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="overflow-x-auto rounded border border-[#dee2e6]">
              <table className="table">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th style={{ width: 320 }}>Item Details</th>
                    <th style={{ width: 100 }}>Qty</th>
                    <th style={{ width: 100 }}>UOM</th>
                    <th style={{ width: 180 }}>Batch/Mfg/Exp</th>
                    <th style={{ width: 120 }}>Unit Price</th>
                    <th style={{ width: 100 }}>Disc%</th>
                    <th style={{ width: 120 }}>Net</th>
                    <th style={{ width: 120 }}>Tax</th>
                    <th style={{ width: 140 }} className="text-right">Line Total</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-10 text-gray-500 italic bg-gray-50">
                        No items added yet. Use the section above to add items to this purchase.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => {
                      const gross = Number(l.qty || 0) * Number(l.unit_price || 0);
                      const disc = gross * (Number(l.discount_percent || 0) / 100);
                      const net = gross - disc;
                      const tax = Number(l.line_total || 0) - net;
                      return (
                        <tr key={l.id || i} className="hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100">
                          <td>
                            <div className="font-semibold text-[#0E3646] truncate max-w-[300px]">
                              {l.item_name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {l.item_code}
                            </div>
                          </td>
                          <td className="text-center font-medium">{l.qty}</td>
                          <td className="text-center">{l.uom}</td>
                          <td>
                            {l.batch_no && <div className="text-xs truncate max-w-[170px]"><b>B:</b> {l.batch_no}</div>}
                            {l.mfg_date && <div className="text-[10px] text-gray-500"><b>M:</b> {l.mfg_date}</div>}
                            {l.exp_date && <div className="text-[10px] text-red-500"><b>E:</b> {l.exp_date}</div>}
                          </td>
                          <td className="text-right">{Number(l.unit_price).toFixed(2)}</td>
                          <td className="text-right">{l.discount_percent}%</td>
                          <td className="text-right font-medium">{net.toFixed(2)}</td>
                          <td className="text-right text-gray-600">{tax.toFixed(2)}</td>
                          <td className="text-right font-bold text-[#0E3646]">
                            {Number(l.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>
                            {!isViewMode && (
                              <button className="text-red-600 hover:text-red-900 transition-colors p-1" onClick={() => removeLine(i)} title="Remove item">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#f8f9fa] p-5 rounded-lg mt-5 border border-[#dee2e6]">
            <div className="flex justify-between py-2 border-b border-[#dee2e6]">
              <span className="text-sm font-medium">Sub Total:</span>
              <span className="font-bold">
                {Number(totals.subtotal || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#dc3545]">
              <span className="text-sm font-medium">Discount:</span>
              <span className="font-bold">
                -
                {Number(totals.totalDiscount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#0E3646]">
              <span className="text-sm font-medium">Tax Amount:</span>
              <span className="font-bold">
                {Number(totals.totalTax || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {(totals.components || []).map((c) => (
              <div
                key={c.name}
                className="flex justify-between py-1 text-xs text-gray-600 pl-4"
              >
                <span>
                  {c.name} ({c.rate}%):
                </span>
                <span>
                  {Number(c.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
              <span>GRAND TOTAL:</span>
              <span>
                {Number(totals.grandTotal || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {!isViewMode ? (
            <div className="mt-6 flex gap-3">
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={() => submit("post")}
              >
                Save
              </button>
              <button
                className="btn"
                onClick={() => navigate("/purchase/direct-purchase")}
              >
                Back
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <UnitConversionModal
        open={convModal.open}
        onClose={() => setConvModal((p) => ({ ...p, open: false }))}
        itemId={convModal.itemId}
        defaultUom={convModal.defaultUom}
        currentUom={convModal.currentUom}
        conversions={unitConversions}
        onApply={applyConversion}
      />
    </div>
  );
}
