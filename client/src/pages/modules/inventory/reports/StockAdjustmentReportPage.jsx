import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function StockAdjustmentReportPage() {
  const [items, setItems] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadFilters() {
    try {
      const [whRes] = await Promise.all([api.get("/inventory/warehouses")]);
      setWarehouses(whRes.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/inventory/reports/stock-adjustments", {
        params: {
          from: from || null,
          to: to || null,
          warehouseId: warehouseId || null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFilters();
    run();
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, warehouseId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/inventory"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Stock Adjustment Report
          </h1>
          <p className="text-sm mt-1">
            Movements recorded via stock adjustments
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
              <button
                type="button"
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setWarehouseId("");
                }}
                disabled={loading}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const exportRows = rows.map((r) => ({
                    Date: r.adjustment_date
                      ? new Date(r.adjustment_date).toLocaleDateString()
                      : "",
                    "Adjustment No": r.adjustment_no || "",
                    Warehouse: r.warehouse_name || "",
                    Item: r.item_name || r.item_code || "",
                    "Qty": Number(r.qty || 0),
                    UOM: r.uom || "PCS",
                    Status: r.status || "",
                    Reason: r.reason || "",
                  }));
                  const ws = XLSX.utils.json_to_sheet(exportRows, {
                    header: [
                      "Date",
                      "Adjustment No",
                      "Warehouse",
                      "Item",
                      "Qty",
                      "UOM",
                      "Status",
                      "Reason",
                    ],
                  });
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Stock Adjustments");
                  XLSX.writeFile(wb, "stock-adjustments.xlsx");
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Adjustment No</th>
                  <th>Warehouse</th>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th>UOM</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={`${r.adjustment_id}-${idx}`}>
                    <td>
                      {r.adjustment_date
                        ? new Date(r.adjustment_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.adjustment_no}</td>
                    <td>{r.warehouse_name || "-"}</td>
                    <td>{r.item_name || r.item_code || r.item_id}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString()}
                    </td>
                    <td>{r.uom || "PCS"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
