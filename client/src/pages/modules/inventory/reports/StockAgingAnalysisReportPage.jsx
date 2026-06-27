import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function StockAgingAnalysisReportPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/stock-aging-analysis", {
        params: { asOf: asOf || null },
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


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

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
            Stock Aging Analysis
          </h1>
          <p className="text-sm mt-1">Age buckets for inventory holding</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">As of Date</label>
              <input
                className="input"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
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
                  setAsOf("");
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
                  XLSX.utils.book_append_sheet(wb, ws, "StockAging");
                  XLSX.writeFile(wb, "stock-aging-analysis.xlsx");
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
                  doc.text("Stock Aging Analysis", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Item", 10, y);
                  doc.text("0-30", 95, y);
                  doc.text("31-60", 120, y);
                  doc.text("61-90", 145, y);
                  doc.text("90+", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    doc.text(String(r.item_name || r.item_code || "-").slice(0, 70), 10, y);
                    doc.text(String(Number(r.bucket_0_30 || 0).toLocaleString()), 95, y);
                    doc.text(String(Number(r.bucket_31_60 || 0).toLocaleString()), 120, y);
                    doc.text(String(Number(r.bucket_61_90 || 0).toLocaleString()), 145, y);
                    doc.text(String(Number(r.bucket_90_plus || 0).toLocaleString()), 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("stock-aging-analysis.pdf");
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
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="0–30" sortKey="030" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="31–60" sortKey="3160" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="61–90" sortKey="6190" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="90+" sortKey="90" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-medium">
                      {r.item_name || r.item_code}
                    </td>
                    <td className="text-right">
                      {Number(r.bucket_0_30 || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.bucket_31_60 || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.bucket_61_90 || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.bucket_90_plus || 0).toLocaleString()}
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
