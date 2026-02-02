import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function TrialBalanceReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/trial-balance", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = items.reduce(
    (acc, r) => {
      acc.opening_debit += Number(r.opening_debit || 0);
      acc.opening_credit += Number(r.opening_credit || 0);
      acc.movement_debit += Number(r.movement_debit || 0);
      acc.movement_credit += Number(r.movement_credit || 0);
      acc.closing_debit += Number(r.closing_debit || 0);
      acc.closing_credit += Number(r.closing_credit || 0);
      return acc;
    },
    {
      opening_debit: 0,
      opening_credit: 0,
      movement_debit: 0,
      movement_credit: 0,
      closing_debit: 0,
      closing_credit: 0,
    },
  );

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
            Trial Balance
          </h1>
          <p className="text-sm mt-1">Debits and credits by account</p>
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
                  XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
                  XLSX.writeFile(wb, "trial-balance.xlsx");
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
                  doc.text("Trial Balance", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Account", 10, y);
                  doc.text("Op Dr", 95, y);
                  doc.text("Op Cr", 115, y);
                  doc.text("Mv Dr", 135, y);
                  doc.text("Mv Cr", 155, y);
                  doc.text("Cls Dr", 175, y);
                  doc.text("Cls Cr", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const acct =
                      `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 40)}`.trim();
                    doc.text(acct, 10, y);
                    doc.text(
                      String(Number(r.opening_debit || 0).toLocaleString()),
                      95,
                      y,
                    );
                    doc.text(
                      String(Number(r.opening_credit || 0).toLocaleString()),
                      115,
                      y,
                    );
                    doc.text(
                      String(Number(r.movement_debit || 0).toLocaleString()),
                      135,
                      y,
                    );
                    doc.text(
                      String(Number(r.movement_credit || 0).toLocaleString()),
                      155,
                      y,
                    );
                    doc.text(
                      String(Number(r.closing_debit || 0).toLocaleString()),
                      175,
                      y,
                    );
                    doc.text(
                      String(Number(r.closing_credit || 0).toLocaleString()),
                      190,
                      y,
                      { align: "right" },
                    );
                    y += 5;
                  });
                  y += 5;
                  doc.setFontSize(11);
                  doc.text(
                    `Totals — Op Dr: ${totals.opening_debit.toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Op Cr: ${totals.opening_credit.toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Mv Dr: ${totals.movement_debit.toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Mv Cr: ${totals.movement_credit.toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Cls Dr: ${totals.closing_debit.toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Cls Cr: ${totals.closing_credit.toLocaleString()}`,
                    10,
                    y,
                  );
                  doc.save("trial-balance.pdf");
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
                  <th>Account</th>
                  <th className="text-right">Opening Dr</th>
                  <th className="text-right">Opening Cr</th>
                  <th className="text-right">Movement Dr</th>
                  <th className="text-right">Movement Cr</th>
                  <th className="text-right">Closing Dr</th>
                  <th className="text-right">Closing Cr</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.account_id}>
                    <td>
                      <div className="font-medium">{r.account_code}</div>
                      <div className="text-sm">{r.account_name}</div>
                    </td>
                    <td className="text-right">
                      {Number(r.opening_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.opening_credit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.movement_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.movement_credit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.closing_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.closing_credit || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-semibold">Totals</td>
                  <td className="text-right font-semibold">
                    {totals.opening_debit.toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {totals.opening_credit.toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {totals.movement_debit.toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {totals.movement_credit.toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {totals.closing_debit.toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {totals.closing_credit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
