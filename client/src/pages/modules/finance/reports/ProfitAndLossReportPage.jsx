import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function ProfitAndLossReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [income, setIncome] = useState({ items: [], total: 0 });
  const [expenses, setExpenses] = useState({ items: [], total: 0 });
  const [net, setNet] = useState(0);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/profit-and-loss", {
        params: { from: from || null, to: to || null },
      });
      setIncome(res.data?.income || { items: [], total: 0 });
      setExpenses(res.data?.expenses || { items: [], total: 0 });
      setNet(Number(res.data?.net_profit || 0));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load P&L");
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
            Profit and Loss
          </h1>
          <p className="text-sm mt-1">Income and expense summary</p>
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
                  const rows = [
                    ...income.items.map((r) => ({ section: "Income", ...r })),
                    ...expenses.items.map((r) => ({
                      section: "Expenses",
                      ...r,
                    })),
                  ];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "ProfitAndLoss");
                  XLSX.writeFile(wb, "profit-and-loss.xlsx");
                }}
                disabled={!income.items.length && !expenses.items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rows = [
                    ...income.items.map((r) => ({ section: "Income", ...r })),
                    ...expenses.items.map((r) => ({
                      section: "Expenses",
                      ...r,
                    })),
                  ];
                  if (!rows.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Profit and Loss", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Section", 10, y);
                  doc.text("Account", 60, y);
                  doc.text("Amount", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const section = String(r.section);
                    const acct =
                      `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 40)}`.trim();
                    const amt = String(Number(r.amount || 0).toLocaleString());
                    doc.text(section, 10, y);
                    doc.text(acct, 60, y);
                    doc.text(amt, 190, y, { align: "right" });
                    y += 5;
                  });
                  y += 5;
                  doc.setFontSize(11);
                  doc.text(
                    `Total Income: ${Number(income.total || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Total Expenses: ${Number(expenses.total || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Net Profit: ${Number(net || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  doc.save("profit-and-loss.pdf");
                }}
                disabled={!income.items.length && !expenses.items.length}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>Income</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {income.items.map((r) => (
                    <tr key={r.account_id}>
                      <td>
                        <div className="font-medium">{r.account_code}</div>
                        <div className="text-sm">{r.account_name}</div>
                      </td>
                      <td className="text-right">
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-semibold">Total Income</td>
                    <td className="text-right font-semibold">
                      {Number(income.total || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>Expenses</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.items.map((r) => (
                    <tr key={r.account_id}>
                      <td>
                        <div className="font-medium">{r.account_code}</div>
                        <div className="text-sm">{r.account_name}</div>
                      </td>
                      <td className="text-right">
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-semibold">Total Expenses</td>
                    <td className="text-right font-semibold">
                      {Number(expenses.total || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 mt-6">
            <div className="text-sm">Net Profit</div>
            <div className="text-xl font-semibold">
              {Number(net || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
