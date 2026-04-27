import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function CashFlowReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState("new");
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/cash-flow", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
      setTotals(res.data?.totals || { inflow: 0, outflow: 0, net: 0 });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load cash flow");
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
  }, [from, to, order]);

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
            Cash Flow
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Summary of cash movements in bank and cash accounts
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
                    const rows = Array.isArray(items) ? items : [];
                    if (!rows.length) return;
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "CashFlow");
                    XLSX.writeFile(wb, "cash-flow.xlsx");
                  }}
                  disabled={!items.length}
                >
                  Download Excel
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    const rows = Array.isArray(items) ? items : [];
                    if (!rows.length) return;
                    const doc = new jsPDF("p", "mm", "a4");
                    let y = 15;
                    doc.setFontSize(14);
                    doc.text("Cash Flow", 10, y);
                    y += 8;
                    doc.setFontSize(10);
                    doc.text("Bank", 10, y);
                    doc.text("Account", 70, y);
                    doc.text("Inflow", 130, y);
                    doc.text("Outflow", 160, y);
                    doc.text("Net", 190, y, { align: "right" });
                    y += 4;
                    doc.line(10, y, 200, y);
                    y += 5;
                    rows.forEach((r) => {
                      if (y > 270) {
                        doc.addPage();
                        y = 15;
                      }
                      const bank = String(r.bank_name || "-").slice(0, 40);
                      const acct = `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 30)}`.trim();
                      const inflow = String(Number(r.inflow || 0).toLocaleString());
                      const outflow = String(Number(r.outflow || 0).toLocaleString());
                      const net = String(Number(r.net || 0).toLocaleString());
                      doc.text(bank, 10, y);
                      doc.text(acct, 70, y);
                      doc.text(inflow, 130, y);
                      doc.text(outflow, 160, y);
                      doc.text(net, 190, y, { align: "right" });
                      y += 5;
                    });
                    y += 5;
                    doc.setFontSize(11);
                    doc.text(`Totals — Inflow: ${Number(totals.inflow || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Outflow: ${Number(totals.outflow || 0).toLocaleString()}`, 10, y);
                    y += 6;
                    doc.text(`Net: ${Number(totals.net || 0).toLocaleString()}`, 10, y);
                    doc.save("cash-flow.pdf");
                  }}
                  disabled={!items.length}
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
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inflow</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(totals.inflow || 0).toLocaleString()}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outflow</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {Number(totals.outflow || 0).toLocaleString()}
          </h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${totals.net >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Cash Flow</p>
          <h3 className={`text-2xl font-black mt-1 ${totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Number(totals.net || 0).toLocaleString()}
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
          <div className="flex-grow"></div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-500"
            title={order === "new" ? "Showing newest first" : "Showing oldest first"}
            onClick={() => setOrder(order === "new" ? "old" : "new")}
          >
            Sort: {order === "new" ? "Newest First 🔽" : "Oldest First 🔼"}
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank / Institution</th>
                  <th className="text-xs font-bold uppercase tracking-wider text-slate-500">Account Details</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider text-emerald-600">Inflow</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider text-rose-600">Outflow</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">Net Flow</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={`${r.bank_account_id}-${r.account_id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="font-bold text-slate-700 dark:text-slate-200 py-4">{r.bank_name}</td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.account_code}</div>
                      <div className="text-xs text-slate-500">{r.account_name}</div>
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-600">
                      {Number(r.inflow || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-mono font-bold text-rose-600">
                      {Number(r.outflow || 0).toLocaleString()}
                    </td>
                    <td className={`text-right font-mono font-black ${r.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {Number(r.net || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-900/40">
                <tr>
                  <td className="font-black text-slate-700 dark:text-slate-200">GRAND TOTALS</td>
                  <td />
                  <td className="text-right font-black text-emerald-700 dark:text-emerald-400 text-lg">
                    {Number(totals.inflow || 0).toLocaleString()}
                  </td>
                  <td className="text-right font-black text-rose-700 dark:text-rose-400 text-lg">
                    {Number(totals.outflow || 0).toLocaleString()}
                  </td>
                  <td className={`text-right font-black text-lg ${totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {Number(totals.net || 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {items.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-400 italic">
              No cash flow entries found for the selected period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
