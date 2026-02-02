import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function VoucherRegisterReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/voucher-register", {
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
            Voucher Register
          </h1>
          <p className="text-sm mt-1">
            Voucher listing report with date filters
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
                  XLSX.utils.book_append_sheet(wb, ws, "VoucherRegister");
                  XLSX.writeFile(wb, "voucher-register.xlsx");
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
                  doc.text("Voucher Register", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Voucher No", 45, y);
                  doc.text("Type", 95, y);
                  doc.text("Narration", 125, y);
                  doc.text("Debit", 160, y);
                  doc.text("Credit", 180, y);
                  doc.text("Status", 200, y, { align: "right" });
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
                    const no = String(r.voucher_no || "-");
                    const type = String(r.voucher_type_code || "-");
                    const narr = String(r.narration || "-").slice(0, 35);
                    const dr = String(
                      Number(r.total_debit || 0).toLocaleString(),
                    );
                    const cr = String(
                      Number(r.total_credit || 0).toLocaleString(),
                    );
                    const st = String(r.status || "-");
                    doc.text(dt, 10, y);
                    doc.text(no, 45, y);
                    doc.text(type, 95, y);
                    doc.text(narr, 125, y);
                    doc.text(dr, 160, y);
                    doc.text(cr, 180, y);
                    doc.text(st, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("voucher-register.pdf");
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
                  <th>Type</th>
                  <th>Narration</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.voucher_date).toLocaleDateString()}</td>
                    <td className="font-medium">{r.voucher_no}</td>
                    <td>{r.voucher_type_code}</td>
                    <td>{r.narration || "-"}</td>
                    <td className="text-right">
                      {Number(r.total_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.total_credit || 0).toLocaleString()}
                    </td>
                    <td>{r.status}</td>
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
