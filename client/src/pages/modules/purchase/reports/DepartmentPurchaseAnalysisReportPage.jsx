import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function DepartmentPurchaseAnalysisReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/department-analysis");
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

  function exportCSV() {
    if (!items.length) return;
    const headers = ["Department", "Total Purchases", "Total Bills", "Pending Orders", "Import Total", "Local Total"];
    const rows = items.map((r) => [
      r.department || "N/A",
      Number(r.total_purchases || 0).toFixed(2),
      Number(r.total_bills || 0),
      Number(r.pending_orders || 0),
      Number(r.import_total || 0).toFixed(2),
      Number(r.local_total || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "department-purchase-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        department: r.department || "N/A",
        total_purchases: Number(r.total_purchases || 0),
        total_bills: Number(r.total_bills || 0),
        pending_orders: Number(r.pending_orders || 0),
        import_total: Number(r.import_total || 0),
        local_total: Number(r.local_total || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DeptPurchaseAnalysis");
    XLSX.writeFile(wb, "department-purchase-analysis.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Department Purchase Analysis", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Department", 10, y);
    doc.text("Purchases", 90, y);
    doc.text("Bills", 120, y);
    doc.text("Pending", 140, y);
    doc.text("Import", 165, y);
    doc.text("Local", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.department || "N/A").slice(0, 60), 10, y);
      doc.text(String(Number(r.total_purchases || 0).toFixed(2)), 90, y);
      doc.text(String(Number(r.total_bills || 0)), 120, y);
      doc.text(String(Number(r.pending_orders || 0)), 140, y);
      doc.text(String(Number(r.import_total || 0).toFixed(2)), 165, y);
      doc.text(String(Number(r.local_total || 0).toFixed(2)), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("department-purchase-analysis.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Department Purchase Analysis</h1>
            <p className="text-sm mt-1">Track spending by department</p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">Return to Menu</Link>
            <button className="btn-success" onClick={exportCSV} disabled={loading || items.length === 0}>Export CSV</button>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>Export Excel</button>
            <button className="btn-primary" onClick={exportPDF} disabled={loading || items.length === 0}>Export PDF</button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-right">Total Purchases</th>
                  <th className="text-right">Total Bills</th>
                  <th className="text-right">Pending Orders</th>
                  <th className="text-right">Import Total</th>
                  <th className="text-right">Local Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.department || "N/A"}</td>
                    <td className="text-right">{Number(r.total_purchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.total_bills || 0)}</td>
                    <td className="text-right">{Number(r.pending_orders || 0)}</td>
                    <td className="text-right">{Number(r.import_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.local_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">No records</td>
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

