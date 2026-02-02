import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function StockTakeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    stock_take_no: "",
    stock_take_date: toISODate(new Date()),
    warehouse_id: "",
    status: "DRAFT",
    details: [],
  });

  useEffect(() => {
    let mounted = true;
    setError("");

    Promise.all([api.get("/inventory/items"), api.get("/inventory/warehouses")])
      .then(([itemsRes, whRes]) => {
        if (!mounted) return;
        setItems(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : []
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load lookups");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/stock-takes/${id}`)
      .then((res) => {
        if (!mounted) return;
        const hdr = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!hdr) return;

        setFormData({
          stock_take_no: hdr.stock_take_no || "",
          stock_take_date: toISODate(hdr.stock_take_date),
          warehouse_id: hdr.warehouse_id ? String(hdr.warehouse_id) : "",
          status: hdr.status || "DRAFT",
          details: details.map((d) => ({
            item_id: d.item_id ? String(d.item_id) : "",
            physical_qty: d.physical_qty ?? "",
          })),
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock take");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const itemById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(String(it.id), it);
    return m;
  }, [items]);

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      details: [
        ...prev.details,
        {
          item_id: items[0]?.id ? String(items[0].id) : "",
          physical_qty: "",
        },
      ],
    }));
  };

  const removeLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, patch) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        stock_take_no: formData.stock_take_no || null,
        stock_take_date: formData.stock_take_date,
        warehouse_id: formData.warehouse_id
          ? Number(formData.warehouse_id)
          : null,
        status: formData.status || "DRAFT",
        details: (formData.details || []).map((d) => ({
          item_id: d.item_id ? Number(d.item_id) : null,
          physical_qty: d.physical_qty === "" ? null : Number(d.physical_qty),
        })),
      };

      if (!payload.stock_take_date) throw new Error("Date is required");

      if (isNew) {
        await api.post("/inventory/stock-takes", payload);
      } else {
        await api.put(`/inventory/stock-takes/${id}`, payload);
      }

      navigate("/inventory/stock-take");
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to save stock take"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Stock Take" : "Edit Stock Take"}
              </h1>
              <p className="text-sm mt-1">
                Record physical stock quantities
              </p>
            </div>
            <Link to="/inventory/stock-take" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? (
              <div className="text-sm">
                Loading...
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">No</label>
                <input
                  type="text"
                  className="input"
                  value={formData.stock_take_no}
                  onChange={(e) =>
                    setFormData({ ...formData, stock_take_no: e.target.value })
                  }
                  placeholder="Auto-generated if blank"
                />
              </div>
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.stock_take_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_take_date: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouse_id}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_id: e.target.value })
                  }
                >
                  <option value="">All / Not specified</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {(w.warehouse_code ? `${w.warehouse_code} - ` : "") +
                        w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-brand text-white rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Count Lines
                  </h2>
                  <button
                    type="button"
                    className="btn-success"
                    onClick={addLine}
                  >
                    + Add Item
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Physical Qty</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {!formData.details.length ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-center py-6 text-slate-500 dark:text-slate-400"
                          >
                            No lines. Click "Add Item" to begin.
                          </td>
                        </tr>
                      ) : null}

                      {formData.details.map((d, idx) => {
                        const it = d.item_id
                          ? itemById.get(String(d.item_id))
                          : null;
                        const label = it
                          ? `${it.item_code} - ${it.item_name}`
                          : "Select item...";

                        return (
                          <tr key={idx}>
                            <td>
                              <select
                                className="input"
                                value={d.item_id}
                                onChange={(e) =>
                                  updateLine(idx, { item_id: e.target.value })
                                }
                              >
                                <option value="">Select item...</option>
                                {items.map((i) => (
                                  <option key={i.id} value={String(i.id)}>
                                    {i.item_code} - {i.item_name}
                                  </option>
                                ))}
                              </select>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {label}
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="input"
                                value={d.physical_qty}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    physical_qty: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn-success"
                                onClick={() => removeLine(idx)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link to="/inventory/stock-take" className="btn-success">
                Cancel
              </Link>
              <button type="submit" className="btn-success" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}







