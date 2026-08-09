/**
 * @fileoverview OpeningBalancesPage component.
 * Standard Modern UI Opening Balances setup for managing initial ledger balances.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { 
  Scale, 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Upload, 
  Save, 
  Search, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export default function OpeningBalancesPage() {
  const { scope, user } = useAuth();
  const [accessAllowed, setAccessAllowed] = useState(null);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedFyId, setSelectedFyId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [openingMap, setOpeningMap] = useState(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [baseCurrencyCode, setBaseCurrencyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function loadFiscalYears() {
    try {
      const [fyRes, curRes] = await Promise.all([
        api.get("/finance/fiscal-years"),
        api.get("/finance/currencies"),
      ]);
      setFiscalYears(fyRes.data?.items || []);
      const open = (fyRes.data?.items || []).find(
        (x) => Number(x.is_open) === 1,
      );
      if (open) setSelectedFyId(String(open.id));
      const currencies = curRes.data?.items || [];
      const base = currencies.find((c) => Number(c.is_base) === 1);
      setBaseCurrencyCode(base?.code || currencies?.[0]?.code || "");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load fiscal years");
    }
  }

  // Check branch-level access restriction
  useEffect(() => {
    async function checkAccess() {
      const bid = scope?.branchId;
      if (!bid) { setAccessAllowed(true); return; }
      try {
        const res = await api.get(`/admin/branches/${bid}`);
        const branchData = res.data?.item || res.data;
        const allowedUserId = branchData?.stock_upload_user_id;
        const currentUserId = Number(user?.id);
        if (!allowedUserId || currentUserId === 1 || currentUserId === Number(allowedUserId)) {
          setAccessAllowed(true);
        } else {
          setAccessAllowed(false);
        }
      } catch {
        setAccessAllowed(true);
      }
    }
    if (user?.id) checkAccess();
  }, [scope?.branchId, user?.id]);

  async function loadData() {
    if (!selectedFyId) return;
    try {
      setLoading(true);
      const [accRes, obRes] = await Promise.all([
        api.get("/finance/accounts", { params: { postable: 1, active: 1 } }),
        api.get("/finance/opening-balances", {
          params: { fiscalYearId: Number(selectedFyId) },
        }),
      ]);
      const arr = accRes.data?.items || [];
      setAccounts(arr);
      const map = new Map();
      for (const r of obRes.data?.items || []) {
        map.set(String(r.account_id || r._id), {
          debit: Number(r.opening_debit || 0),
          credit: Number(r.opening_credit || 0),
        });
      }
      setOpeningMap(map);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiscalYears();
  }, []);
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFyId]);

  const rows = useMemo(() => {
    const term = String(searchTerm || "").trim();
    const src = term
      ? filterAndSort(accounts || [], {
          query: term,
          getKeys: (a) => [a.code, a.name],
        })
      : accounts || [];
    return src.map((a) => {
      const aId = String(a.id || a._id);
      const entry = openingMap.get(aId) || { debit: 0, credit: 0 };
      const net = Number(entry.debit || 0) - Number(entry.credit || 0);
      const obType = net >= 0 ? "Dr" : "Cr";
      const obAmt = Math.abs(Math.round(net * 100) / 100);
      return {
        id: aId,
        code: a.code,
        name: a.name,
        group: a.group_name,
        nature: a.nature,
        debit: entry.debit,
        credit: entry.credit,
        opening_balance_type: obType,
        opening_balance_amount: obAmt,
      };
    });
  }, [accounts, openingMap, searchTerm]);

  function setValue(id, field, val) {
    const rawVal = String(val || "").replace(/,/g, "").trim();
    const parsed = parseFloat(rawVal);
    const n = Math.max(0, isNaN(parsed) ? 0 : parsed);
    
    setOpeningMap((prev) => {
      const m = new Map(prev);
      const next =
        field === "debit" ? { debit: n, credit: 0 } : { debit: 0, credit: n };
      m.set(String(id), next);
      return m;
    });
  }

  async function saveAll() {
    if (!selectedFyId) {
      toast.error("Select a fiscal year");
      return;
    }
    try {
      setSaving(true);
      const fy = Number(selectedFyId);
      const items = [];
      for (const [accId, v] of openingMap.entries()) {
        items.push({
          accountId: accId,
          openingDebit: Number(v.debit || 0),
          openingCredit: Number(v.credit || 0),
        });
      }
      const resp = await api.post(
        "/finance/opening-balances/bulk",
        { fiscalYearId: fy, items },
        { headers: { "x-skip-offline-queue": "1" } },
      );
      const n = Number(resp?.data?.upserted || items.length || 0);
      toast.success(`Opening balances saved (${n} accounts)`);
      setOpeningMap(new Map());
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate(fmt = "xlsx") {
    if (!selectedFyId) {
      toast.error("Select a fiscal year");
      return;
    }
    const url = `/api/finance/opening-balances/template?format=xlsx&fiscalYearId=${selectedFyId}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  function onPickFile() {
    if (fileRef.current) fileRef.current.click();
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = Array.isArray(arr[0]) ? arr[0] : [];
      const normalizeHeader = (s) =>
        String(s || "")
          .toLowerCase()
          .replace(/\(.*?\)/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const codeIdx = header.findIndex(
        (h) => normalizeHeader(h) === "account code",
      );
      const debitIdx = header.findIndex((h) =>
        normalizeHeader(h).startsWith("opening debit"),
      );
      const creditIdx = header.findIndex((h) =>
        normalizeHeader(h).startsWith("opening credit"),
      );
      if (codeIdx < 0 || (debitIdx < 0 && creditIdx < 0)) {
        toast.error("Template headers not found");
        return;
      }
      const byCode = new Map(
        (accounts || []).map((a) => [String(a.code).toUpperCase(), a]),
      );
      const next = new Map(openingMap);
      const parseAmount = (v) => {
        if (typeof v === "number") return v;
        const s = String(v || "")
          .replace(/,/g, "")
          .trim();
        const n = Number(s || 0);
        return Number.isFinite(n) ? n : 0;
      };
      for (let i = 1; i < arr.length; i++) {
        const row = arr[i] || [];
        const code = String(row[codeIdx] || "")
          .trim()
          .toUpperCase();
        if (!code) continue;
        const acc = byCode.get(code);
        if (!acc) continue;
        const d = debitIdx >= 0 ? parseAmount(row[debitIdx]) : 0;
        const c = creditIdx >= 0 ? parseAmount(row[creditIdx]) : 0;
        if (!(d > 0 || c > 0)) continue;
        next.set(String(acc.id || acc._id), {
          debit: d > 0 ? Math.round(d * 100) / 100 : 0,
          credit: c > 0 ? Math.round(c * 100) / 100 : 0,
        });
      }
      setOpeningMap(next);
      toast.success("Template loaded");
    } catch (err) {
      toast.error("Failed to read template");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (accessAllowed === false) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mt-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You do not have administrative permission to access Opening Balances setup for this branch.
        </p>
        <Link to="/finance?section=Accounting%20Setup" className="btn btn-secondary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Finance
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Scale className="w-6 h-6" /> Opening Balances Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Configure initial opening debit & credit balances across Chart of Accounts
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => downloadTemplate()}
                disabled={!selectedFyId}
              >
                <Download size={14} /> Download Template
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
              <button
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={onPickFile}
                disabled={!rows.length}
              >
                <Upload size={14} /> Import Excel
              </button>
              <button
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={saveAll}
                disabled={saving || !selectedFyId}
              >
                <Save size={14} /> {saving ? "Saving..." : "Save All Balances"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Fiscal Year Selector */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search account code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Fiscal Period:
            </label>
            <select
              className="input text-sm font-semibold"
              value={selectedFyId}
              onChange={(e) => setSelectedFyId(e.target.value)}
            >
              <option value="">Select Fiscal Year</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.code} {Number(fy.is_open) === 1 ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Code</th>
                <th className="py-3 px-4 text-left">Account Name</th>
                <th className="py-3 px-4 text-left">Group</th>
                <th className="py-3 px-4 text-left">Nature</th>
                <th className="py-3 px-4 text-right">
                  Opening Debit {baseCurrencyCode ? `(${baseCurrencyCode})` : ""}
                </th>
                <th className="py-3 px-4 text-right">
                  Opening Credit {baseCurrencyCode ? `(${baseCurrencyCode})` : ""}
                </th>
                <th className="py-3 px-4 text-left">Net Opening Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading opening balances...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300">
                      {r.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {r.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {r.group || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                        {r.nature || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <input
                        className="input text-right font-mono text-sm max-w-[140px]"
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.debit || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setValue(r.id, "debit", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <input
                        className="input text-right font-mono text-sm max-w-[140px]"
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.credit || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setValue(r.id, "credit", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-bold">
                      <span className={r.opening_balance_type === "Dr" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"}>
                        {Number(r.opening_balance_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {r.opening_balance_type}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    No accounts found for selected fiscal period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
