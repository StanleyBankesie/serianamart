import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { filterAndSort } from "@/utils/searchUtils.js";

export default function OpeningBalancesPage() {
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
        map.set(Number(r.account_id), {
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
      const entry = openingMap.get(Number(a.id)) || { debit: 0, credit: 0 };
      const net = Number(entry.debit || 0) - Number(entry.credit || 0);
      const obType = net >= 0 ? "Dr" : "Cr";
      const obAmt = Math.abs(Math.round(net * 100) / 100);
      return {
        id: Number(a.id),
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
    const n = Math.max(0, Number(val || 0));
    setOpeningMap((prev) => {
      const m = new Map(prev);
      const cur = m.get(Number(id)) || { debit: 0, credit: 0 };
      const next =
        field === "debit" ? { debit: n, credit: 0 } : { debit: 0, credit: n };
      m.set(Number(id), next);
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
          accountId: Number(accId),
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
      await loadData();
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
    window.location.href = url;
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
        next.set(Number(acc.id), {
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
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Opening Balances</h1>
              <p className="text-sm mt-1">
                Update opening balances for all ledger accounts
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/finance" className="btn btn-secondary">
                Return to Menu
              </Link>
              <input
                className="input w-64"
                placeholder="Search code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="input"
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(e.target.value)}
              >
                <option value="">Select Fiscal Year</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.code}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                onClick={() => downloadTemplate()}
                disabled={!selectedFyId}
              >
                Download Excel Template
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
              <button
                className="btn"
                onClick={onPickFile}
                disabled={!rows.length}
              >
                Import From Excel
              </button>
              <button
                className="btn-success"
                onClick={saveAll}
                disabled={saving || !selectedFyId}
              >
                Save All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Group</th>
                    <th>Nature</th>
                    <th className="text-right">
                      {`Opening Debit${baseCurrencyCode ? ` (${baseCurrencyCode})` : ""}`}
                    </th>
                    <th className="text-right">
                      {`Opening Credit${baseCurrencyCode ? ` (${baseCurrencyCode})` : ""}`}
                    </th>
                    <th className="text-right">
                      {`Opening Balance${baseCurrencyCode ? ` (${baseCurrencyCode})` : ""}`}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.group}</td>
                      <td>{r.nature}</td>
                      <td className="text-right">
                        <input
                          className="input text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number(r.debit || 0).toFixed(2)}
                          onChange={(e) =>
                            setValue(r.id, "debit", e.target.value)
                          }
                        />
                      </td>
                      <td className="text-right">
                        <input
                          className="input text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number(r.credit || 0).toFixed(2)}
                          onChange={(e) =>
                            setValue(r.id, "credit", e.target.value)
                          }
                        />
                      </td>
                      <td className="text-right">
                        {`${r.opening_balance_amount.toFixed(2)} ${r.opening_balance_type}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
