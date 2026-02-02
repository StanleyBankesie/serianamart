import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function PeriodicalStockSummaryPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/periodical-stock-summary", {
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
            Periodical Stock Summary
          </h1>
          <p className="text-sm mt-1">
            Opening, receipts, issues, closing per period
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
                  XLSX.utils.book_append_sheet(
                    wb,
                    ws,
                    "PeriodicalStockSummary",
                  );
                  XLSX.writeFile(wb, "periodical-stock-summary.xlsx");
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
                  doc.text("Periodical Stock Summary", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Item", 10, y);
                  doc.text("Opening", 95, y);
                  doc.text("Receipts", 130, y);
                  doc.text("Issues", 160, y);
                  doc.text("Closing", 190, y, { align: "right" });
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
                      String(Number(r.opening_qty || 0).toLocaleString()),
                      95,
                      y,
                    );
                    doc.text(
                      String(Number(r.receipts_qty || 0).toLocaleString()),
                      130,
                      y,
                    );
                    doc.text(
                      String(Number(r.issues_qty || 0).toLocaleString()),
                      160,
                      y,
                    );
                    doc.text(
                      String(Number(r.closing_qty || 0).toLocaleString()),
                      190,
                      y,
                      { align: "right" },
                    );
                    y += 5;
                  });
                  doc.save("periodical-stock-summary.pdf");
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
                  <th className="text-right">Opening</th>
                  <th className="text-right">Receipts</th>
                  <th className="text-right">Issues</th>
                  <th className="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-medium">
                      {r.item_name || r.item_code}
                    </td>
                    <td className="text-right">
                      {Number(r.opening_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.receipts_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.issues_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.closing_qty || 0).toLocaleString()}
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
