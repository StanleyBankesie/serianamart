import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import UnitConversionModal from "../../../../components/UnitConversionModal.jsx";
import { useUoms } from "../../../../hooks/useUoms.js";

export default function DirectPurchase() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const dpId = params?.id ? Number(params.id) : null;
  const isViewMode =
    location?.pathname?.endsWith(`/direct-purchase/${params?.id || ""}`) &&
    String(new URLSearchParams(location.search).get("mode") || "") === "view";
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
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
    payment_terms: 30,
    remarks: "",
  });
  const [lines, setLines] = useState([
    {
      item_id: "",
      qty: "",
      unit_price: "",
      discount_percent: "",
      tax_percent: "",
      uom: "PCS",
      line_total: 0,
    },
  ]);
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
          payment_terms: hdr.payment_terms || 30,
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
        const [sup, wh, it, cur, std, conv, tax] = await Promise.all([
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
            .get("/finance/tax-codes")
            .catch(() => ({ data: { items: [] } }))
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

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    for (const l of lines) {
      const qty = Number(l.qty || 0);
      const unit = Number(l.unit_price || 0);
      const discP = Number(l.discount_percent || 0);
      const taxP = Number(l.tax_percent || 0);
      const gross = qty * unit;
      const disc = gross * (discP / 100);
      const base = Math.max(0, gross - disc);
      const tax = base * (taxP / 100);
      subtotal += gross;
      totalDiscount += disc;
      totalTax += tax;
    }
    const grandTotal = subtotal - totalDiscount + totalTax;
    return { subtotal, totalDiscount, totalTax, grandTotal };
  }, [lines]);

  function updateForm(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function onSupplierChange(id) {
    const sid = id ? Number(id) : null;
    const sup = suppliers.find((s) => Number(s.id) === sid) || null;
    const curId = sup?.currency_id ?? baseCurrencyId ?? "";
    const terms = sup?.payment_terms ?? 30;
    setForm((prev) => ({
      ...prev,
      supplier_id: id,
      currency_id: curId || "",
      payment_terms: Number(terms || 30),
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
    const tax = taxable * (taxPct / 100);
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
      const msg = `Direct Purchase ${dp.dp_no || ""} saved`;
      setSuccess(msg);
      navigate("/purchase/direct-purchase", { state: { success: msg } });
    } catch (e) {
      setError(String(e?.response?.data?.message || e.message || "Error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border border-[#dee2e6] bg-white shadow-erp">
        <div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg">
          <h1 className="text-2xl font-bold">Direct Purchase</h1>
          <p className="text-sm mt-1 opacity-90">
            Complete a full purchase in one step
          </p>
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

          <div className="mt-6">
            <div className="overflow-x-auto rounded border border-[#dee2e6]">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 240 }}>Item</th>
                    <th style={{ width: 100 }}>Qty</th>
                    <th style={{ width: 120 }}>UOM</th>
                    <th style={{ width: 140 }}>Unit Price</th>
                    <th style={{ width: 120 }}>Discount %</th>
                    <th style={{ width: 140 }}>Tax Code</th>
                    <th style={{ width: 140 }} className="text-right">
                      Line Total
                    </th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          className="input"
                          value={l.item_id}
                          onChange={(e) => onItemChange(i, e.target.value)}
                          disabled={isViewMode}
                        >
                          <option value="">Select item</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.item_code} - {it.item_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={l.qty}
                          onChange={(e) => updateLine(i, "qty", e.target.value)}
                          disabled={isViewMode}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <select
                            className="input"
                            value={l.uom || defaultUomCode}
                            onChange={(e) =>
                              updateLine(i, "uom", e.target.value)
                            }
                            disabled={isViewMode}
                          >
                            <option value="">Select UOM</option>
                            {(Array.isArray(uoms) ? uoms : []).map((u) => (
                              <option key={u.id} value={u.uom_code}>
                                {u.uom_name
                                  ? `${u.uom_name} (${u.uom_code})`
                                  : u.uom_code}
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const it = items.find(
                              (ai) => String(ai.id) === String(l.item_id),
                            );
                            const defaultUom =
                              (it?.uom && String(it.uom)) ||
                              (l.uom && String(l.uom)) ||
                              (defaultUomCode ? String(defaultUomCode) : "");
                            const nonDefaults = (
                              Array.isArray(unitConversions)
                                ? unitConversions
                                : []
                            )
                              .filter(
                                (c) =>
                                  Number(c.is_active) &&
                                  Number(c.item_id) === Number(l.item_id) &&
                                  String(c.to_uom) === defaultUom,
                              )
                              .map((c) => String(c.from_uom));
                            const currentUom = String(l.uom || "");
                            const preferredUom =
                              currentUom && currentUom !== defaultUom
                                ? currentUom
                                : nonDefaults[0] || "";
                            const hasConv =
                              nonDefaults.length > 0 &&
                              preferredUom &&
                              preferredUom !== defaultUom;
                            return hasConv ? (
                              <button
                                type="button"
                                className="btn-outline text-xs"
                                onClick={() => openVerifyQty(i, l)}
                              >
                                Verify qty in {preferredUom}
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={l.unit_price}
                          onChange={(e) =>
                            updateLine(i, "unit_price", e.target.value)
                          }
                          disabled={isViewMode}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input"
                          value={l.discount_percent}
                          onChange={(e) =>
                            updateLine(i, "discount_percent", e.target.value)
                          }
                          disabled={isViewMode}
                        />
                      </td>
                      <td>
                        <select
                          className="input"
                          value={(() => {
                            const match = taxes.find(
                              (t) =>
                                Number(t.rate) === Number(l.tax_percent || 0),
                            );
                            return match ? match.value : "";
                          })()}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const tax = taxes.find(
                              (t) => String(t.value) === String(selectedId),
                            );
                            const rate = tax ? tax.rate : 0;
                            updateLine(i, "tax_percent", rate);
                          }}
                          disabled={isViewMode}
                        >
                          <option value="">No Tax</option>
                          {taxes.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-right font-medium">
                        {Number(l.line_total || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        {!isViewMode ? (
                          <button
                            className="btn btn-danger"
                            onClick={() => removeLine(i)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isViewMode ? (
              <div className="mt-3">
                <button className="btn btn-outline" onClick={addLine}>
                  Add Line
                </button>
              </div>
            ) : null}
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
                className="btn btn-outline"
                disabled={saving}
                onClick={() => submit("draft")}
              >
                Save Draft
              </button>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={() => submit("post")}
              >
                Save & Post
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
