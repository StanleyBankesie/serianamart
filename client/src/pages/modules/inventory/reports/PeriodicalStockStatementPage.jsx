import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function PeriodicalStockStatementPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get(
        "/inventory/reports/periodical-stock-statement",
        {
          params: { from: from || null, to: to || null },
        },
      );
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
            Periodical Stock Statement
          </h1>
          <p className="text-sm mt-1">
            Detailed stock movements within the period
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
                    "PeriodicalStockStatement",
                  );
                  XLSX.writeFile(wb, "periodical-stock-statement.xlsx");
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
                  doc.text("Periodical Stock Statement", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Document", 45, y);
                  doc.text("Item", 95, y);
                  doc.text("In", 140, y);
                  doc.text("Out", 165, y);
                  doc.text("Balance", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.txn_date
                      ? new Date(r.txn_date).toLocaleDateString()
                      : "-";
                    const docno = String(r.doc_no || "-");
                    const item = String(
                      r.item_name || r.item_code || "-",
                    ).slice(0, 40);
                    const inq = String(Number(r.qty_in || 0).toLocaleString());
                    const outq = String(
                      Number(r.qty_out || 0).toLocaleString(),
                    );
                    const bal = String(
                      Number(r.balance_qty || 0).toLocaleString(),
                    );
                    doc.text(dt, 10, y);
                    doc.text(docno, 45, y);
                    doc.text(item, 95, y);
                    doc.text(inq, 140, y);
                    doc.text(outq, 165, y);
                    doc.text(bal, 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("periodical-stock-statement.pdf");
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
                  <th>Document</th>
                  <th>Item</th>
                  <th className="text-right">In</th>
                  <th className="text-right">Out</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td>
                      {r.txn_date
                        ? new Date(r.txn_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.doc_no || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.qty_in || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.qty_out || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.balance_qty || 0).toLocaleString()}
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
