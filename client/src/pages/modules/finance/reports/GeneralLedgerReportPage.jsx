import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import { filterAndSort } from "../../../../utils/searchUtils.js";

export default function GeneralLedgerReportPage() {
  const [searchParams] = useSearchParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState("old");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [opening, setOpening] = useState(0);
  const [items, setItems] = useState([]);
  const [accountMeta, setAccountMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  function getVoucherPath(row) {
    const code = String(row?.voucher_type_code || "").toUpperCase();
    const base =
      code === "JV"
        ? "journal-voucher"
        : code === "PAYV"
          ? "payment-voucher"
          : code === "RV"
            ? "receipt-voucher"
            : code === "CV"
              ? "contra-voucher"
              : code === "SV"
                ? "sales-voucher"
                : code === "PV" || code === "PUV"
                  ? "purchase-voucher"
                  : code === "DN"
                    ? "debit-note"
                    : code === "CN"
                      ? "credit-note"
                      : "journal-voucher";
    return `/finance/${base}/${row?.voucher_id}?mode=view`;
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      });
      setAccounts(res.data?.items || []);
    } catch {
      toast.error("Failed to load accounts");
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

  async function run() {
    if (!accountId) {
      setOpening(0);
      setItems([]);
      setAccountMeta(null);
      return;
    }
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
      setAccountMeta(res.data?.account || null);
      const rows = res.data?.items || [];
      setItems(order === "new" ? rows.slice().reverse() : rows);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load general ledger",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    // Check for query params from trial balance drill-down
    const qpFrom = searchParams.get("from");
    const qpTo = searchParams.get("to");
    const qpAccountId = searchParams.get("accountId");
    setFrom(qpFrom || jan1.toISOString().slice(0, 10));
    setTo(qpTo || today.toISOString().slice(0, 10));
    if (qpAccountId) {
      setAccountId(qpAccountId);
    }
    Promise.all([loadAccounts(), loadGroups()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, order]);

  // If selected account falls outside selected group, clear selection.
  useEffect(() => {
    const gid = groupId ? Number(groupId) : null;
    const filtered = gid
      ? (accounts || []).filter(
          (a) =>
            Number(a.group_id || a.groupId || 0) === gid ||
            String(a.group_name || a.groupName || "") ===
              (groups.find((g) => Number(g.id) === gid)?.name || ""),
        )
      : accounts || [];
    if (!accountId) return;
    if (!filtered.find((a) => String(a.id) === String(accountId))) {
      setAccountId("");
      setAccountQuery("");
      setOpening(0);
      setItems([]);
      setAccountMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, accounts]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const groupFilteredAccounts = useMemo(() => {
    if (!groupId) return accounts || [];
    const selectedGroupName =
      groups.find((g) => String(g.id) === String(groupId))?.name || "";
    return (accounts || []).filter(
      (a) =>
        Number(a.group_id || a.groupId || 0) === Number(groupId) ||
        String(a.group_name || a.groupName || "") === selectedGroupName,
    );
  }, [accounts, groupId, groups]);

  const filteredAccounts = useMemo(() => {
    return filterAndSort(groupFilteredAccounts, {
      query: accountQuery,
      getKeys: (a) => [a.code, a.name],
    });
  }, [groupFilteredAccounts, accountQuery]);

  const selectedAccountLabel = useMemo(() => {
    const hit = (accounts || []).find(
      (a) => String(a.id) === String(accountId || ""),
    );
    return hit ? String(hit.name || "") : "";
  }, [accounts, accountId]);

  function handleAccountInputChange(value) {
    setAccountQuery(value);
    const v = String(value || "")
      .trim()
      .toLowerCase();
    if (!v) {
      setAccountId("");
      setOpening(0);
      setItems([]);
      setAccountMeta(null);
      return;
    }
    const hit = (groupFilteredAccounts || []).find((a) => {
      const label = `${a.name}`.toLowerCase();
      const code = String(a.code || "").toLowerCase();
      return label === v || code === v;
    });
    if (hit?.id) {
      setAccountId(String(hit.id));
      setAccountQuery(String(hit.name || ""));
    }
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
            General Ledger
          </h1>
          <p className="text-sm mt-1">Ledger entries for a selected account</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="label">Account</label>
              <input
                className="input"
                placeholder="Type to search account..."
                value={accountQuery}
                onChange={(e) => handleAccountInputChange(e.target.value)}
                list="gl-account-options"
                onBlur={() => {
                  const v = String(accountQuery || "")
                    .trim()
                    .toLowerCase();
                  if (!v) {
                    setAccountId("");
                    setOpening(0);
                    setItems([]);
                    setAccountMeta(null);
                    return;
                  }
                  const hit = (groupFilteredAccounts || []).find((a) => {
                    const label = `${a.name}`.toLowerCase();
                    const code = String(a.code || "").toLowerCase();
                    return label === v || code === v;
                  });
                  if (hit?.id) {
                    setAccountId(String(hit.id));
                    setAccountQuery(String(hit.name || ""));
                    return;
                  }
                  if (selectedAccountLabel)
                    setAccountQuery(selectedAccountLabel);
                }}
              />
              <datalist id="gl-account-options">
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={String(a.name || "")} />
                ))}
              </datalist>
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
            <div className="flex items-end">
              <button
                type="button"
                className="btn-secondary"
                title={
                  order === "new" ? "New entries first" : "Old entries first"
                }
                onClick={() => setOrder(order === "new" ? "old" : "new")}
              >
                {order === "new" ? "🔽" : "🔼"}
              </button>
            </div>
            <div className="flex items-end gap-2">
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
                  autosizeWorksheetColumns(ws);
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
                  doc.text("Voucher No", 40, y);
                  doc.text("Description", 105, y);
                  doc.text("Debit", 165, y);
                  doc.text("Credit", 185, y);
                  doc.text("Balance", 205, y, { align: "right" });
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
                    const desc = String(r.description || "-").slice(0, 45);
                    const dr = String(Number(r.debit || 0).toLocaleString());
                    const cr = String(Number(r.credit || 0).toLocaleString());
                    const bal = String(Number(r.balance || 0).toLocaleString());
                    doc.text(dt, 10, y);
                    doc.text(vn, 40, y);
                    doc.text(desc, 105, y);
                    doc.text(dr, 165, y);
                    doc.text(cr, 185, y);
                    doc.text(bal, 205, y, { align: "right" });
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

          {accountId ? (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
              <div className="text-sm">Opening Balance</div>
              <div className="text-xl font-semibold">
                {Number(opening || 0).toLocaleString()}
              </div>
              <div className="text-sm mt-2">
                Balance Type:{" "}
                {String(
                  accountMeta?.current_balance_type ||
                    accountMeta?.balance_type ||
                    "-",
                )}
              </div>
              <div className="text-sm">
                Current Balance:{" "}
                {Number(accountMeta?.current_balance || 0).toLocaleString()}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Date</th>
                  <th>Voucher No</th>
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
                    <td>
                      <Link
                        to={getVoucherPath(r)}
                        className="font-medium text-sky-400 hover:text-sky-500"
                      >
                        {r.voucher_no}
                      </Link>
                    </td>
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
