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
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="space-y-6 p-4">
      {/* Modern Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <Link
            to="/finance"
            className="text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors"
          >
            ← Back to Finance
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Profit and Loss
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Statement of income and expenditure for a specific period
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => window.print()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 012-2H5a2 2 0 012 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-primary btn-sm shadow-sm">
              Export
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </label>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-base-100 rounded-box w-52 border border-slate-200 mt-2">
              <li>
                <button
                  onClick={() => {
                    const rows = [
                      ...income.items.map((r) => ({ section: "Income", ...r })),
                      ...expenses.items.map((r) => ({ section: "Expenses", ...r })),
                    ];
                    if (!rows.length) return;
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "ProfitAndLoss");
                    XLSX.writeFile(wb, "profit-and-loss.xlsx");
                  }}
                  disabled={!income.items.length && !expenses.items.length}
                >
                  Download Excel
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    const rows = [
                      ...income.items.map((r) => ({ section: "Income", ...r })),
                      ...expenses.items.map((r) => ({ section: "Expenses", ...r })),
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
                      const acct = `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 40)}`.trim();
                      const amt = String(Number(r.amount || 0).toLocaleString());
                      doc.text(section, 10, y);
                      doc.text(acct, 60, y);
                      doc.text(amt, 190, y, { align: "right" });
                      y += 5;
                    });
                    y += 5;
                    doc.setFontSize(11);
                    doc.text(`Total Income: ${Number(income.total || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Total Expenses: ${Number(expenses.total || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Net Profit: ${Number(net || 0).toLocaleString()}`, 10, y);
                    doc.save("profit-and-loss.pdf");
                  }}
                  disabled={!income.items.length && !expenses.items.length}
                >
                  Download PDF
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Income</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(income.total || 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(expenses.total || 0).toLocaleString()}
          </h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${net >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net {net >= 0 ? 'Profit' : 'Loss'}</p>
          <h3 className={`text-2xl font-black mt-1 ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Number(net || 0).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input
              className="input input-bordered input-sm focus:ring-brand focus:border-brand"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input
              className="input input-bordered input-sm focus:ring-brand focus:border-brand"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-brand font-bold"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            disabled={loading}
          >
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="text-xs font-bold uppercase tracking-wider text-slate-500">Income Accounts</th>
                    <th className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {income.items.map((r) => (
                    <tr key={r.account_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">{r.account_code}</div>
                        <div className="text-xs text-slate-500">{r.account_name}</div>
                      </td>
                      <td className="text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 dark:bg-emerald-900/20">
                  <tr>
                    <td className="font-black text-emerald-700 dark:text-emerald-400">Total Income</td>
                    <td className="text-right font-black text-emerald-700 dark:text-emerald-400">
                      {Number(income.total || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="text-xs font-bold uppercase tracking-wider text-slate-500">Expense Accounts</th>
                    <th className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.items.map((r) => (
                    <tr key={r.account_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">{r.account_code}</div>
                        <div className="text-xs text-slate-500">{r.account_name}</div>
                      </td>
                      <td className="text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-rose-50 dark:bg-rose-900/20">
                  <tr>
                    <td className="font-black text-rose-700 dark:text-rose-400">Total Expenses</td>
                    <td className="text-right font-black text-rose-700 dark:text-rose-400">
                      {Number(expenses.total || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
