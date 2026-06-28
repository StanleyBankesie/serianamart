/**
 * @fileoverview GeneralLedgerReportPage component.
 * Provides functionality for GeneralLedgerReportPage.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function GeneralLedgerReportPage() {
  const [searchParams] = useSearchParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  const [items, setItems] = useState([]);
  const [accountMeta, setAccountMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const accountInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

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
    try {
      setLoading(true);
      const params = {
        from: from || null,
        to: to || null,
      };
      if (accountId) params.accountId = accountId;
      const res = await api.get("/finance/reports/general-ledger", { params });
      setOpening(Number(res.data?.opening_balance || 0));
      setAccountMeta(res.data?.account || null);
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
    if (accountId) {
      const hit = (accounts || []).find((a) => String(a.id) === String(accountId));
      if (hit) setAccountQuery(String(hit.name || ""));
    }
  }, [accountId, accounts]);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

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

  const {
    sorted: sortedItems,
    sortKey,
    sortDir,
    toggle,
  } = useSort(items, "voucher_date", "desc");

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

  const accountSearchResults = useMemo(() => {
    const q = String(accountQuery || "").trim().toLowerCase();
    if (!q) return groupFilteredAccounts || [];
    return (groupFilteredAccounts || [])
      .filter((a) => {
        const code = String(a.code || "").toLowerCase();
        const name = String(a.name || "").toLowerCase();
        return code.startsWith(q) || name.startsWith(q);
      })
      .slice(0, 20);
  }, [groupFilteredAccounts, accountQuery]);

  const selectedAccountLabel = useMemo(() => {
    const hit = (accounts || []).find(
      (a) => String(a.id) === String(accountId || ""),
    );
    return hit ? String(hit.name || "") : "";
  }, [accounts, accountId]);

  const handleSelectAccount = useCallback((id, name) => {
    setAccountId(String(id));
    setAccountQuery(String(name || ""));
    setAccountDropdownOpen(false);
  }, []);

  const handleAccountInputChange = useCallback((value) => {
    setAccountQuery(value);
    setAccountDropdownOpen(true);
    if (!String(value || "").trim()) { setAccountId(""); }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(e.target) &&
        accountInputRef.current &&
        !accountInputRef.current.contains(e.target)
      ) {
        setAccountDropdownOpen(false);
        const v = String(accountQuery || "").trim().toLowerCase();
        if (!v) { setAccountId(""); return; }
        const hit = (groupFilteredAccounts || []).find((a) => {
          const label = `${a.name}`.toLowerCase();
          const code = String(a.code || "").toLowerCase();
          return label === v || code === v;
        });
        if (!hit && selectedAccountLabel) {
          setAccountQuery(selectedAccountLabel);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountQuery, groupFilteredAccounts, selectedAccountLabel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/finance"
            className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            General Ledger
          </h1>
          <p className="text-sm mt-1">Ledger entries — leave account empty for all accounts</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-6 mb-6">
            <div className="flex-1 min-w-[250px]">
              <label className="label">Account</label>
              <div className="relative">
                <input
                  ref={accountInputRef}
                  className="input w-full"
                  placeholder={accountId ? selectedAccountLabel || "Search account..." : "Search account..."}
                  value={accountQuery}
                  onChange={(e) => handleAccountInputChange(e.target.value)}
                  onFocus={() => { setAccountDropdownOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && accountSearchResults.length > 0) {
                      const first = accountSearchResults[0];
                      handleSelectAccount(first.id, first.name);
                    }
                    if (e.key === "Escape") setAccountDropdownOpen(false);
                  }}
                  autoComplete="off"
                />
                {accountId ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-lg leading-none"
                    onClick={() => { setAccountId(""); setAccountQuery(""); setAccountDropdownOpen(false); }}
                    title="Clear account"
                  >
                    &times;
                  </button>
                ) : null}
                {accountDropdownOpen && accountSearchResults.length > 0 ? (
                  <div ref={accountDropdownRef} className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {accountSearchResults.map((a) => {
                      const q = String(accountQuery || "").trim().toLowerCase();
                      const name = String(a.name || "");
                      const idx = q ? name.toLowerCase().indexOf(q) : -1;
                      return (
                        <button
                          type="button"
                          key={a.id}
                          className="block w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectAccount(a.id, a.name); }}
                        >
                          <div className="flex justify-between items-center">
                            <span>
                              {idx >= 0 ? (
                                <>{name.slice(0, idx)}<strong className="text-brand-600 dark:text-brand-400">{name.slice(idx, idx + q.length)}</strong>{name.slice(idx + q.length)}</>
                              ) : name}
                            </span>
                            <span className="font-semibold text-brand-700 dark:text-brand-300 whitespace-nowrap ml-2 text-xs bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">{a.code}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="w-48">
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
            <div style={{ width: '1px', alignSelf: 'stretch', background: 'transparent', marginLeft: '1rem', marginRight: '1rem' }} />
            <div className="w-48">
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-3 shrink-0 ml-auto">
              {/* <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                disabled={loading}
              >
                Clear
              </button> */}
              <button
                type="button"
                className="btn-secondary px-4 whitespace-nowrap"
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
                className="btn-primary px-4 whitespace-nowrap"
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
                className="btn-primary px-4 whitespace-nowrap"
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
                  {!accountId ? (
                    <SortableHeader
                      label="Account"
                      sortKey="account_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                  ) : null}
                  <SortableHeader
                    label="Date"
                    sortKey="voucher_date"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Voucher No"
                    sortKey="voucher_no"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Description"
                    sortKey="description"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Debit"
                    sortKey="debit"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Credit"
                    sortKey="credit"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Currency"
                    sortKey="currency_code"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Exch. Rate"
                    sortKey="exchange_rate"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Balance (Dr/Cr)"
                    sortKey="balance"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((r, idx) => {
                  const balance = Number(r.balance || 0);
                  const balanceType = balance >= 0 ? "Dr" : "Cr";
                  const displayBalance = Math.abs(balance);
                  return (
                    <tr key={`${r.account_code || ""}-${r.voucher_no}-${r.line_no}-${idx}`}>
                      {!accountId ? (
                        <td className="font-medium">{r.account_name || r.account_code || "-"}</td>
                      ) : null}
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
                        {r.currency_code || "-"}
                      </td>
                      <td className="text-right">
                        {Number(r.exchange_rate || 1).toLocaleString()}
                      </td>
                      <td className="text-right">
                        <span className="font-medium">
                          {displayBalance.toLocaleString()}{" "}
                          <span
                            className={
                              balance >= 0 ? "text-blue-600" : "text-red-600"
                            }
                          >
                            {balanceType}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
