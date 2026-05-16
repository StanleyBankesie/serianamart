import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import jsPDF from "jspdf";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function TrialBalanceReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/trial-balance", {
        params: {
          from: from || null,
          to: to || null,
          groupId: groupId ? Number(groupId) : null,
          accountId: accountId ? Number(accountId) : null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      const res = await api.get("/finance/account-groups", {
        params: { active: 1 },
      });
      setGroups(res.data?.items || []);
    } catch {
      setGroups([]);
    }
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      });
      setAccounts(res.data?.items || []);
    } catch {
      setAccounts([]);
    }
  }

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    Promise.all([loadGroups(), loadAccounts()]).then(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, groupId, accountId]);

  // Transform data for new column format
  const transformedItems = items.map((r) => {
    const openingBal = Number(r.opening_debit || 0) - Number(r.opening_credit || 0);
    const closingBal = Number(r.closing_debit || 0) - Number(r.closing_credit || 0);
    return {
      ...r,
      opening_balance: Math.abs(openingBal),
      opening_type: openingBal >= 0 ? "DR" : "CR",
      debit_amount: Number(r.movement_debit || 0),
      credit_amount: Number(r.movement_credit || 0),
      closing_balance: Math.abs(closingBal),
      closing_type: closingBal >= 0 ? "DR" : "CR",
    };
  });

  const totals = transformedItems.reduce(
    (acc, r) => {
      acc.opening_dr += r.opening_type === "DR" ? r.opening_balance : 0;
      acc.opening_cr += r.opening_type === "CR" ? r.opening_balance : 0;
      acc.debit_amount += r.debit_amount;
      acc.credit_amount += r.credit_amount;
      acc.closing_dr += r.closing_type === "DR" ? r.closing_balance : 0;
      acc.closing_cr += r.closing_type === "CR" ? r.closing_balance : 0;
      return acc;
    },
    {
      opening_dr: 0,
      opening_cr: 0,
      debit_amount: 0,
      credit_amount: 0,
      closing_dr: 0,
      closing_cr: 0,
    },
  );

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(transformedItems, "account_code", "asc");

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
            Trial Balance
          </h1>
          <p className="text-sm mt-1">Debits and credits by account</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
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
            <div>
              <label className="label">Account Group</label>
              <select
                className="input"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Account</label>
              <select
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts
                  .filter((a) => {
                    if (!groupId) return true;
                    return Number(a.group_id || 0) === Number(groupId);
                  })
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!transformedItems.length) return;
                  const exportData = transformedItems.map((r) => ({
                    Account_Code: r.account_code,
                    Account_Name: r.account_name,
                    Account_Type: r.account_type,
                    Account_Category: r.account_category,
                    Opening_Balance: r.opening_balance,
                    Opening_Type: r.opening_type,
                    Debit_Amount: r.debit_amount,
                    Credit_Amount: r.credit_amount,
                    Closing_Balance: r.closing_balance,
                    Closing_Type: r.closing_type,
                  }));
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  autosizeWorksheetColumns(ws);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
                  XLSX.writeFile(wb, "trial-balance.xlsx");
                }}
                disabled={!transformedItems.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!transformedItems.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Trial Balance", 10, y);
                  y += 8;
                  doc.setFontSize(9);
                  doc.text("Account", 10, y);
                  doc.text("Op. Bal", 90, y, { align: "right" });
                  doc.text("Type", 100, y, { align: "center" });
                  doc.text("Dr Amt", 130, y, { align: "right" });
                  doc.text("Cr Amt", 160, y, { align: "right" });
                  doc.text("Cls. Bal", 190, y, { align: "right" });
                  doc.text("Type", 200, y, { align: "center" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  transformedItems.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const acct = `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 30)}`.trim();
                    doc.text(acct, 10, y);
                    doc.text(r.opening_balance > 0 ? r.opening_balance.toLocaleString() : "—", 90, y, { align: "right" });
                    doc.text(r.opening_type, 100, y, { align: "center" });
                    doc.text(r.debit_amount > 0 ? r.debit_amount.toLocaleString() : "—", 130, y, { align: "right" });
                    doc.text(r.credit_amount > 0 ? r.credit_amount.toLocaleString() : "—", 160, y, { align: "right" });
                    doc.text(r.closing_balance > 0 ? r.closing_balance.toLocaleString() : "—", 190, y, { align: "right" });
                    doc.text(r.closing_type, 200, y, { align: "center" });
                    y += 5;
                  });
                  y += 5;
                  doc.setFontSize(10);
                  doc.setFont("helvetica", "bold");
                  doc.text(`Totals — Opening DR: ${totals.opening_dr.toLocaleString()}  CR: ${totals.opening_cr.toLocaleString()}`, 10, y);
                  y += 6;
                  doc.text(`Movement — Debit: ${totals.debit_amount.toLocaleString()}  Credit: ${totals.credit_amount.toLocaleString()}`, 10, y);
                  y += 6;
                  doc.text(`Closing — DR: ${totals.closing_dr.toLocaleString()}  CR: ${totals.closing_cr.toLocaleString()}`, 10, y);
                  doc.save("trial-balance.pdf");
                }}
                disabled={!transformedItems.length}
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
                  <SortableHeader label="Account Type" sortKey="account_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Account Category" sortKey="account_category" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Account" sortKey="account_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Opening Balance" sortKey="opening_balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <th className="text-center">Type</th>
                  <SortableHeader label="Debit Amount" sortKey="debit_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Credit Amount" sortKey="credit_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Closing Balance" sortKey="closing_balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <th className="text-center">Type</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((r) => (
                  <tr key={r.account_id}>
                    <td>{r.account_type || "-"}</td>
                    <td>{r.account_category || "-"}</td>
                    <td>
                      <Link 
                        to={`/finance/reports/general-ledger?accountId=${r.account_id}&from=${from}&to=${to}`}
                        className="font-medium text-blue-500 hover:text-blue-600 hover:underline"
                      >
                        {r.account_name}
                      </Link>
                    </td>
                    <td className="text-right">
                      {r.opening_balance > 0 ? r.opening_balance.toLocaleString() : "—"}
                    </td>
                    <td className="text-center">
                      {r.opening_balance > 0 ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.opening_type === "DR" 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {r.opening_type}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="text-right">
                      {r.debit_amount > 0 ? r.debit_amount.toLocaleString() : "—"}
                    </td>
                    <td className="text-right">
                      {r.credit_amount > 0 ? r.credit_amount.toLocaleString() : "—"}
                    </td>
                    <td className="text-right">
                      {r.closing_balance > 0 ? r.closing_balance.toLocaleString() : "—"}
                    </td>
                    <td className="text-center">
                      {r.closing_balance > 0 ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.closing_type === "DR" 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {r.closing_type}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                  <td colSpan="3" className="font-semibold">Totals</td>
                  <td className="text-right">{totals.opening_dr.toLocaleString()}</td>
                  <td className="text-center">DR</td>
                  <td className="text-right">{totals.debit_amount.toLocaleString()}</td>
                  <td className="text-right">{totals.credit_amount.toLocaleString()}</td>
                  <td className="text-right">{totals.closing_dr.toLocaleString()}</td>
                  <td className="text-center">DR</td>
                </tr>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                  <td colSpan="3"></td>
                  <td className="text-right">{totals.opening_cr.toLocaleString()}</td>
                  <td className="text-center">CR</td>
                  <td colSpan="2"></td>
                  <td className="text-right">{totals.closing_cr.toLocaleString()}</td>
                  <td className="text-center">CR</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
