import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function PurchaseTrackingReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/purchase/reports/purchase-tracking", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      "Stage",
      "Reference",
      "Supplier",
      "Date",
      "Status",
      "Value",
    ];
    const rows = (Array.isArray(items) ? items : []).map((r) => [
      r.stage || "-",
      r.ref_no || "-",
      r.supplier_name || "-",
      r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-",
      r.status || "-",
      Number(r.total_value || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "purchase_tracking.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = (Array.isArray(items) ? items : []).map((r) => ({
      stage: r.stage || "-",
      reference: r.ref_no || "-",
      supplier: r.supplier_name || "-",
      date: r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-",
      status: r.status || "-",
      value: Number(r.total_value || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PurchaseTracking");
    XLSX.writeFile(wb, "purchase-tracking.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Purchase Tracking", 10, y);
    y += 8;
    doc.setFontSize(10);
    const headers = [
      "Stage",
      "Reference",
      "Supplier",
      "Date",
      "Status",
      "Value",
    ];
    doc.text(headers[0], 10, y);
    doc.text(headers[1], 45, y);
    doc.text(headers[2], 90, y);
    doc.text(headers[3], 130, y);
    doc.text(headers[4], 160, y);
    doc.text(headers[5], 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    (Array.isArray(items) ? items : []).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const st = String(r.stage || "-");
      const ref = String(r.ref_no || "-");
      const sup = String(r.supplier_name || "-");
      const dt = r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-";
      const status = String(r.status || "-");
      const val = Number(r.total_value || 0).toFixed(2);
      doc.text(st.slice(0, 25), 10, y);
      doc.text(ref.slice(0, 30), 45, y);
      doc.text(sup.slice(0, 35), 90, y);
      doc.text(dt, 130, y);
      doc.text(status, 160, y);
      doc.text(val, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("purchase-tracking.pdf");
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
              Purchase Tracking
            </h1>
            <p className="text-sm mt-1">
              Overall tracking of purchase requests, orders, and bills
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
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
                  setFrom("");
                  setTo("");
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
                  <th>Stage</th>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td>{r.stage || "-"}</td>
                    <td className="font-medium">{r.ref_no || "-"}</td>
                    <td>{r.supplier_name || "-"}</td>
                    <td>
                      {r.txn_date
                        ? new Date(r.txn_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.status || "-"}</td>
                    <td className="text-right">
                      {Number(r.total_value || 0).toLocaleString()}
                    </td>
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
