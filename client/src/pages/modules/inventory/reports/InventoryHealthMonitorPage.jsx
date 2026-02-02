import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function InventoryHealthMonitorPage() {
  const [warehouseId, setWarehouseId] = useState("");
  const [thresholdDays, setThresholdDays] = useState(30);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadWarehouses() {
    try {
      const res = await api.get("/inventory/warehouses");
      setWarehouses(res.data?.items || []);
    } catch {}
  }

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/health-monitor", {
        params: {
          warehouseId: warehouseId || null,
          thresholdDays: thresholdDays || null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
    run();
  }, []);

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
            Inventory Health Monitor
          </h1>
          <p className="text-sm mt-1">
            Coverage days, low stock, and reorder risks
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                    {w.name || w.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Threshold Days</label>
              <input
                className="input"
                type="number"
                min={1}
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
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
                className="btn-success"
                onClick={() => {
                  setWarehouseId("");
                  setThresholdDays(30);
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
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "InventoryHealth");
                  XLSX.writeFile(wb, "inventory-health-monitor.xlsx");
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Inventory Health Monitor", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Item", 10, y);
                  doc.text("Available", 95, y);
                  doc.text("Reorder", 130, y);
                  doc.text("Days Cover", 160, y);
                  doc.text("Status", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    doc.text(
                      String(r.item_name || r.item_code || "-").slice(0, 60),
                      10,
                      y,
                    );
                    doc.text(
                      String(Number(r.available_qty || 0).toLocaleString()),
                      95,
                      y,
                    );
                    doc.text(
                      String(Number(r.reorder_level || 0).toLocaleString()),
                      130,
                      y,
                    );
                    doc.text(
                      String(Number(r.days_of_cover || 0).toLocaleString()),
                      160,
                      y,
                    );
                    doc.text(String(r.status || "-"), 190, y, {
                      align: "right",
                    });
                    y += 5;
                  });
                  doc.save("inventory-health-monitor.pdf");
                }}
                disabled={!items.length}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Item</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Reorder Level</th>
                  <th className="text-right">Days of Cover</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-medium">
                      {r.item_name || r.item_code}
                    </td>
                    <td className="text-right">
                      {Number(r.available_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.reorder_level || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.days_of_cover || 0).toLocaleString()}
                    </td>
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
