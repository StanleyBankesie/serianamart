import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function DebtorsLedgerReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const debit = items.reduce((sum, r) => sum + Number(r.debit || 0), 0);
    const credit = items.reduce((sum, r) => sum + Number(r.credit || 0), 0);
    const balance = debit - credit;
    return { debit, credit, balance };
  }, [items]);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/debtors-ledger", {
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
            to="/finance"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Debtors Ledger
          </h1>
          <p className="text-sm mt-1">
            Customer ledger movements and running balance
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
                  XLSX.utils.book_append_sheet(wb, ws, "DebtorsLedger");
                  XLSX.writeFile(wb, "debtors-ledger.xlsx");
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
                  doc.text("Debtors Ledger", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Document", 45, y);
                  doc.text("Description", 95, y);
                  doc.text("Debit", 140, y);
                  doc.text("Credit", 165, y);
                  doc.text("Balance", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r, i) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.txn_date
                      ? new Date(r.txn_date).toLocaleDateString()
                      : "-";
                    const docno = String(r.doc_no || "-");
                    const desc = String(r.description || "-").slice(0, 35);
                    const dr = Number(r.debit || 0);
                    const cr = Number(r.credit || 0);
                    const running = rows
                      .slice(0, i + 1)
                      .reduce(
                        (sum, x) =>
                          sum + Number(x.debit || 0) - Number(x.credit || 0),
                        0,
                      );
                    doc.text(dt, 10, y);
                    doc.text(docno, 45, y);
                    doc.text(desc, 95, y);
                    doc.text(String(dr.toLocaleString()), 140, y);
                    doc.text(String(cr.toLocaleString()), 165, y);
                    doc.text(
                      String(Number(running || 0).toLocaleString()),
                      190,
                      y,
                      { align: "right" },
                    );
                    y += 5;
                  });
                  y += 5;
                  doc.setFontSize(11);
                  doc.text(
                    `Totals — Debit: ${Number(totals.debit || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Credit: ${Number(totals.credit || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Balance: ${Number(totals.balance || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  doc.save("debtors-ledger.pdf");
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
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => {
                  const running = items
                    .slice(0, idx + 1)
                    .reduce(
                      (sum, x) =>
                        sum + Number(x.debit || 0) - Number(x.credit || 0),
                      0,
                    );
                  return (
                    <tr key={r.id || idx}>
                      <td>
                        {r.txn_date
                          ? new Date(r.txn_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="font-medium">{r.doc_no || "-"}</td>
                      <td>{r.description || "-"}</td>
                      <td className="text-right">
                        {Number(r.debit || 0).toLocaleString()}
                      </td>
                      <td className="text-right">
                        {Number(r.credit || 0).toLocaleString()}
                      </td>
                      <td className="text-right">
                        {Number(running || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right font-medium">
                    Totals
                  </td>
                  <td className="text-right font-medium">
                    {totals.debit.toLocaleString()}
                  </td>
                  <td className="text-right font-medium">
                    {totals.credit.toLocaleString()}
                  </td>
                  <td className="text-right font-medium">
                    {totals.balance.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
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
