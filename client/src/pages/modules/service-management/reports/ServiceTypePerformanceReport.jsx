import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function ServiceTypePerformanceReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        "/service-management/reports/service-type-performance",
      );
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Service Type",
      "Total Orders",
      "Total Revenue",
      "Avg Completion Time",
      "Avg Cost",
    ];
    const rows = items.map((r) => [
      r.service_type || "-",
      Number(r.total_orders || 0),
      Number(r.total_revenue || 0).toFixed(2),
      r.avg_completion_time || "-",
      Number(r.avg_cost || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-type-performance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        service_type: r.service_type,
        total_orders: Number(r.total_orders || 0),
        total_revenue: Number(r.total_revenue || 0),
        avg_completion_time: r.avg_completion_time,
        avg_cost: Number(r.avg_cost || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceTypePerformance");
    XLSX.writeFile(wb, "service-type-performance.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Service Type Performance", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Service Type", 10, y);
    doc.text("Orders", 90, y);
    doc.text("Revenue", 120, y);
    doc.text("Avg Time", 160, y);
    doc.text("Avg Cost", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.service_type || "-").slice(0, 60), 10, y);
      doc.text(String(Number(r.total_orders || 0)), 90, y);
      doc.text(String(Number(r.total_revenue || 0).toFixed(2)), 120, y);
      doc.text(String(r.avg_completion_time || "-"), 160, y);
      doc.text(String(Number(r.avg_cost || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("service-type-performance.pdf");
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Service Type Performance
            </h1>
            <p className="text-sm mt-1">
              Analyze service revenue and cycle times
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/service-management" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Type</th>
                  <th className="text-right">Total Orders</th>
                  <th className="text-right">Total Revenue</th>
                  <th className="text-right">Avg Completion Time</th>
                  <th className="text-right">Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.service_type}</td>
                    <td className="text-right">{r.total_orders || 0}</td>
                    <td className="text-right">{r.total_revenue || 0}</td>
                    <td className="text-right">
                      {r.avg_completion_time || "-"}
                    </td>
                    <td className="text-right">{r.avg_cost || 0}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
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
