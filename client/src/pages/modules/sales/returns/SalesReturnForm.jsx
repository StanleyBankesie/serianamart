import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { Plus, Trash2 } from "lucide-react";

export default function SalesReturnForm() {
  const navigate = useNavigate();
  const { id: returnRouteId } = useParams();
  const existingId =
    returnRouteId && /^\d+$/.test(String(returnRouteId))
      ? Number(returnRouteId)
      : null;
  const readOnly = Boolean(existingId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [taxCodeRates, setTaxCodeRates] = useState({});

  const [formData, setFormData] = useState({
    returnNo: "Auto-generated",
    returnDate: new Date().toISOString().split("T")[0],
    customerId: "",
    invoiceId: "",
    warehouseId: "",
    returnType: "DAMAGED",
    status: "DRAFT",
    remarks: "",
  });

  const [lines, setLines] = useState([
    {
      id: Date.now(),
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyReturned: 1,
      unitPrice: 0,
      reasonCode: "DAMAGED",
      remarks: "",
      taxAmount: 0,
    },
  ]);

  const fetchAvailable = async (warehouseId, itemId) => {
    if (!warehouseId || !itemId) return 0;
    try {
      const resp = await api.get(
        `/inventory/stock/available?warehouse_id=${warehouseId}&item_id=${itemId}`,
      );
      return Number(resp.data?.qty || 0);
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [custRes, whRes, itemsRes, taxRes] = await Promise.all([
          api.get("/sales/customers?active=true"),
          api.get("/inventory/warehouses"),
          api.get("/inventory/items"),
          api.get("/finance/tax-codes", { params: { form: "SALES_RETURN" } }),
        ]);
        if (!mounted) return;
        setCustomers(
          Array.isArray(custRes.data?.items) ? custRes.data.items : [],
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
        setItemsMaster(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        const map = {};
        const taxItems = Array.isArray(taxRes.data?.items)
          ? taxRes.data.items
          : [];
        for (const t of taxItems) {
          map[Number(t.id)] = Number(t.rate_percent || 0);
        }
        setTaxCodeRates(map);

        if (existingId) {
          const detRes = await api.get(`/sales/returns/${existingId}`);
          if (!mounted) return;
          const h = detRes.data?.item || {};
          const details = Array.isArray(detRes.data?.details)
            ? detRes.data.details
            : [];
          setFormData({
            returnNo: String(h.return_no || ""),
            returnDate: h.return_date
              ? String(h.return_date).slice(0, 10)
              : new Date().toISOString().split("T")[0],
            customerId:
              h.customer_id != null && h.customer_id !== ""
                ? String(h.customer_id)
                : "",
            invoiceId:
              h.invoice_id != null && h.invoice_id !== ""
                ? String(h.invoice_id)
                : "",
            warehouseId:
              h.warehouse_id != null && h.warehouse_id !== ""
                ? String(h.warehouse_id)
                : "",
            returnType: String(h.return_type || "DAMAGED"),
            status: String(h.status || "DRAFT"),
            remarks: h.remarks || "",
          });
          const mappedLines = details.map((d, idx) => ({
            id: d.id != null ? Number(d.id) : Date.now() + idx,
            item_id: d.item_id != null ? String(d.item_id) : "",
            itemCode: String(d.item_code || ""),
            itemName: String(d.item_name || ""),
            qtyReturned: Number(d.qty_returned || 0),
            unitPrice: Number(d.unit_price || 0),
            reasonCode: String(d.reason_code || "DAMAGED"),
            remarks: String(d.remarks || ""),
            taxAmount: Number(d.tax_amount || 0),
            uom: String(d.uom || ""),
          }));
          setLines(
            mappedLines.length
              ? mappedLines
              : [
                  {
                    id: Date.now(),
                    item_id: "",
                    itemCode: "",
                    itemName: "",
                    qtyReturned: 1,
                    unitPrice: 0,
                    reasonCode: "DAMAGED",
                    remarks: "",
                    taxAmount: 0,
                  },
                ],
          );
        } else {
          const nextNoRes = await api.get("/sales/returns/next-no");
          if (!mounted) return;
          const nextNo = String(nextNoRes.data?.nextNo || "").trim();
          if (nextNo) {
            setFormData((p) => ({ ...p, returnNo: nextNo }));
          }
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load data");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [existingId]);
  useEffect(() => {
    setFormData((p) => ({ ...p, invoiceId: "" }));
    setInvoices([]);
    const cid = formData.customerId;
    if (!cid) return;
    api
      .get(`/sales/invoices?customer_id=${cid}`)
      .then((res) => {
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setInvoices(list);
        if (list.length > 0) {
          setFormData((p) => ({ ...p, invoiceId: String(list[0].id) }));
        }
      })
      .catch(() => {
        setInvoices([]);
      });
  }, [formData.customerId]);
  useEffect(() => {
    if (readOnly) return;
    const invId = formData.invoiceId;
    if (!invId) return;
    api
      .get(`/sales/invoices/${invId}`)
      .then(async (res) => {
        const hdr = res.data?.item || {};
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (hdr?.warehouse_id) {
          setFormData((p) => ({
            ...p,
            warehouseId: String(hdr.warehouse_id),
          }));
        }
        let mapped = details.map((d, idx) => {
          const item = itemsMaster.find(
            (i) => Number(i.id) === Number(d.item_id),
          );
          const rate = Number(
            taxCodeRates[Number(item?.vat_on_sales_id || 0)] || 0,
          );
          const qty = Math.round(Number(d.quantity || 0) * 100) / 100;
          const price = Math.round(Number(d.unit_price || 0) * 100) / 100;
          const taxAmount =
            Math.round(((qty * price * rate) / 100) * 100) / 100;
          return {
            id: Date.now() + idx,
            item_id: d.item_id,
            itemCode: d.item_code || "",
            itemName: d.item_name || "",
            qtyReturned: qty,
            unitPrice: price,
            reasonCode: formData.returnType || "DAMAGED",
            remarks: "",
            taxAmount,
            uom: d.uom || "",
          };
        });
        const wh = hdr?.warehouse_id || formData.warehouseId || "";
        if (mapped.length && wh) {
          const enriched = await Promise.all(
            mapped.map(async (l) => ({
              ...l,
              availableQty: await fetchAvailable(wh, l.item_id),
            })),
          );
          mapped = enriched;
        }
        if (mapped.length) {
          setLines(mapped);
        }
      })
      .catch(() => {
        // ignore
      });
  }, [formData.invoiceId, itemsMaster, taxCodeRates, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const wh = formData.warehouseId;
    if (!wh) {
      setLines((prev) =>
        prev.map((l) => ({
          ...l,
          availableQty: undefined,
        })),
      );
      return;
    }
    const refresh = async () => {
      const updated = await Promise.all(
        lines.map(async (l) => {
          if (!l.item_id) {
            return { ...l, availableQty: undefined };
          }
          const qty = await fetchAvailable(wh, l.item_id);
          return { ...l, availableQty: qty };
        }),
      );
      setLines(updated);
    };
    refresh();
  }, [formData.warehouseId, readOnly]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now(),
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyReturned: 1,
        unitPrice: 0,
        reasonCode: formData.returnType || "DAMAGED",
        remarks: "",
      },
    ]);
  };
  const removeLine = (lineId) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };
  const handleItemChange = (lineId, itemId) => {
    const item = itemsMaster.find((i) => String(i.id) === String(itemId));
    setLines(
      lines.map((l) =>
        l.id !== lineId
          ? l
          : {
              ...l,
              item_id: itemId,
              itemCode: item?.item_code || "",
              itemName: item?.item_name || "",
              unitPrice:
                Number(item?.selling_price || 0) ||
                Number(item?.standard_price || 0) ||
                0,
              reasonCode: formData.returnType || "DAMAGED",
              taxAmount:
                ((Number(l.qtyReturned) || 0) *
                  (Number(
                    Number(item?.selling_price || 0) ||
                      Number(item?.standard_price || 0) ||
                      0,
                  ) || 0) *
                  Number(
                    taxCodeRates[Number(item?.vat_on_sales_id || 0)] || 0,
                  )) /
                100,
            },
      ),
    );
    const wh = formData.warehouseId;
    if (wh && itemId) {
      fetchAvailable(wh, Number(itemId))
        .then((qty) => {
          setLines((prev) =>
            prev.map((l) =>
              l.id !== lineId ? l : { ...l, availableQty: qty },
            ),
          );
        })
        .catch(() => {
          setLines((prev) =>
            prev.map((l) => (l.id !== lineId ? l : { ...l, availableQty: 0 })),
          );
        });
    } else {
      setLines((prev) =>
        prev.map((l) =>
          l.id !== lineId ? l : { ...l, availableQty: undefined },
        ),
      );
    }
  };
  const updateLine = (lineId, field, value) => {
    setLines(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        const patch = { ...l, [field]: value };
        const item = itemsMaster.find(
          (i) => Number(i.id) === Number(patch.item_id),
        );
        const rate = Number(
          taxCodeRates[Number(item?.vat_on_sales_id || 0)] || 0,
        );
        const qty =
          Number(field === "qtyReturned" ? value : patch.qtyReturned) || 0;
        const price =
          Number(field === "unitPrice" ? value : patch.unitPrice) || 0;
        patch.taxAmount = Math.round(((qty * price * rate) / 100) * 100) / 100;
        return patch;
      }),
    );
  };

  const normalizedItems = useMemo(() => {
    return lines
      .filter((l) => l.item_id && Number(l.qtyReturned) > 0)
      .map((l) => ({
        item_id: Number(l.item_id),
        qty_returned: Number(l.qtyReturned) || 0,
        unit_price: Number(l.unitPrice) || 0,
        reason_code: l.reasonCode || null,
        remarks: l.remarks || null,
        tax_amount: Number(l.taxAmount) || 0,
      }));
  }, [lines]);

  const totals = useMemo(() => {
    const subTotal = lines.reduce(
      (sum, l) =>
        sum + (Number(l.qtyReturned) || 0) * (Number(l.unitPrice) || 0),
      0,
    );
    const taxTotal = lines.reduce(
      (sum, l) => sum + (Number(l.taxAmount) || 0),
      0,
    );
    const grandTotal = subTotal + taxTotal;
    return {
      subTotal: Math.round(subTotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [lines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        return_date: formData.returnDate,
        customer_id: formData.customerId ? Number(formData.customerId) : null,
        invoice_id: formData.invoiceId ? Number(formData.invoiceId) : null,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        return_type: formData.returnType,
        status: formData.status,
        remarks: formData.remarks || null,
        items: normalizedItems,
      };
      await api.post("/sales/returns", payload);
      navigate("/sales/returns", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save sales return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {readOnly ? "View Sales Return" : "New Sales Return"}
              </h1>
              <p className="text-sm mt-1">
                Record returned goods and auto-create a Credit Note
              </p>
            </div>
            <Link to="/sales/returns" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>
        <div className="card-body p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Return No</label>
                <input className="input" value={formData.returnNo} readOnly />
              </div>
              <div>
                <label className="label">Return Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.returnDate}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, returnDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Customer</label>
                <select
                  className="input"
                  value={formData.customerId}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, customerId: e.target.value }))
                  }
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              {formData.customerId ? (
                <div>
                  <label className="label">Related Invoice</label>
                  <select
                    className="input"
                    value={formData.invoiceId}
                    disabled={readOnly}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, invoiceId: e.target.value }))
                    }
                  >
                    {invoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_no}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Related Invoice</label>
                  <input className="input" value="" readOnly />
                </div>
              )}
              <div>
                <label className="label">Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, warehouseId: e.target.value }))
                  }
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Reason for Return</label>
              <select
                className="input w-full md:w-1/3"
                value={formData.returnType}
                disabled={readOnly}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, returnType: e.target.value }))
                }
              >
                <option value="DAMAGED">Damaged</option>
                <option value="WRONG_ITEM">Wrong Item</option>
                <option value="QUALITY_ISSUE">Quality Issue</option>
                <option value="EXCESS">Excess</option>
              </select>
            </div>

            <div>
              <label className="label">Reason / Remarks</label>
              <textarea
                className="textarea w-full"
                rows={3}
                placeholder="Reason for rejection or return details"
                value={formData.remarks}
                readOnly={readOnly}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, remarks: e.target.value }))
                }
              />
            </div>

            <div className="rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="p-4 flex items-center justify-between">
                <div className="font-medium">Return Items</div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addLine}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Line
                  </button>
                ) : (
                  <div className="h-9 w-28" aria-hidden />
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-80">Item</th>
                      <th className="w-32">Code</th>
                      <th className="w-24">UOM</th>
                      <th className="text-right w-28">Qty</th>
                      <th className="w-32">Convert</th>
                      <th className="text-right w-32">Available</th>
                      <th className="text-right w-32">Unit Price</th>
                      <th className="text-right w-24">Disc%</th>
                      <th className="text-right w-28">Tax</th>
                      <th className="text-right w-32">Total</th>
                      <th className="w-40">Reason</th>
                      <th className="w-64">Remarks</th>
                      {!readOnly && <th className="w-16"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((ln) => (
                      <tr key={ln.id}>
                        <td>
                          <select
                            className="input w-full min-w-[18rem]"
                            value={ln.item_id}
                            disabled={readOnly}
                            onChange={(e) =>
                              handleItemChange(ln.id, e.target.value)
                            }
                          >
                            <option value="">Select item</option>
                            {itemsMaster.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{ln.itemCode || ""}</td>
                        <td>
                          <input
                            className="input w-full min-w-[5rem]"
                            value={ln.uom || ""}
                            readOnly
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            className="input text-right w-full min-w-[5rem]"
                            value={ln.qtyReturned}
                            readOnly={readOnly}
                            onChange={(e) =>
                              updateLine(ln.id, "qtyReturned", e.target.value)
                            }
                          />
                        </td>
                        <td></td>
                        <td className="text-right">
                          {formData.warehouseId
                            ? Number(ln.availableQty || 0).toFixed(2)
                            : ""}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input text-right w-full min-w-[6rem]"
                            value={ln.unitPrice}
                            readOnly={readOnly}
                            onChange={(e) =>
                              updateLine(ln.id, "unitPrice", e.target.value)
                            }
                          />
                        </td>
                        <td className="text-right">{Number(0).toFixed(2)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input text-right w-full min-w-[6rem]"
                            value={Number(ln.taxAmount || 0).toFixed(2)}
                            readOnly
                          />
                        </td>
                        <td className="text-right">
                          {(
                            (Number(ln.qtyReturned) || 0) *
                              (Number(ln.unitPrice) || 0) +
                            Number(ln.taxAmount || 0)
                          ).toFixed(2)}
                        </td>
                        <td>
                          <select
                            className="input w-full min-w-[8rem]"
                            value={ln.reasonCode}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(ln.id, "reasonCode", e.target.value)
                            }
                          >
                            <option value="DAMAGED">Damaged</option>
                            <option value="WRONG_ITEM">Wrong Item</option>
                            <option value="QUALITY_ISSUE">Quality Issue</option>
                            <option value="EXCESS">Excess</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="input w-full min-w-[10rem]"
                            value={ln.remarks}
                            readOnly={readOnly}
                            onChange={(e) =>
                              updateLine(ln.id, "remarks", e.target.value)
                            }
                          />
                        </td>
                        {!readOnly && (
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm text-red-600"
                              onClick={() => removeLine(ln.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 flex justify-end gap-6">
                <div className="text-right">
                  <div className="text-sm text-slate-500">Sub Total</div>
                  <div className="text-lg font-bold">
                    {totals.subTotal.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Tax</div>
                  <div className="text-lg font-bold">
                    {totals.taxTotal.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Total</div>
                  <div className="text-lg font-bold">
                    {totals.grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to="/sales/returns" className="btn btn-secondary">
                {readOnly ? "Back to List" : "Cancel"}
              </Link>
              {!readOnly && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Sales Return"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
