import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function MaterialReturnReportPage() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadFilters() {
    try {
      const [whRes, depRes] = await Promise.all([
        api.get("/inventory/warehouses"),
        api.get("/admin/departments"),
      ]);
      setWarehouses(whRes.data?.items || []);
      setDepartments(depRes.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/inventory/reports/material-returns", {
        params: {
          from: from || null,
          to: to || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
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
  }, [from, to, warehouseId, departmentId]);

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
            Material Return Report
          </h1>
          <p className="text-sm mt-1">Returns recorded in Return to Stores</p>
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
            <div>
              <label className="label">Department</label>
              <select
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.dept_name || d.department_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button type="button" className="btn-success" onClick={run} disabled={loading}>
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setWarehouseId("");
                  setDepartmentId("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>RTS No</th>
                  <th>Date</th>
                  <th>Warehouse</th>
                  <th>Department</th>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th>UOM</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={`${r.rts_id}-${i}`}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {r.rts_no}
                    </td>
                    <td>{r.rts_date ? String(r.rts_date).slice(0, 10) : "-"}</td>
                    <td>{r.warehouse_name || r.warehouse_id || "-"}</td>
                    <td>{r.department_name || r.department_id || "-"}</td>
                    <td>{r.item_name || r.item_code || r.item_id}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString()}
                    </td>
                    <td>{r.uom || "PCS"}</td>
                    <td>{r.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
