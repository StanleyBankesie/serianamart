import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "Select..."}</option>
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PosReturnForm() {
  const [now, setNow] = useState(new Date());
  const [searchSaleId, setSearchSaleId] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchPayment, setSearchPayment] = useState("");
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({
    amount: 0,
    method: "",
    ref: "",
  });
  const [returnTimestamp, setReturnTimestamp] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayLoading, setDayLoading] = useState(true);
  const [entryPriceType, setEntryPriceType] = useState("");
  const [priceTypes, setPriceTypes] = useState([]);
  const [priceTypesLoading, setPriceTypesLoading] = useState(false);
  const [priceTypesError, setPriceTypesError] = useState("");
  const [products, setProducts] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDayLoading(true);
    api
      .get("/pos/day/status")
      .then((res) => {
        if (cancelled) return;
        const item = res?.data?.item || null;
        const isOpen = String(item?.status || "").toUpperCase() === "OPEN";
        setDayOpen(isOpen);
      })
      .catch(() => {
        if (cancelled) return;
        setDayOpen(false);
      })
      .finally(() => {
        if (cancelled) return;
        setDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setPriceTypesLoading(true);
    setPriceTypesError("");
    api
      .get("/sales/price-types")
      .then((res) => {
        if (!mounted) return;
        const raw = Array.isArray(res.data?.items) ? res.data.items : [];
        setPriceTypes(raw);
        if (!entryPriceType && raw.length) {
          let def =
            raw.find(
              (pt) =>
                String(pt.name || "")
                  .trim()
                  .toLowerCase() === "retail",
            ) || raw[0];
          if (def && def.id) {
            setEntryPriceType(String(def.id));
          }
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setPriceTypesError(
          e?.response?.data?.message || "Failed to load price types",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setPriceTypesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [entryPriceType]);

  useEffect(() => {
    let mounted = true;
    setItemsLoading(true);
    setItemsError("");
    api
      .get("/inventory/items")
      .then((res) => {
        if (!mounted) return;
        const raw = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = raw
          .filter((it) => it && it.is_active !== false)
          .map((it) => ({
            id: it.id,
            name: it.item_name || "",
            code: it.item_code || "",
          }));
        setProducts(mapped);
      })
      .catch((e) => {
        if (!mounted) return;
        setItemsError(e?.response?.data?.message || "Failed to load items");
      })
      .finally(() => {
        if (!mounted) return;
        setItemsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function recalcPricesForReturnItems() {
      if (!Array.isArray(returnItems) || !returnItems.length) return;
      const next = await Promise.all(
        returnItems.map(async (p) => {
          const prod =
            products.find(
              (it) =>
                String(it.name || "")
                  .trim()
                  .toLowerCase() ===
                String(p.name || "")
                  .trim()
                  .toLowerCase(),
            ) || null;
          const newPrice = prod
            ? await resolveStandardPrice(prod.id, entryPriceType, p.price)
            : p.price;
          return { ...p, price: newPrice };
        }),
      );
      if (!cancelled) setReturnItems(next);
    }
    recalcPricesForReturnItems();
    return () => {
      cancelled = true;
    };
  }, [entryPriceType]);

  async function resolveStandardPrice(productId, priceTypeId, fallbackPrice) {
    try {
      const body = {
        product_id: productId,
        quantity: 1,
        price_type: priceTypeId || "",
        only_standard: true,
      };
      const res = await api.post("/sales/prices/best-price", body);
      const price = Number(res.data?.price);
      if (Number.isFinite(price)) {
        return price;
      }
      return Number(fallbackPrice || 0);
    } catch {
      return Number(fallbackPrice || 0);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadReceiptsForDate() {
      const date = String(searchDate || "").trim();
      setSearchSaleId("");
      setSearchPhone("");
      setSearchPayment("");
      setCurrentReceipt(null);
      setReturnItems([]);
      if (!date) {
        setReceiptsLoading(true);
        try {
          const res = await api.get("/pos/sales", { params: { limit: 200 } });
          const rows = Array.isArray(res.data?.items)
            ? res.data.items
            : Array.isArray(res.data?.item)
              ? res.data.item
              : [];
          const mapped = rows.map((it) => ({
            id: it.id,
            receiptNo: String(it.sale_no || ""),
            date: String(it.sale_date || "").slice(0, 10),
            customer: String(it.customer_id || ""),
            payment: String(it.payment_method || "").replace(/^./, (c) =>
              c.toUpperCase(),
            ),
          }));
          setReceipts(mapped);
        } catch {
          setReceipts([]);
        } finally {
          setReceiptsLoading(false);
        }
        return;
      }
      setReceiptsLoading(true);
      try {
        async function fetchSales(params) {
          const res = await api.get("/pos/sales", {
            params: { limit: 1000, ...params },
          });
          const rows = Array.isArray(res.data?.items)
            ? res.data.items
            : Array.isArray(res.data?.item)
              ? res.data.item
              : [];
          return rows;
        }

        let rows = [];
        try {
          rows = await fetchSales({ date });
        } catch {}
        if (!cancelled && !rows.length) {
          try {
            rows = await fetchSales({ sale_date: date });
          } catch {}
        }
        if (!cancelled && !rows.length) {
          try {
            rows = await fetchSales({ from: date, to: date });
          } catch {}
        }
        if (!cancelled && !rows.length) {
          try {
            const all = await fetchSales({});
            rows = all.filter(
              (it) =>
                String(it.sale_date || it.date || "").slice(0, 10) === date,
            );
          } catch {}
        }

        if (cancelled) return;
        const mapped = rows.map((it) => ({
          id: it.id,
          receiptNo: String(it.sale_no || ""),
          date: String(it.sale_date || "").slice(0, 10),
          customer: String(it.customer_id || ""),
          payment: String(it.payment_method || "").replace(/^./, (c) =>
            c.toUpperCase(),
          ),
        }));
        setReceipts(mapped);
      } catch {
        if (cancelled) return;
        setReceipts([]);
      } finally {
        if (cancelled) return;
        setReceiptsLoading(false);
      }
    }
    loadReceiptsForDate();
    return () => {
      cancelled = true;
    };
  }, [searchDate]);

  const subtotal = useMemo(
    () => returnItems.reduce((sum, i) => sum + i.price * i.returnQuantity, 0),
    [returnItems],
  );
  const tax = useMemo(() => subtotal * 0.125, [subtotal]);
  const totalRefund = useMemo(() => subtotal + tax, [subtotal, tax]);

  async function searchReceipt() {
    const id = Number(searchSaleId || 0);
    if (!id) return;
    const match = receipts.find((r) => Number(r.id) === id) || null;
    if (!match) return;
    try {
      const res = await api.get(`/pos/sales/${match.id}`);
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      const items = details.map((d, idx) => ({
        id: idx + 1,
        name: String(d.item_name || ""),
        price: Number(d.unit_price || 0),
        quantity: Number(d.qty || 0),
      }));
      setCurrentReceipt({ ...match, items });
      setReturnItems([]);
    } catch {
      setCurrentReceipt({ ...match, items: [] });
      setReturnItems([]);
    }
  }

  function toggleItem(itemId, checked) {
    if (!currentReceipt) return;
    const item = currentReceipt.items.find((i) => i.id === itemId);
    if (!item) return;
    if (checked) {
      (async () => {
        const prod =
          products.find(
            (p) =>
              String(p.name || "")
                .trim()
                .toLowerCase() ===
              String(item.name || "")
                .trim()
                .toLowerCase(),
          ) || null;
        const resolvedPrice = prod
          ? await resolveStandardPrice(prod.id, entryPriceType, item.price)
          : item.price;
        const entry = {
          id: item.id,
          name: item.name,
          price: resolvedPrice,
          soldQty: item.quantity,
          returnQuantity: 1,
          reason: "defective",
        };
        setReturnItems((prev) => {
          const idx = prev.findIndex((p) => p.id === itemId);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = entry;
            return next;
          }
          return [...prev, entry];
        });
      })();
    } else {
      setReturnItems((prev) => prev.filter((p) => p.id !== itemId));
    }
  }

  function updateQty(itemId, qty) {
    const val = Math.max(1, Number(qty || 1));
    setReturnItems((prev) =>
      prev.map((p) => (p.id === itemId ? { ...p, returnQuantity: val } : p)),
    );
  }

  function updateReason(itemId, reason) {
    setReturnItems((prev) =>
      prev.map((p) => (p.id === itemId ? { ...p, reason } : p)),
    );
  }

  function removeFromList(itemId) {
    setReturnItems((prev) => prev.filter((p) => p.id !== itemId));
  }

  function clearSelection() {
    if (!returnItems.length) return;
    setReturnItems([]);
  }

  function processReturn() {
    if (!returnItems.length) return;
    const ref = "RTN-" + Date.now();
    const ts = new Date();
    setModalData({
      amount: totalRefund,
      method:
        refundMethod === "cash"
          ? "Cash"
          : refundMethod === "card"
            ? "Card Refund"
            : refundMethod === "mobile"
              ? "Mobile Money"
              : "Store Credit",
      ref,
    });
    setReturnTimestamp(ts);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setCurrentReceipt(null);
    setReturnItems([]);
    setSearchSaleId("");
    setSearchDate("");
    setSearchPhone("");
    setSearchPayment("");
    setNotes("");
  }

  function printReturnReceipt() {
    if (!currentReceipt || !returnItems.length) return;
    const when = returnTimestamp ? new Date(returnTimestamp) : new Date();
    const dateStr = when.toLocaleString();
    const linesHtml = returnItems
      .map((it) => {
        const qty = Number(it.returnQuantity || 0);
        const unit = Number(it.price || 0);
        const total = qty * unit;
        const reason = String(it.reason || "").replace(/^./, (c) =>
          c.toUpperCase(),
        );
        return `<tr>
          <td>${String(it.name || "")}</td>
          <td class="right">${qty}</td>
          <td class="right">${unit.toFixed(2)}</td>
          <td class="right">${total.toFixed(2)}</td>
          <td>${reason}</td>
        </tr>`;
      })
      .join("");
    const notesHtml = String(notes || "").trim()
      ? `<div class="muted" style="margin-top:8px;">Notes: ${String(
          notes || "",
        )}</div>`
      : "";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>POS Return Receipt</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; max-width: 480px; margin: 0 auto; }
          h1 { text-align: center; margin: 0 0 4px; font-size: 18px; }
          .center { text-align: center; }
          .muted { font-size: 12px; color: #555; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { padding: 4px; border-bottom: 1px solid #eee; vertical-align: top; }
          th { text-align: left; }
          th.right, td.right { text-align: right; }
          .totals { margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>RETURN RECEIPT</h1>
        <div class="center muted">Sales Return & Refund</div>
        <hr />
        <div class="row"><span>Return Ref:</span><span>${String(
          modalData.ref || "-",
        )}</span></div>
        <div class="row"><span>Original Receipt:</span><span>${String(
          currentReceipt.receiptNo || "-",
        )}</span></div>
        <div class="row"><span>Sale Date:</span><span>${String(
          currentReceipt.date || "-",
        )}</span></div>
        <div class="row"><span>Return Date:</span><span>${dateStr}</span></div>
        <div class="row"><span>Refund Method:</span><span>${String(
          modalData.method || "-",
        )}</span></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="right">Qty</th>
              <th class="right">Price</th>
              <th class="right">Total</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Items Subtotal</span><span>${subtotal.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Tax Refund</span><span>${tax.toFixed(
            2,
          )}</span></div>
          <div class="row"><strong>Total Refund</strong><strong>${totalRefund.toFixed(
            2,
          )}</strong></div>
        </div>
        ${notesHtml}
        <button onclick="window.print()">Print</button>
      </body>
      </html>
    `;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc =
      iframe.contentWindow?.document || iframe.contentDocument || null;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    const w = iframe.contentWindow;
    if (!w) return;
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 500);
    }, 150);
  }

  const receiptOptions = useMemo(() => {
    return (Array.isArray(receipts) ? receipts : [])
      .filter((r) => {
        const phone = String(searchPhone || "")
          .trim()
          .toLowerCase();
        const pay = String(searchPayment || "")
          .trim()
          .toLowerCase();
        if (
          phone &&
          !String(r.customer || "")
            .toLowerCase()
            .includes(phone)
        ) {
          return false;
        }
        if (pay && String(r.payment || "").toLowerCase() !== pay) return false;
        return true;
      })
      .map((r) => {
        const no = String(r.receiptNo || "-");
        const dt = String(r.date || "");
        const label = dt ? `${no} • ${dt}` : no;
        return { value: String(r.id), label };
      });
  }, [receipts, searchPhone, searchPayment]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Sales Return & Refund
          </h1>
          <p className="text-sm mt-1">Process returns from original receipts</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700">
            {now.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!dayLoading && !dayOpen && (
            <div className="alert-danger rounded-lg p-4">
              Day is not open. Open day before processing returns.
              <div className="mt-2">
                <Link to="/pos/day-management" className="btn-secondary">
                  Open Day Management
                </Link>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Find Original Sale</div>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Sale Date</label>
                  <input
                    type="date"
                    className="input"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    disabled={!dayOpen}
                  />
                </div>
                <div>
                  <label className="label">Receipt Number</label>
                  <FilterableSelect
                    value={searchSaleId}
                    onChange={setSearchSaleId}
                    options={receiptOptions}
                    placeholder={
                      receiptsLoading ? "Loading receipts..." : "Select receipt"
                    }
                    disabled={!dayOpen || receiptsLoading}
                    filterPlaceholder="Filter receipts..."
                  />
                </div>
                <div>
                  <label className="label">Customer Phone</label>
                  <input
                    className="input"
                    placeholder="e.g., 0244123456"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    disabled={!dayOpen}
                  />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <FilterableSelect
                    value={searchPayment}
                    onChange={setSearchPayment}
                    options={[
                      { value: "cash", label: "Cash" },
                      { value: "card", label: "Card" },
                      { value: "mobile", label: "Mobile Money" },
                    ]}
                    placeholder="All Methods"
                    disabled={!dayOpen}
                    filterPlaceholder="Filter methods..."
                  />
                </div>
                <div>
                  <label className="label">Price Type</label>
                  <FilterableSelect
                    value={entryPriceType}
                    onChange={(val) => {
                      setEntryPriceType(val);
                      setReturnItems((prev) => prev.map((p) => ({ ...p })));
                    }}
                    options={priceTypes.map((pt) => ({
                      value: String(pt.id),
                      label: String(pt.name || ""),
                    }))}
                    placeholder={
                      priceTypesLoading
                        ? "Loading price types..."
                        : "Select Price Type"
                    }
                    disabled={
                      !dayOpen || priceTypesLoading || !priceTypes.length
                    }
                    filterPlaceholder="Filter price types..."
                  />
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={searchReceipt}
                  disabled={!dayOpen || !searchSaleId}
                >
                  Search Receipt
                </button>
              </div>
            </div>
          </div>

          {currentReceipt ? (
            <div className="space-y-4">
              <div className="card">
                <div className="card-body">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between">
                      <div className="text-slate-500">Receipt Number</div>
                      <div className="font-medium">
                        {currentReceipt.receiptNo}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-slate-500">Sale Date</div>
                      <div className="font-medium">{currentReceipt.date}</div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-slate-500">Customer</div>
                      <div className="font-medium">
                        {currentReceipt.customer}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="text-slate-500">Payment Method</div>
                      <div className="font-medium">
                        {currentReceipt.payment}
                      </div>
                    </div>
                    <div className="flex justify-between md:col-span-2">
                      <div className="text-slate-500">Original Total</div>
                      <div className="font-medium">
                        {(() => {
                          const s = currentReceipt.items.reduce(
                            (sum, i) => sum + i.price * i.quantity,
                            0,
                          );
                          const t = s * 0.125;
                          return `GH₵ ${(s + t).toFixed(2)}`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="font-semibold">Select Items to Return</div>
                </div>
                <div className="card-body overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Return</th>
                        <th>Item Name</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Sold Qty</th>
                        <th className="text-right">Return Qty</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReceipt.items.map((item) => {
                        const selected = returnItems.find(
                          (r) => r.id === item.id,
                        );
                        return (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={Boolean(selected)}
                                onChange={(e) =>
                                  toggleItem(item.id, e.target.checked)
                                }
                              />
                            </td>
                            <td className="font-medium">{item.name}</td>
                            <td className="text-right">
                              {`GH₵ ${Number(item.price).toFixed(2)}`}
                            </td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                className="input w-24 text-right"
                                min={1}
                                max={item.quantity}
                                value={selected ? selected.returnQuantity : 1}
                                disabled={!selected}
                                onChange={(e) =>
                                  updateQty(item.id, e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <select
                                className="input"
                                value={selected ? selected.reason : "defective"}
                                disabled={!selected}
                                onChange={(e) =>
                                  updateReason(item.id, e.target.value)
                                }
                              >
                                <option value="defective">Defective</option>
                                <option value="wrong">Wrong Item</option>
                                <option value="damaged">Damaged</option>
                                <option value="unwanted">Unwanted</option>
                                <option value="other">Other</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="text-center text-slate-600">
                  Search for a receipt to process returns
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Return Summary</div>
            </div>
            <div className="card-body space-y-3">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {!returnItems.length ? (
                  <div className="text-center text-slate-600">
                    No items selected for return
                  </div>
                ) : (
                  returnItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900">
                          {item.name}
                        </div>
                        <div className="text-red-600 font-semibold">
                          {`-GH₵ ${(item.price * item.returnQuantity).toFixed(
                            2,
                          )}`}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {item.returnQuantity} × GH₵{" "}
                        {Number(item.price).toFixed(2)} •{" "}
                        {String(item.reason || "").replace(/^./, (c) =>
                          c.toUpperCase(),
                        )}
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => removeFromList(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <div>Items Subtotal</div>
                  <div>{`GH₵ ${subtotal.toFixed(2)}`}</div>
                </div>
                <div className="flex justify-between">
                  <div>Tax Refund</div>
                  <div>{`GH₵ ${tax.toFixed(2)}`}</div>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <div>Total Refund</div>
                  <div className="text-red-700">{`GH₵ ${totalRefund.toFixed(
                    2,
                  )}`}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3">
              <div className="font-semibold">Refund Method</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`btn ${
                    refundMethod === "cash" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setRefundMethod("cash")}
                >
                  Cash
                </button>
                <button
                  type="button"
                  className={`btn ${
                    refundMethod === "card" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setRefundMethod("card")}
                >
                  Card
                </button>
                <button
                  type="button"
                  className={`btn ${
                    refundMethod === "mobile" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setRefundMethod("mobile")}
                >
                  Mobile Money
                </button>
                <button
                  type="button"
                  className={`btn ${
                    refundMethod === "credit" ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => setRefundMethod("credit")}
                >
                  Store Credit
                </button>
              </div>
              <div>
                <label className="label">Additional Notes</label>
                <textarea
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={processReturn}
                  disabled={!dayOpen || !returnItems.length}
                >
                  Process Return
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={clearSelection}
                  disabled={!dayOpen || !returnItems.length}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-2xl font-bold text-green-600">
              Return Processed
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div>Refund Amount</div>
                <div className="font-semibold">{`GH₵ ${Number(
                  modalData.amount,
                ).toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between">
                <div>Refund Method</div>
                <div className="font-semibold">{modalData.method}</div>
              </div>
              <div className="flex justify-between">
                <div>Return Reference</div>
                <div className="font-semibold">{modalData.ref}</div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={closeModal}
              >
                New Return
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  printReturnReceipt();
                  closeModal();
                }}
              >
                Print Return Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
