import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function BalanceSheetReportPage() {
  const [to, setTo] = useState("");
  const [assets, setAssets] = useState({ items: [], total: 0 });
  const [liabilities, setLiabilities] = useState({ items: [], total: 0 });
  const [equity, setEquity] = useState({ items: [], total: 0 });
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/balance-sheet", {
        params: { to: to || null },
      });
      setAssets(res.data?.assets || { items: [], total: 0 });
      setLiabilities(res.data?.liabilities || { items: [], total: 0 });
      setEquity(res.data?.equity || { items: [], total: 0 });
      setBalance(Number(res.data?.balance || 0));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    setTo(today.toISOString().slice(0, 10));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  function Section({ title, data }) {
    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{title}</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
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
              <td className="font-semibold">Total {title}</td>
              <td className="text-right font-semibold">
                {Number(data.total || 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

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
            Balance Sheet
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Financial position statement as of a specific date
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
                      ...assets.items.map((r) => ({ section: "Assets", ...r })),
                      ...liabilities.items.map((r) => ({ section: "Liabilities", ...r })),
                      ...equity.items.map((r) => ({ section: "Equity", ...r })),
                    ];
                    if (!rows.length) return;
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet");
                    XLSX.writeFile(wb, "balance-sheet.xlsx");
                  }}
                  disabled={!assets.items.length && !liabilities.items.length && !equity.items.length}
                >
                  Download Excel
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    const rows = [
                      ...assets.items.map((r) => ({ section: "Assets", ...r })),
                      ...liabilities.items.map((r) => ({ section: "Liabilities", ...r })),
                      ...equity.items.map((r) => ({ section: "Equity", ...r })),
                    ];
                    if (!rows.length) return;
                    const doc = new jsPDF("p", "mm", "a4");
                    let y = 15;
                    doc.setFontSize(14);
                    doc.text("Balance Sheet", 10, y);
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
                    doc.text(`Total Assets: ${Number(assets.total || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Total Liabilities: ${Number(liabilities.total || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Total Equity: ${Number(equity.total || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Balance: ${Number(balance || 0).toLocaleString()}`, 10, y);
                    doc.save("balance-sheet.pdf");
                  }}
                  disabled={!assets.items.length && !liabilities.items.length && !equity.items.length}
                >
                  Download PDF
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Assets</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(assets.total || 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-orange-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Liabilities</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(liabilities.total || 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Equity</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(equity.total || 0).toLocaleString()}
          </h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${balance === 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Balance Status</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {balance === 0 ? "Balanced" : Number(balance || 0).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">As of Date:</span>
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
            onClick={() => setTo("")}
            disabled={loading}
          >
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <Section title="Assets" data={assets} />
            </div>
            <div className="space-y-10">
              <Section title="Liabilities" data={liabilities} />
              <Section title="Equity" data={equity} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
