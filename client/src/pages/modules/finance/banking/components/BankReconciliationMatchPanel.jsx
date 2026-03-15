import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
export default function BankReconciliationMatchPanel({
  reconId,
  bankId,
  accountId,
  periodFrom,
  periodTo,
  bankLines,
  embedded = false,
}) {
  const [ledgerTx, setLedgerTx] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    amountFrom: "",
    amountTo: "",
    type: "",
    matched: "",
    ref: "",
  });
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedLedger, setSelectedLedger] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let acctId = accountId;
        if (!acctId && bankId) {
          try {
            const b = await api.get(`/finance/bank-accounts/${bankId}`);
            acctId =
              b?.data?.account_id ||
              b?.data?.accountId ||
              b?.data?.coa_account_id ||
              b?.data?.ledger_account_id ||
              null;
          } catch {
            // ignore
          }
        }
        if (acctId) {
          const res = await api.get("/finance/reports/general-ledger", {
            params: {
              accountId: acctId,
              from: periodFrom || undefined,
              to: periodTo || undefined,
            },
          });
          const items = Array.isArray(res?.data?.items) ? res.data.items : [];
          const mapped = items.map((t, idx) => {
            const amt =
              Number(t.amount ?? 0) !== 0
                ? Number(t.amount)
                : Number(t.debit || 0) - Number(t.credit || 0);
            return {
              id: t.id || t.line_id || `${t.voucher_id || ""}-${idx}`,
              date: t.entry_date || t.date || t.voucher_date,
              description:
                t.description || t.particulars || t.voucher_type_name || "",
              reference: t.voucher_no || t.reference || "",
              amount: amt,
              matched: t.matched || false,
            };
          });
          setLedgerTx(mapped);
        } else {
          const url = reconId
            ? `/finance/bank-reconciliations/${reconId}/ledger-transactions`
            : `/finance/bank-accounts/${bankId}/ledger-transactions`;
          const res = await api.get(url);
          setLedgerTx(res.data?.items || []);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [reconId, bankId, accountId, periodFrom, periodTo]);
  const suggestions = useMemo(() => {
    const out = {};
    for (const b of bankLines) {
      const bAmt = Number(b.amount || 0);
      const bDate = new Date(b.statement_date || b.date || 0);
      const s = ledgerTx.filter((t) => {
        const tAmt = Number(t.amount || 0);
        const tDate = new Date(t.date || 0);
        const amtMatch = Math.abs(tAmt - bAmt) < 0.01;
        const days = Math.abs((tDate - bDate) / (1000 * 60 * 60 * 24));
        const dateClose = days <= 3;
        const refMatch =
          (t.reference || "").toLowerCase().includes(
            String(b.reference || b.description || "")
              .toLowerCase()
              .slice(0, 10),
          ) ||
          (b.reference || "").toLowerCase().includes(
            String(t.reference || t.description || "")
              .toLowerCase()
              .slice(0, 10),
          );
        return amtMatch && (dateClose || refMatch);
      });
      if (s.length) out[b.id] = s.slice(0, 3);
    }
    return out;
  }, [bankLines, ledgerTx]);
  const filteredBank = useMemo(() => {
    return bankLines.filter((b) => {
      const d = new Date(b.statement_date || b.date || 0);
      const from = periodFrom ? new Date(periodFrom) : null;
      const to = periodTo ? new Date(periodTo) : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      const amt = Number(b.amount || 0);
      if (filters.amountFrom && amt < Number(filters.amountFrom)) return false;
      if (filters.amountTo && amt > Number(filters.amountTo)) return false;
      if (filters.ref) {
        const hay = `${b.reference || ""} ${b.description || ""}`.toLowerCase();
        if (!hay.includes(filters.ref.toLowerCase())) return false;
      }
      return true;
    });
  }, [bankLines, filters]);
  const filteredLedger = useMemo(() => {
    return ledgerTx.filter((t) => {
      const d = new Date(t.date || 0);
      const from = periodFrom ? new Date(periodFrom) : null;
      const to = periodTo ? new Date(periodTo) : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      const amt = Number(t.amount || 0);
      if (filters.amountFrom && amt < Number(filters.amountFrom)) return false;
      if (filters.amountTo && amt > Number(filters.amountTo)) return false;
      if (filters.type && String(t.type || "") !== filters.type) return false;
      if (filters.matched) {
        const m = String(filters.matched).toLowerCase();
        const isMatched = !!t.matched;
        if (m === "matched" && !isMatched) return false;
        if (m === "unmatched" && isMatched) return false;
      }
      if (filters.ref) {
        const hay = `${t.reference || ""} ${t.description || ""}`.toLowerCase();
        if (!hay.includes(filters.ref.toLowerCase())) return false;
      }
      return true;
    });
  }, [ledgerTx, filters]);
  async function acceptMatch(bankTxnId, ledgerIds) {
    try {
      if (reconId) {
        await api.post(`/finance/bank-reconciliations/${reconId}/matches`, {
          bankTransactionId: bankTxnId,
          ledgerTransactionIds: ledgerIds,
        });
      } else {
        await api.post(`/finance/bank-accounts/${bankId}/matches`, {
          bankTransactionId: bankTxnId,
          ledgerTransactionIds: ledgerIds,
        });
      }
      toast.success("Match recorded");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to record reconciliation match",
      );
    }
  }
  const Content = (
    <div className="space-y-4">
      <div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className="input"
            type="number"
            step="0.01"
            value={filters.amountFrom}
            onChange={(e) =>
              setFilters((p) => ({ ...p, amountFrom: e.target.value }))
            }
            placeholder="Amount from"
          />
          <input
            className="input"
            type="number"
            step="0.01"
            value={filters.amountTo}
            onChange={(e) =>
              setFilters((p) => ({ ...p, amountTo: e.target.value }))
            }
            placeholder="Amount to"
          />
          <input
            className="input"
            value={filters.ref}
            onChange={(e) => setFilters((p) => ({ ...p, ref: e.target.value }))}
            placeholder="Reference/Description"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border">
            <div className="p-2 font-semibold">Bank Statement</div>
            <div className="divide-y">
              {filteredBank.map((b) => (
                <div
                  key={b.id}
                  className={`p-2 cursor-pointer ${
                    selectedBank?.id === b.id ? "bg-slate-100" : ""
                  }`}
                  onClick={() => setSelectedBank(b)}
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {String(b.statement_date || "").slice(0, 10)} •{" "}
                        {b.description || "-"}
                      </div>
                      <div className="text-xs text-slate-600">
                        {b.reference || ""}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {Number(b.amount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  {suggestions[b.id]?.length ? (
                    <div className="mt-2">
                      <div className="text-xs text-slate-600 mb-1">
                        Suggested matches
                      </div>
                      {suggestions[b.id].map((t) => (
                        <div
                          key={t.id}
                          className="text-xs flex justify-between"
                        >
                          <span>
                            {String(t.date || "").slice(0, 10)} •{" "}
                            {t.description || t.reference || "-"}
                          </span>
                          <span>
                            {Number(t.amount || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {filteredBank.length === 0 && (
                <div className="p-4 text-slate-600">No bank lines</div>
              )}
            </div>
          </div>
          <div className="rounded border">
            <div className="p-2 font-semibold">ERP Ledger</div>
            <div className="divide-y">
              {filteredLedger.map((t) => (
                <div key={t.id} className="p-2 flex justify-between">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLedger.includes(t.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedLedger((p) =>
                          checked ? [...p, t.id] : p.filter((x) => x !== t.id),
                        );
                      }}
                    />
                    <span className="text-sm">
                      {String(t.date || "").slice(0, 10)} •{" "}
                      {t.description || t.reference || "-"}
                    </span>
                  </label>
                  <div className="text-right text-sm">
                    {Number(t.amount || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
              {filteredLedger.length === 0 && (
                <div className="p-4 text-slate-600">No ledger transactions</div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-success"
            disabled={!selectedBank || selectedLedger.length === 0}
            onClick={() =>
              acceptMatch(selectedBank.id, selectedLedger).then(() => {
                setSelectedBank(null);
                setSelectedLedger([]);
              })
            }
          >
            Accept Match
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelectedBank(null);
              setSelectedLedger([]);
            }}
          >
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
  if (embedded) return Content;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Transaction Matching</h2>
        <p className="text-sm text-slate-600">
          Match bank statement lines to ERP ledger transactions
        </p>
      </div>
      <div className="card-body">{Content}</div>
    </div>
  );
}
