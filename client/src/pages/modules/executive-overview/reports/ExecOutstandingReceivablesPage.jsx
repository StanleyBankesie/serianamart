import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExecOutstandingReceivablesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const totalOutstanding = items.reduce((s, r) => s + Number(r.outstanding || 0), 0);
  const totalOverdue = items.filter(r => r.status === "OVERDUE").reduce((s, r) => s + Number(r.outstanding || 0), 0);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/outstanding-receivable", {
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
    const today = new Date();
    const jan1 = new Date(today.getFullYear(), 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
  }, []);

  useEffect(() => { run(); }, [from, to]); // eslint-disable-line

  function exportExcel() {
    const data = items.map(r => ({
      "Due Date": r.due_date ? new Date(r.due_date).toLocaleDateString() : "—",
      Reference: r.ref_no || "—",
      Party: r.party_name || "—",
      Amount: Number(r.amount || 0),
      Outstanding: Number(r.outstanding || 0),
      Status: r.status || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Receivables");
    XLSX.writeFile(wb, "outstanding-receivables.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    const m = 14, w = 210; let y = m;
    doc.setFillColor(4, 120, 87); doc.rect(0, 0, w, 26, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("OUTSTANDING RECEIVABLES", w / 2, 11, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${from} to ${to}  |  Total: ₵${fmt(totalOutstanding)}`, w / 2, 20, { align: "center" });
    y = 32; doc.setTextColor(15, 23, 42);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Due Date", m, y); doc.text("Reference", m + 25, y); doc.text("Party", m + 50, y);
    doc.text("Amount", m + 130, y); doc.text("Outstanding", m + 157, y); doc.text("Status", w - m, y, { align: "right" });
    y += 4; doc.line(m, y, w - m, y); y += 3;
    doc.setFont("helvetica", "normal");
    items.forEach(r => {
      if (y > 270) { doc.addPage(); y = m; }
      doc.text(r.due_date ? new Date(r.due_date).toLocaleDateString() : "—", m, y);
      doc.text(String(r.ref_no || "—").slice(0, 18), m + 25, y);
      doc.text(String(r.party_name || "—").slice(0, 38), m + 50, y);
      doc.text(fmt(r.amount), m + 130, y); doc.text(fmt(r.outstanding), m + 157, y);
      doc.text(String(r.status || "—"), w - m, y, { align: "right" });
      y += 5;
    });
    doc.save("outstanding-receivables.pdf");
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <Link to="/executive-overview" className="text-xs font-bold text-brand uppercase tracking-wider">← Back to Executive Overview</Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">Outstanding Receivables</h1>
          <p className="text-slate-500 text-sm mt-1">Customer payments due and overdue</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={!items.length}>📊 Excel</button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF} disabled={!items.length}>📄 PDF</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(totalOutstanding)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">₵{fmt(totalOverdue)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{items.length}</h3>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input className="input input-bordered input-sm" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input className="input input-bordered input-sm" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-sm">
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="py-3 text-xs uppercase">Due Date</th>
                <th className="py-3 text-xs uppercase">Reference</th>
                <th className="py-3 text-xs uppercase">Party</th>
                <th className="text-right py-3 text-xs uppercase">Amount</th>
                <th className="text-right py-3 text-xs uppercase">Outstanding</th>
                <th className="py-3 text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No records found</td></tr>}
              {items.map((r, i) => (
                <tr key={i} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 ${r.status === "OVERDUE" ? "bg-rose-50/30 dark:bg-rose-900/10" : ""}`}>
                  <td className="text-xs text-slate-500">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</td>
                  <td className="font-mono text-xs text-brand">{r.ref_no || "—"}</td>
                  <td className="font-medium text-slate-700 dark:text-slate-200">{r.party_name || "—"}</td>
                  <td className="text-right font-mono">₵{fmt(r.amount)}</td>
                  <td className="text-right font-black font-mono text-slate-900 dark:text-slate-100">₵{fmt(r.outstanding)}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "OVERDUE" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{r.status || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
