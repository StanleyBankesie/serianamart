import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { filterAndSort } from "../../../../utils/searchUtils.js";

export default function CustomerOutstandingReportPage() {
  const [asOf, setAsOf] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [accountQuery, setAccountQuery] = useState("");

  // Load debtors accounts (ASSET group nature)
  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { active: 1 },
      });
      const allAccounts = res.data?.items || [];
      setAccounts(allAccounts);
    } catch {
      toast.error("Failed to load accounts");
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    // Filter for asset nature accounts (debtors)
    const debtorsAccounts = accounts.filter(
      (a) => String(a.nature || a.group_nature || "").toUpperCase() === "ASSET"
    );
    return filterAndSort(debtorsAccounts, {
      query: accountQuery,
      getKeys: (a) => [a.code, a.name],
    });
  }, [accounts, accountQuery]);

  async function run() {
    try {
      setLoading(true);
      const params = { asOf: asOf || null };
      if (accountId) params.accountId = accountId;
      const res = await api.get("/finance/reports/customer-outstanding", { params });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    setAsOf(today.toISOString().slice(0, 10));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf, accountId]);

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
            Customer Outstanding Report
          </h1>
          <p className="text-sm mt-1">
            Receivables outstanding per customer as of a date
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="label">Account (Debtors)</label>
              <input
                className="input mb-2"
                placeholder="Search account code/name..."
                value={accountQuery}
                onChange={(e) => setAccountQuery(e.target.value)}
              />
              <select
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">All Debtors</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">As of Date</label>
              <input
                className="input"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setAsOf("");
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
                  XLSX.utils.book_append_sheet(wb, ws, "CustomerOutstanding");
                  XLSX.writeFile(wb, "customer-outstanding.xlsx");
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
                  doc.text("Customer Outstanding Report", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Customer", 10, y);
                  doc.text("Invoice No", 75, y);
                  doc.text("Inv Date", 115, y);
                  doc.text("Due Date", 145, y);
                  doc.text("Amount", 165, y);
                  doc.text("Received", 180, y);
                  doc.text("Outstanding", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const cust = String(r.customer_name || "-").slice(0, 60);
                    const inv = String(r.invoice_no || "-");
                    const invd = r.invoice_date
                      ? new Date(r.invoice_date).toLocaleDateString()
                      : "-";
                    const dued = r.due_date
                      ? new Date(r.due_date).toLocaleDateString()
                      : "-";
                    const amt = String(Number(r.amount || 0).toLocaleString());
                    const rec = String(
                      Number(r.received || 0).toLocaleString(),
                    );
                    const out = String(
                      Number(r.outstanding || 0).toLocaleString(),
                    );
                    doc.text(cust, 10, y);
                    doc.text(inv, 75, y);
                    doc.text(invd, 115, y);
                    doc.text(dued, 145, y);
                    doc.text(amt, 165, y);
                    doc.text(rec, 180, y);
                    doc.text(out, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("customer-outstanding.pdf");
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
                  <th>Customer</th>
                  <th>Invoice No</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.customer_name || "-"}</td>
                    <td>{r.invoice_no || "-"}</td>
                    <td>
                      {r.invoice_date
                        ? new Date(r.invoice_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.received || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.outstanding || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
