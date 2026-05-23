import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { Plus, Trash2 } from "lucide-react";
import { filterByPrefix } from "@/utils/searchUtils.js";

export default function PurchaseReturnForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [returnReasons, setReturnReasons] = useState([]);
  const initialLineId = useMemo(() => Date.now(), []);

  const [formData, setFormData] = useState({
    returnNo: "Auto-generated",
    returnDate: new Date().toISOString().split("T")[0],
    supplierId: "",
    warehouseId: "",
    returnType: "",
    remarks: "",
  });

  const [lines, setLines] = useState([
    {
      id: initialLineId,
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyReturned: 1,
      unitPrice: 0,
      tax_type: "",
      taxAmount: 0,
      reasonCode: "",
      remarks: "",
    },
  ]);
  const [itemQueries, setItemQueries] = useState({ [initialLineId]: "" });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [supRes, whRes, itemsRes, taxRes, nextNoRes, reasonsRes] = await Promise.all([
          api.get("/purchase/suppliers?active=true"),
          api.get("/inventory/warehouses"),
          api.get("/inventory/items"),
          api.get("/finance/tax-codes/by-page/20"),
          api.get("/purchase/returns/next-no"),
          api.get("/purchase/return-rejection-reasons").catch(() => ({ data: { items: [] } })),
        ]);
        if (!mounted) return;
        setSuppliers(
          Array.isArray(supRes.data?.items) ? supRes.data.items : [],
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
        setItemsMaster(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        const taxItems = Array.isArray(taxRes.data?.items)
          ? taxRes.data.items
          : [];
        setTaxes(taxItems);

        const reasonItems = Array.isArray(reasonsRes.data?.items)
          ? reasonsRes.data.items
          : [];
        const activeReasons = reasonItems.filter((r) => r.is_active);
        setReturnReasons(activeReasons);

        if (activeReasons.length > 0) {
          const firstCode = activeReasons[0].reason_code;
          setFormData((p) => ({ ...p, returnType: firstCode }));
          setLines((prev) =>
            prev.map((l) => ({
              ...l,
              reasonCode: firstCode,
            })),
          );
        }

        const nextNo = String(nextNoRes.data?.nextNo || "").trim();
        if (nextNo) {
          setFormData((p) => ({ ...p, returnNo: nextNo }));
        }
      } catch (err) {
        if (!mounted) return;
        setError("Failed to load master data");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // When supplier changes, fetch PAID bills for that supplier
  useEffect(() => {
    const supplierId = formData.supplierId;
    if (!supplierId) {
      setPurchaseBills([]);
      setFormData((p) => ({ ...p, purchaseBillId: "" }));
      return;
    }
    api
      .get("/purchase/bills/outstanding", {
        params: { supplier_id: supplierId, status: "PAID" },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setPurchaseBills(items);
        if (!items.some((b) => String(b.id) === String(formData.purchaseBillId))) {
          setFormData((p) => ({ ...p, purchaseBillId: "" }));
        }
      })
      .catch(() => {
        setPurchaseBills([]);
      });
  }, [formData.supplierId]);

  useEffect(() => {
    const billId = formData.purchaseBillId;
    if (!billId) return;
    const bill = purchaseBills.find((b) => String(b.id) === String(billId));
    if (!bill) return;
    const details = Array.isArray(bill.details) ? bill.details : [];
    const mapped = details.map((d, idx) => {
      const item = itemsMaster.find(
        (i) => Number(i.id) === Number(d.item_id),
      );
      const taxId = String(item?.vat_on_purchase_id || "");
      const taxCode = taxes.find((t) => String(t.id) === taxId);
      const rate = Number(taxCode?.rate_percent || 0);
      const qty = Math.round(Number(d.qty || 0) * 1000) / 1000;
      const price = Math.round(Number(d.unit_price || 0) * 100) / 100;
      const taxAmount =
        Math.round(((qty * price * rate) / 100) * 100) / 100;
      return {
        id: Date.now() + idx,
        item_id: d.item_id ? String(d.item_id) : "",
        itemCode: d.item_code || "",
        itemName: d.item_name || "",
        qtyReturned: qty,
        unitPrice: price,
        tax_type: taxId,
        taxAmount,
        reasonCode: formData.returnType || (returnReasons[0]?.reason_code) || "",
        remarks: "",
      };
    });
    if (mapped.length) setLines(mapped);
  }, [formData.purchaseBillId, purchaseBills, itemsMaster, taxes, returnReasons]);

  const totals = useMemo(() => {
    let subTotal = 0;
    for (const ln of lines) {
      const qty = Number(ln.qtyReturned || 0);
      const price = Number(ln.unitPrice || 0);
      subTotal += qty * price;
    }
    return { subTotal };
  }, [lines]);

  const addLine = () => {
    const newId = Date.now() + Math.random();
    setLines((prev) => [
      ...prev,
      {
        id: newId,
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyReturned: 1,
        unitPrice: 0,
        tax_type: "",
        taxAmount: 0,
        reasonCode: formData.returnType || (returnReasons[0]?.reason_code) || "",
        remarks: "",
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const removeLine = (id) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setItemQueries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setLine = (id, patch) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        const taxCode = taxes.find((t) => String(t.id) === String(next.tax_type));
        const rate = Number(taxCode?.rate_percent || 0);
        const qty = Number(next.qtyReturned || 0);
        const price = Number(next.unitPrice || 0);
        next.taxAmount = Math.round(((qty * price * rate) / 100) * 100) / 100;
        return next;
      }),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        supplier_id: Number(formData.supplierId || 0),
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        return_type: formData.returnType || "DAMAGED",
        remarks: formData.remarks || null,
        return_date: String(formData.returnDate || "").slice(0, 10),
        items: lines
          .filter(
            (ln) =>
              Number(ln.qtyReturned || 0) > 0 && Number(ln.item_id || 0) > 0,
          )
          .map((ln) => ({
            item_id: Number(ln.item_id),
            qty_returned: Number(ln.qtyReturned),
            unit_price: Number(ln.unitPrice || 0),
            tax_type: ln.tax_type || null,
            reason_code: ln.reasonCode || null,
            remarks: ln.remarks || null,
            tax_amount: Number(ln.taxAmount) || 0,
          })),
      };
      const resp = await api.post("/purchase/returns", payload);
      const id = Number(resp.data?.id || 0);
      if (id) {
        navigate("/purchase/purchase-returns");
        return;
      }
      throw new Error("Save failed");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save purchase return",
      );
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
                New Purchase Return
              </h1>
              <p className="text-sm mt-1">
                Record goods returned to supplier and auto-create a Debit Note
              </p>
            </div>
            <Link to="/purchase/purchase-returns" className="btn-success">
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
              <div className="hidden">
                <label className="label">Return No</label>
                <input className="input" value={formData.returnNo} readOnly />
              </div>
              <div>
                <label className="label">Return Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.returnDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, returnDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Reason for Return</label>
                <select
                  className="input"
                  value={formData.returnType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((p) => ({ ...p, returnType: val }));
                    setLines((prev) =>
                      prev.map((l) => ({ ...l, reasonCode: val })),
                    );
                  }}
                >
                  <option value="">Select reason</option>
                  {returnReasons.map((r) => (
                    <option key={r.id} value={r.reason_code}>
                      {r.reason_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Supplier</label>
                <select
                  className="input"
                  value={formData.supplierId}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, supplierId: e.target.value }))
                  }
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Related Purchase Bill</label>
                <select
                  className="input"
                  value={formData.purchaseBillId || ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      purchaseBillId: e.target.value,
                    }))
                  }
                >
                  <option value="">Select purchase bill</option>
                  {purchaseBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bill_no}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, warehouseId: e.target.value }))
                  }
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name || w.warehouse_code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  placeholder="Reason for rejection / notes"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, remarks: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="p-4 flex items-center justify-between">
                <div className="font-medium">Return Items</div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={addLine}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 280 }}>Item</th>
                      <th className="text-right" style={{ width: 130 }}>
                        Qty
                      </th>
                      <th className="text-right" style={{ width: 150 }}>
                        Unit Price
                      </th>
                      <th className="text-right" style={{ width: 150 }}>
                        Tax Code
                      </th>
                      <th className="text-right" style={{ width: 120 }}>
                        Tax Amount
                      </th>
                      <th style={{ width: 180 }}>Reason</th>
                      <th>Remarks</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((ln) => (
                      <tr key={ln.id}>
                        <td>
                          <div className="relative">
                            <input
                              id={`pr-item-search-${ln.id}`} autoComplete="off"
                              className="input"
                              placeholder="Type to search items"
                              value={itemQueries[ln.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [ln.id]: val,
                                }));
                                if (!val && ln.item_id) {
                                  setLine(ln.id, {
                                    item_id: "",
                                    itemCode: "",
                                    itemName: "",
                                    unitPrice: 0,
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const query = (itemQueries[ln.id] || "").trim();
                                  const results = query
                                    ? filterByPrefix(itemsMaster, {
                                        query,
                                        searchFields: ["item_code", "item_name", "barcode"],
                                      })
                                    : [];
                                  if (!query || !results.length) return;
                                  const item = itemsMaster.find(
                                    (it) => Number(it.id) === Number(results[0].id),
                                  );
                                  setLine(ln.id, {
                                    item_id: results[0].id,
                                    itemCode: item?.item_code || "",
                                    itemName: item?.item_name || "",
                                    unitPrice: item?.cost_price != null ? Number(item.cost_price) : ln.unitPrice,
                                  });
                                  setItemQueries((prev) => ({
                                    ...prev,
                                    [ln.id]: "",
                                  }));
                                }
                              }}
                            />
                            {(() => {
                              const query = (itemQueries[ln.id] || "").trim();
                              const results = query
                                ? filterByPrefix(itemsMaster, {
                                    query,
                                    searchFields: ["item_code", "item_name", "barcode"],
                                  })
                                : [];
                              return results.length ? (
                                (() => {
                                  const el = document.getElementById(`pr-item-search-${ln.id}`);
                                  const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                                  return (
                                    <div
                                      className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                      style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                                    >
                                      {results.map((o) => (
                                        <button
                                          type="button"
                                          key={o.id}
                                          className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                          onClick={() => {
                                            const item = itemsMaster.find(
                                              (it) => Number(it.id) === Number(o.id),
                                            );
                                            const taxId = String(item?.vat_on_purchase_id || "");
                                            setLine(ln.id, {
                                              item_id: o.id,
                                              itemCode: item?.item_code || "",
                                              itemName: item?.item_name || "",
                                              unitPrice: item?.cost_price != null ? Number(item.cost_price) : ln.unitPrice,
                                              tax_type: taxId,
                                            });
                                            setItemQueries((prev) => ({
                                              ...prev,
                                              [ln.id]: "",
                                            }));
                                          }}
                                        >
                                          {o.item_code} - {o.item_name}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()
                              ) : null;
                            })()}
                          </div>
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="input text-right"
                            value={ln.qtyReturned}
                            min="0"
                            step="1"
                            onChange={(e) =>
                              setLine(ln.id, {
                                qtyReturned: Number(e.target.value || 0),
                              })
                            }
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="input text-right"
                            value={ln.unitPrice}
                            min="0"
                            step="0.01"
                            onChange={(e) =>
                              setLine(ln.id, {
                                unitPrice: Number(e.target.value || 0),
                              })
                            }
                          />
                        </td>
                        <td className="text-right">
                          <select
                            className="input w-full min-w-[7rem]"
                            value={ln.tax_type}
                            onChange={(e) =>
                              setLine(ln.id, { tax_type: e.target.value })
                            }
                          >
                            <option value="">No Tax</option>
                            {taxes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.code} ({Number(t.rate_percent || 0)}%)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="input text-right bg-gray-50"
                            value={Number(ln.taxAmount || 0).toFixed(2)}
                            min="0"
                            step="0.01"
                            readOnly
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            value={ln.reasonCode || ""}
                            onChange={(e) =>
                              setLine(ln.id, { reasonCode: e.target.value })
                            }
                          >
                            <option value="">Select reason</option>
                            {returnReasons.map((r) => (
                              <option key={r.id} value={r.reason_code}>
                                {r.reason_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={ln.remarks}
                            onChange={(e) =>
                              setLine(ln.id, { remarks: e.target.value })
                            }
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeLine(ln.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
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
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link
                to="/purchase/purchase-returns"
                className="btn btn-secondary"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Purchase Return"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
