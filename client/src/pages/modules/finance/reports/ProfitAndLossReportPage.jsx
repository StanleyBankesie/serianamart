import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProfitAndLossReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [income, setIncome] = useState({ items: [], total: 0 });
  const [expenses, setExpenses] = useState({ items: [], total: 0 });
  const [net, setNet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState(5);

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
    const jan1 = new Date(today.getFullYear(), 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Flatten tree for export purposes
  function flattenTree(nodes, maxLevel = 99, rows = [], section = "") {
    if (!nodes || !Array.isArray(nodes)) return rows;
    for (const node of nodes) {
      if (node.level > maxLevel) continue;
      if (node.type === "group") {
        rows.push({
          Section: section,
          Type: "Group",
          Level: node.level,
          Code: node.code || "",
          Name: node.name,
          Amount: Number(node.amount || 0),
        });
        flattenTree(node.children, maxLevel, rows, section);
        flattenTree(node.accounts, maxLevel, rows, section);
      } else {
        rows.push({
          Section: section,
          Type: "Account",
          Level: node.level,
          Code: node.account_code || "",
          Name: node.account_name || "",
          Amount: Number(node.amount || 0),
        });
      }
    }
    return rows;
  }

  function exportExcel() {
    const incomeRows = flattenTree(income.items, 99, [], "Income");
    const expenseRows = flattenTree(expenses.items, 99, [], "Expenses");
    const all = [
      ...incomeRows,
      { Section: "", Type: "SUBTOTAL", Level: 0, Code: "", Name: "Total Income", Amount: income.total },
      { Section: "", Type: "", Level: 0, Code: "", Name: "", Amount: "" },
      ...expenseRows,
      { Section: "", Type: "SUBTOTAL", Level: 0, Code: "", Name: "Total Expenses", Amount: expenses.total },
      { Section: "", Type: "", Level: 0, Code: "", Name: "", Amount: "" },
      { Section: "", Type: "NET", Level: 0, Code: "", Name: net >= 0 ? "NET PROFIT" : "NET LOSS", Amount: net },
    ];
    if (!all.length) return;
    const ws = XLSX.utils.json_to_sheet(all);
    ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 45 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProfitAndLoss");
    XLSX.writeFile(wb, `profit-and-loss-${from || "all"}-to-${to || "today"}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const margin = 14;
    let y = margin;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PROFIT AND LOSS STATEMENT", pageW / 2, 11, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${from || "Beginning"} to ${to || "Today"}`, pageW / 2, 20, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, 25, { align: "center" });
    y = 36;

    doc.setTextColor(30, 41, 59);

    function renderSection(title, nodes, sectionTotal, color) {
      // Section header
      doc.setFillColor(...color);
      doc.rect(margin, y, pageW - margin * 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin + 2, y + 5);
      y += 9;
      doc.setTextColor(30, 41, 59);

      function renderNodes(nodes) {
        if (!nodes || !Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (y > 268) { doc.addPage(); y = margin; }
          const indent = margin + (node.level - 1) * 4;
          if (node.type === "group") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            doc.text(`${node.name}`, indent, y);
            doc.text(fmt(node.amount), pageW - margin, y, { align: "right" });
            y += 5;
            renderNodes(node.children);
            renderNodes(node.accounts);
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const label = `${node.account_code}  ${node.account_name}`;
            doc.text(label.slice(0, 65), indent + 2, y);
            doc.text(fmt(node.amount), pageW - margin, y, { align: "right" });
            y += 4.5;
          }
        }
      }
      renderNodes(nodes);

      // Subtotal bar
      if (y > 268) { doc.addPage(); y = margin; }
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...color);
      doc.text(`Total ${title}`, margin + 2, y + 4.5);
      doc.text(fmt(sectionTotal), pageW - margin, y + 4.5, { align: "right" });
      y += 10;
    }

    renderSection("Income", income.items, income.total, [4, 120, 87]);
    y += 4;
    renderSection("Expenses", expenses.items, expenses.total, [220, 38, 38]);

    // Net profit/loss
    if (y > 262) { doc.addPage(); y = margin; }
    y += 2;
    const netColor = net >= 0 ? [4, 120, 87] : [220, 38, 38];
    doc.setFillColor(...netColor);
    doc.rect(margin, y, pageW - margin * 2, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(net >= 0 ? "NET PROFIT" : "NET LOSS", margin + 3, y + 6.5);
    doc.text(fmt(net), pageW - margin, y + 6.5, { align: "right" });

    doc.save(`profit-and-loss-${from || "all"}-to-${to || "today"}.pdf`);
  }

  // Recursive renderer
  const renderNodes = (nodes, maxLevel) => {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.map((node) => {
      if (node.level > maxLevel) return null;
      const isGroup = node.type === "group";
      const key = isGroup ? `g-${node.id}` : `a-${node.account_id}`;
      const pl = (node.level - 1) * 18;

      return (
        <React.Fragment key={key}>
          <tr className={`${isGroup
            ? "bg-slate-100/70 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-600"
            : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
          } transition-colors`}>
            <td className="py-2" style={{ paddingLeft: `${pl + 12}px` }}>
              {isGroup ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">📁</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider">
                    {node.name}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-mono text-xs text-brand mr-2">{node.account_code}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{node.account_name}</span>
                </div>
              )}
            </td>
            <td className={`text-right font-mono text-sm pr-3 ${isGroup ? "font-bold text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
              {fmt(node.amount)}
            </td>
          </tr>
          {isGroup && node.children && renderNodes(node.children, maxLevel)}
          {isGroup && node.accounts && renderNodes(node.accounts, maxLevel)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <Link to="/finance" className="text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors">
            ← Back to Finance
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Profit & Loss
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Statement of income and expenditure for a specific period
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            🖨️ Print
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportExcel}
            disabled={!income.items.length && !expenses.items.length}>
            📊 Excel
          </button>
          <button type="button" className="btn btn-primary btn-sm shadow-sm" onClick={exportPDF}
            disabled={!income.items.length && !expenses.items.length}>
            📄 PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Income</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(income.total)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-rose-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(expenses.total)}</h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${net >= 0 ? "border-emerald-500" : "border-rose-500"}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net {net >= 0 ? "Profit" : "Loss"}</p>
          <h3 className={`text-2xl font-black mt-1 ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>₵{fmt(net)}</h3>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input className="input input-bordered input-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input className="input input-bordered input-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-4 border-l pl-4 border-slate-200 dark:border-slate-700">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Level:</span>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="5" step="1" value={level}
                onChange={(e) => setLevel(parseInt(e.target.value))}
                className="range range-xs range-primary w-32" />
              <span className="bg-brand text-white text-xs font-black px-2 py-1 rounded shadow-sm min-w-[1.75rem] text-center">{level}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm text-brand font-bold"
            onClick={() => { setFrom(""); setTo(""); }} disabled={loading}>
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Income Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="table w-full text-sm">
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="font-bold uppercase tracking-wider text-xs py-3">Income Accounts</th>
                    <th className="text-right font-bold uppercase tracking-wider text-xs py-3 pr-3">Amount (₵)</th>
                  </tr>
                </thead>
                <tbody>
                  {income.items.length === 0 && !loading && (
                    <tr><td colSpan={2} className="text-center py-8 text-slate-400">No income records</td></tr>
                  )}
                  {renderNodes(income.items, level)}
                </tbody>
                <tfoot className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-300">
                  <tr>
                    <td className="font-black text-emerald-700 dark:text-emerald-400 py-3">Total Income</td>
                    <td className="text-right font-black text-emerald-700 dark:text-emerald-400 pr-3">₵{fmt(income.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Expense Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="table w-full text-sm">
                <thead className="bg-rose-600 text-white">
                  <tr>
                    <th className="font-bold uppercase tracking-wider text-xs py-3">Expense Accounts</th>
                    <th className="text-right font-bold uppercase tracking-wider text-xs py-3 pr-3">Amount (₵)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.items.length === 0 && !loading && (
                    <tr><td colSpan={2} className="text-center py-8 text-slate-400">No expense records</td></tr>
                  )}
                  {renderNodes(expenses.items, level)}
                </tbody>
                <tfoot className="bg-rose-50 dark:bg-rose-900/20 border-t-2 border-rose-300">
                  <tr>
                    <td className="font-black text-rose-700 dark:text-rose-400 py-3">Total Expenses</td>
                    <td className="text-right font-black text-rose-700 dark:text-rose-400 pr-3">₵{fmt(expenses.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Profit Banner */}
          <div className={`mt-6 p-4 rounded-xl text-center ${net >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700" : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{net >= 0 ? "Net Profit" : "Net Loss"} for Period</p>
            <p className={`text-3xl font-black mt-1 ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>₵{fmt(net)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
