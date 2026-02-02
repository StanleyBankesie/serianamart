import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function CashFlowReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
            Cash Flow
          </h1>
          <p className="text-sm mt-1">Movements in bank and cash accounts</p>
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
                  XLSX.utils.book_append_sheet(wb, ws, "CashFlow");
                  XLSX.writeFile(wb, "cash-flow.xlsx");
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
                    const acct =
                      `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 30)}`.trim();
                    const inflow = String(
                      Number(r.inflow || 0).toLocaleString(),
                    );
                    const outflow = String(
                      Number(r.outflow || 0).toLocaleString(),
                    );
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
                  doc.text(
                    `Totals — Inflow: ${Number(totals.inflow || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Outflow: ${Number(totals.outflow || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 6;
                  doc.text(
                    `Net: ${Number(totals.net || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  doc.save("cash-flow.pdf");
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
                  <th>Bank</th>
                  <th>Account</th>
                  <th className="text-right">Inflow</th>
                  <th className="text-right">Outflow</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={`${r.bank_account_id}-${r.account_id}`}>
                    <td className="font-medium">{r.bank_name}</td>
                    <td>
                      <div className="font-medium">{r.account_code}</div>
                      <div className="text-sm">{r.account_name}</div>
                    </td>
                    <td className="text-right">
                      {Number(r.inflow || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.outflow || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.net || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-semibold">Totals</td>
                  <td />
                  <td className="text-right font-semibold">
                    {Number(totals.inflow || 0).toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {Number(totals.outflow || 0).toLocaleString()}
                  </td>
                  <td className="text-right font-semibold">
                    {Number(totals.net || 0).toLocaleString()}
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
