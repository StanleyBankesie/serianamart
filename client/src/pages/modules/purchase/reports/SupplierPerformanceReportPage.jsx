import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function SupplierPerformanceReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/supplier-performance");
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        supplier: r.supplier_name,
        total_pos_issued: Number(r.total_pos_issued || 0),
        on_time_delivery_percent: Number(r.on_time_delivery_percent || 0),
        avg_delivery_delay_days: Number(r.avg_delivery_delay_days || 0),
        total_purchase_value: Number(r.total_purchase_value || 0),
        return_rate_percent: Number(r.return_rate_percent || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SupplierPerformance");
    XLSX.writeFile(wb, "supplier-performance.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Supplier Performance
            </h1>
            <p className="text-sm mt-1">Evaluate supplier reliability</p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>
              Export Excel
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="text-right">Total POs Issued</th>
                  <th className="text-right">On-Time Delivery %</th>
                  <th className="text-right">Avg Delivery Delay (days)</th>
                  <th className="text-right">Total Purchase Value</th>
                  <th className="text-right">Return Rate %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.supplier_name}</td>
                    <td className="text-right">{Number(r.total_pos_issued || 0)}</td>
                    <td className="text-right">{Number(r.on_time_delivery_percent || 0)}</td>
                    <td className="text-right">{Number(r.avg_delivery_delay_days || 0)}</td>
                    <td className="text-right">{Number(r.total_purchase_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.return_rate_percent || 0)}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

