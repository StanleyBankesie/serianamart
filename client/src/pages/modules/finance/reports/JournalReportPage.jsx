import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function JournalReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/journals", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load journals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/finance"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Journals
          </h1>
          <p className="text-sm mt-1">
            Journal entries for the selected period
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
                  XLSX.utils.book_append_sheet(wb, ws, "Journals");
                  XLSX.writeFile(wb, "journals.xlsx");
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
                  doc.text("Journals", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Voucher No", 45, y);
                  doc.text("Line", 95, y);
                  doc.text("Account", 115, y);
                  doc.text("Debit", 160, y);
                  doc.text("Credit", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.voucher_date
                      ? new Date(r.voucher_date).toLocaleDateString()
                      : "-";
                    const vn = String(r.voucher_no || "-");
                    const ln = String(r.line_no || "-");
                    const acct =
                      `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 30)}`.trim();
                    const dr = String(Number(r.debit || 0).toLocaleString());
                    const cr = String(Number(r.credit || 0).toLocaleString());
                    doc.text(dt, 10, y);
                    doc.text(vn, 45, y);
                    doc.text(ln, 95, y);
                    doc.text(acct, 115, y);
                    doc.text(dr, 160, y);
                    doc.text(cr, 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("journals.pdf");
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
                  <th>Voucher No</th>
                  <th>Line</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={`${r.id}-${idx}`}>
                    <td>{new Date(r.voucher_date).toLocaleDateString()}</td>
                    <td className="font-medium">{r.voucher_no}</td>
                    <td>{r.line_no}</td>
                    <td>
                      <div className="font-medium">{r.account_code}</div>
                      <div className="text-sm">{r.account_name}</div>
                    </td>
                    <td>{r.description || "-"}</td>
                    <td className="text-right">
                      {Number(r.debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.credit || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
