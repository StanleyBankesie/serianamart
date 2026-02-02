import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function GeneralLedgerReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [opening, setOpening] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      });
      setAccounts(res.data?.items || []);
      if (!accountId && res.data?.items?.[0]?.id) {
        setAccountId(String(res.data.items[0].id));
      }
    } catch {
      toast.error("Failed to load accounts");
    }
  }

  async function run() {
    if (!accountId) return;
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/general-ledger", {
        params: {
          accountId,
          from: from || null,
          to: to || null,
        },
      });
      setOpening(Number(res.data?.opening_balance || 0));
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load general ledger",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

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
            General Ledger
          </h1>
          <p className="text-sm mt-1">Ledger entries for a selected account</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="label">Account</label>
              <select
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
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
                  XLSX.utils.book_append_sheet(wb, ws, "GeneralLedger");
                  XLSX.writeFile(wb, "general-ledger.xlsx");
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
                  doc.text("General Ledger", 10, y);
                  y += 6;
                  doc.setFontSize(10);
                  doc.text(
                    `Opening: ${Number(opening || 0).toLocaleString()}`,
                    10,
                    y,
                  );
                  y += 8;
                  doc.text("Date", 10, y);
                  doc.text("Voucher No", 45, y);
                  doc.text("Line", 95, y);
                  doc.text("Description", 115, y);
                  doc.text("Debit", 160, y);
                  doc.text("Credit", 180, y);
                  doc.text("Balance", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.voucher_date
                      ? new Date(r.voucher_date).toLocaleDateString()
                      : "-";
                    const vn = String(r.voucher_no || "-");
                    const ln = String(r.line_no || "-");
                    const desc = String(r.description || "-").slice(0, 35);
                    const dr = String(Number(r.debit || 0).toLocaleString());
                    const cr = String(Number(r.credit || 0).toLocaleString());
                    const bal = String(Number(r.balance || 0).toLocaleString());
                    doc.text(dt, 10, y);
                    doc.text(vn, 45, y);
                    doc.text(ln, 95, y);
                    doc.text(desc, 115, y);
                    doc.text(dr, 160, y);
                    doc.text(cr, 180, y);
                    doc.text(bal, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("general-ledger.pdf");
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

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
            <div className="text-sm">Opening Balance</div>
            <div className="text-xl font-semibold">
              {Number(opening || 0).toLocaleString()}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Date</th>
                  <th>Voucher No</th>
                  <th>Line</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={`${r.voucher_no}-${r.line_no}-${idx}`}>
                    <td>{new Date(r.voucher_date).toLocaleDateString()}</td>
                    <td className="font-medium">{r.voucher_no}</td>
                    <td>{r.line_no}</td>
                    <td>{r.description || "-"}</td>
                    <td className="text-right">
                      {Number(r.debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.credit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.balance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
