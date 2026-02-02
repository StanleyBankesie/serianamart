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
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            Balance Sheet
          </h1>
          <p className="text-sm mt-1">Position at selected date</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label">As Of</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
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
                onClick={() => setTo("")}
                disabled={loading}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = [
                    ...assets.items.map((r) => ({ section: "Assets", ...r })),
                    ...liabilities.items.map((r) => ({
                      section: "Liabilities",
                      ...r,
                    })),
                    ...equity.items.map((r) => ({ section: "Equity", ...r })),
                  ];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet");
                  XLSX.writeFile(wb, "balance-sheet.xlsx");
                }}
                disabled={
                  !assets.items.length &&
                  !liabilities.items.length &&
                  !equity.items.length
                }
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rows = [
                    ...assets.items.map((r) => ({ section: "Assets", ...r })),
                    ...liabilities.items.map((r) => ({
                      section: "Liabilities",
                      ...r,
                    })),
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
                    `Total Assets: ${Number(assets.total || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Total Liabilities: ${Number(liabilities.total || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Total Equity: ${Number(equity.total || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Balance: ${Number(balance || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  doc.save("balance-sheet.pdf");
                }}
                disabled={
                  !assets.items.length &&
                  !liabilities.items.length &&
                  !equity.items.length
                }
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
            <Section title="Assets" data={assets} />
            <div className="space-y-6">
              <Section title="Liabilities" data={liabilities} />
              <Section title="Equity" data={equity} />
            </div>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 mt-6">
            <div className="text-sm">Assets - (Liabilities + Equity)</div>
            <div className="text-xl font-semibold">
              {Number(balance || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
