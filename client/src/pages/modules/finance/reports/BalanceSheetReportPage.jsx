import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BalanceSheetReportPage() {
  const [to, setTo] = useState("");
  const [assets, setAssets] = useState({ items: [], total: 0 });
  const [liabilities, setLiabilities] = useState({ items: [], total: 0 });
  const [equity, setEquity] = useState({ items: [], total: 0 });
  const [balance, setBalance] = useState(0);
  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState(5);

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
      setAsOfDate(res.data?.as_of_date || to || new Date().toISOString().slice(0, 10));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    setTo(today.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  // Flatten tree for export
  function flattenTree(nodes, section, rows = []) {
    if (!nodes || !Array.isArray(nodes)) return rows;
    for (const node of nodes) {
      if (node.type === "group") {
        rows.push({ Section: section, Type: "Group", Level: node.level, Code: node.code || "", Name: node.name, Amount: Number(node.amount || 0) });
        flattenTree(node.children, section, rows);
        flattenTree(node.accounts, section, rows);
      } else {
        rows.push({ Section: section, Type: "Account", Level: node.level, Code: node.account_code || "", Name: node.account_name || "", Amount: Number(node.amount || 0) });
      }
    }
    return rows;
  }

  function exportExcel() {
    const assetRows = flattenTree(assets.items, "Assets");
    const liabRows = flattenTree(liabilities.items, "Liabilities");
    const eqRows = flattenTree(equity.items, "Equity");
    const blank = { Section: "", Type: "", Level: "", Code: "", Name: "", Amount: "" };
    const all = [
      ...assetRows,
      { ...blank, Type: "SUBTOTAL", Name: "Total Assets", Amount: assets.total },
      blank,
      ...liabRows,
      { ...blank, Type: "SUBTOTAL", Name: "Total Liabilities", Amount: liabilities.total },
      blank,
      ...eqRows,
      { ...blank, Type: "SUBTOTAL", Name: "Total Equity", Amount: equity.total },
      blank,
      { ...blank, Type: "NET", Name: "Balance (Assets – Liab – Equity)", Amount: balance },
    ];
    const ws = XLSX.utils.json_to_sheet(all);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 45 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet");
    XLSX.writeFile(wb, `balance-sheet-as-of-${asOfDate || to}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const margin = 14;
    let y = margin;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BALANCE SHEET", pageW / 2, 12, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`As at: ${asOfDate || to}`, pageW / 2, 21, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, 27, { align: "center" });
    y = 38;
    doc.setTextColor(15, 23, 42);

    function renderSection(title, nodes, sectionTotal, color) {
      if (y > 265) { doc.addPage(); y = margin; }
      doc.setFillColor(...color);
      doc.rect(margin, y, pageW - margin * 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin + 2, y + 5);
      y += 9;
      doc.setTextColor(15, 23, 42);

      function renderNodes(nodes) {
        if (!nodes || !Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (y > 268) { doc.addPage(); y = margin; }
          const indent = margin + (node.level - 1) * 4;
          if (node.type === "group") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(30, 58, 138);
            doc.text(node.name, indent, y);
            doc.text(fmt(node.amount), pageW - margin, y, { align: "right" });
            y += 5;
            renderNodes(node.children);
            renderNodes(node.accounts);
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text(`${node.account_code}  ${(node.account_name || "").slice(0, 60)}`, indent + 3, y);
            doc.text(fmt(node.amount), pageW - margin, y, { align: "right" });
            y += 4.5;
          }
        }
      }
      renderNodes(nodes);

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

    renderSection("Assets", assets.items, assets.total, [29, 78, 216]);
    y += 3;
    renderSection("Liabilities", liabilities.items, liabilities.total, [220, 38, 38]);
    y += 3;
    renderSection("Equity", equity.items, equity.total, [16, 185, 129]);

    // Balance check
    if (y > 262) { doc.addPage(); y = margin; }
    y += 3;
    const balanced = Math.abs(balance) < 0.01;
    doc.setFillColor(balanced ? 4 : 220, balanced ? 120 : 38, balanced ? 87 : 38);
    doc.rect(margin, y, pageW - margin * 2, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(balanced ? "✓ BALANCED" : "Balance Check", margin + 3, y + 6.5);
    doc.text(balanced ? "Assets = Liabilities + Equity" : fmt(balance), pageW - margin, y + 6.5, { align: "right" });

    doc.save(`balance-sheet-as-of-${asOfDate || to}.pdf`);
  }

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
            ? "bg-blue-50/60 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30"
            : "hover:bg-slate-50 dark:hover:bg-slate-700/20"
          } transition-colors`}>
            <td className="py-2" style={{ paddingLeft: `${pl + 12}px` }}>
              {isGroup ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">📁</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wider">{node.name}</span>
                </div>
              ) : (
                <div>
                  <span className="font-mono text-xs text-brand mr-2">{node.account_code}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{node.account_name}</span>
                </div>
              )}
            </td>
            <td className={`text-right font-mono text-sm pr-3 ${isGroup ? "font-bold text-blue-800 dark:text-blue-200" : "text-slate-700 dark:text-slate-300"}`}>
              ₵{fmt(node.amount)}
            </td>
          </tr>
          {isGroup && node.children && renderNodes(node.children, maxLevel)}
          {isGroup && node.accounts && renderNodes(node.accounts, maxLevel)}
        </React.Fragment>
      );
    });
  };

  const balanced = Math.abs(balance) < 0.01;
  const totalLiabEquity = liabilities.total + equity.total;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <Link to="/finance" className="text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors">
            ← Back to Finance
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Balance Sheet
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Financial position statement as at {asOfDate || to}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            🖨️ Print
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportExcel}
            disabled={!assets.items.length && !liabilities.items.length && !equity.items.length}>
            📊 Excel
          </button>
          <button type="button" className="btn btn-primary btn-sm shadow-sm" onClick={exportPDF}
            disabled={!assets.items.length && !liabilities.items.length && !equity.items.length}>
            📄 PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Assets</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(assets.total)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-orange-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Liabilities</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(liabilities.total)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 border-y border-r border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Equity</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">₵{fmt(equity.total)}</h3>
        </div>
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-l-4 border-y border-r border-slate-200 dark:border-slate-700 ${balanced ? "border-emerald-500" : "border-rose-500"}`}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Balance Status</p>
          <h3 className={`text-xl font-black mt-1 ${balanced ? "text-emerald-600" : "text-rose-600"}`}>
            {balanced ? "✓ Balanced" : `Off by ₵${fmt(Math.abs(balance))}`}
          </h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">As of Date:</span>
            <input className="input input-bordered input-sm" type="date" value={to}
              onChange={(e) => setTo(e.target.value)} />
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
            onClick={() => setTo("")} disabled={loading}>
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-4">
          {/* Two-column layout: Assets | Liabilities + Equity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ASSETS */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="table w-full text-sm">
                <thead className="bg-blue-700 text-white">
                  <tr>
                    <th className="font-bold uppercase tracking-wider text-xs py-3">Assets</th>
                    <th className="text-right font-bold uppercase tracking-wider text-xs py-3 pr-3">Amount (₵)</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.items.length === 0 && !loading && (
                    <tr><td colSpan={2} className="text-center py-8 text-slate-400">No asset records</td></tr>
                  )}
                  {renderNodes(assets.items, level)}
                </tbody>
                <tfoot className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-300">
                  <tr>
                    <td className="font-black text-blue-700 dark:text-blue-300 py-3">Total Assets</td>
                    <td className="text-right font-black text-blue-700 dark:text-blue-300 pr-3">₵{fmt(assets.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* LIABILITIES + EQUITY */}
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="table w-full text-sm">
                  <thead className="bg-orange-600 text-white">
                    <tr>
                      <th className="font-bold uppercase tracking-wider text-xs py-3">Liabilities</th>
                      <th className="text-right font-bold uppercase tracking-wider text-xs py-3 pr-3">Amount (₵)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liabilities.items.length === 0 && !loading && (
                      <tr><td colSpan={2} className="text-center py-6 text-slate-400">No liability records</td></tr>
                    )}
                    {renderNodes(liabilities.items, level)}
                  </tbody>
                  <tfoot className="bg-orange-50 dark:bg-orange-900/20 border-t-2 border-orange-300">
                    <tr>
                      <td className="font-black text-orange-700 dark:text-orange-300 py-3">Total Liabilities</td>
                      <td className="text-right font-black text-orange-700 dark:text-orange-300 pr-3">₵{fmt(liabilities.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="table w-full text-sm">
                  <thead className="bg-emerald-700 text-white">
                    <tr>
                      <th className="font-bold uppercase tracking-wider text-xs py-3">Equity</th>
                      <th className="text-right font-bold uppercase tracking-wider text-xs py-3 pr-3">Amount (₵)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equity.items.length === 0 && !loading && (
                      <tr><td colSpan={2} className="text-center py-6 text-slate-400">No equity records</td></tr>
                    )}
                    {renderNodes(equity.items, level)}
                  </tbody>
                  <tfoot className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-300">
                    <tr>
                      <td className="font-black text-emerald-700 dark:text-emerald-300 py-3">Total Equity</td>
                      <td className="text-right font-black text-emerald-700 dark:text-emerald-300 pr-3">₵{fmt(equity.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Liabilities + Equity Subtotal */}
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4 flex justify-between items-center">
                <span className="font-bold text-slate-700 dark:text-slate-200">Total Liabilities + Equity</span>
                <span className="font-black text-slate-900 dark:text-slate-100 font-mono">₵{fmt(totalLiabEquity)}</span>
              </div>
            </div>
          </div>

          {/* Balance Check Banner */}
          <div className={`mt-6 p-4 rounded-xl text-center border-2 ${balanced
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
            : "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700"}`}>
            <p className={`text-sm font-bold ${balanced ? "text-emerald-700" : "text-rose-700"}`}>
              {balanced
                ? "✓ Balance Sheet is Balanced — Assets equal Liabilities + Equity"
                : `⚠ Out of Balance by ₵${fmt(Math.abs(balance))} — Please review your accounts`}
            </p>
            <div className="mt-2 flex justify-center gap-8 text-xs text-slate-600 dark:text-slate-400">
              <span>Assets: <strong>₵{fmt(assets.total)}</strong></span>
              <span>=</span>
              <span>Liabilities + Equity: <strong>₵{fmt(totalLiabEquity)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
