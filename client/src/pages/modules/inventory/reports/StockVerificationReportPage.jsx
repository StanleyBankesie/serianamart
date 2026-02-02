import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function StockVerificationReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/stock-verification", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
            Stock Verification Report
          </h1>
          <p className="text-sm mt-1">
            Variances identified during stock verification
          </p>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "StockVerification");
                  XLSX.writeFile(wb, "stock-verification.xlsx");
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
                  doc.text("Stock Verification Report", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Verify No", 45, y);
                  doc.text("Item", 85, y);
                  doc.text("System Qty", 130, y);
                  doc.text("Physical Qty", 160, y);
                  doc.text("Variance", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.verify_date
                      ? new Date(r.verify_date).toLocaleDateString()
                      : "-";
                    const vno = String(r.verify_no || "-");
                    const it = String(r.item_name || r.item_code || "-").slice(
                      0,
                      40,
                    );
                    const sys = String(
                      Number(r.system_qty || 0).toLocaleString(),
                    );
                    const phy = String(
                      Number(r.physical_qty || 0).toLocaleString(),
                    );
                    const varq = String(
                      Number(
                        (r.physical_qty || 0) - (r.system_qty || 0),
                      ).toLocaleString(),
                    );
                    doc.text(dt, 10, y);
                    doc.text(vno, 45, y);
                    doc.text(it, 85, y);
                    doc.text(sys, 130, y);
                    doc.text(phy, 160, y);
                    doc.text(varq, 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("stock-verification.pdf");
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
                  <th>Date</th>
                  <th>Verification No</th>
                  <th>Item</th>
                  <th className="text-right">System Qty</th>
                  <th className="text-right">Physical Qty</th>
                  <th className="text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.verify_date
                        ? new Date(r.verify_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.verify_no || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.system_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.physical_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(
                        (r.physical_qty || 0) - (r.system_qty || 0),
                      ).toLocaleString()}
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
