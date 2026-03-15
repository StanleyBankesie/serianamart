import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import BankReconciliationMatchPanel from "./components/BankReconciliationMatchPanel.jsx";
export default function BankReconciliationForBank() {
  const { bankId } = useParams();
  const [loading, setLoading] = useState(true);
  const [bank, setBank] = useState(null);
  const [lines, setLines] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [period, setPeriod] = useState({ from: "", to: "" });

  useEffect(() => {
    (async () => {
      try {
        // Try to get fiscal year; fall back to calendar year
        const fyRes = await api
          .get("/finance/fiscal-years", { params: { active: 1 } })
          .catch(() => null);
        const today = new Date();
        let from = new Date(today.getFullYear(), 0, 1);
        let to = new Date(today.getFullYear(), 11, 31);
        if (fyRes?.data?.items?.length) {
          const current = fyRes.data.items.find((f) => {
            const s = new Date(
              f.start_date || f.startDate || f.from_date || f.from,
            );
            const e = new Date(f.end_date || f.endDate || f.to_date || f.to);
            return today >= s && today <= e;
          });
          const chosen = current || fyRes.data.items[0];
          const s =
            chosen &&
            new Date(
              chosen.start_date ||
                chosen.startDate ||
                chosen.from_date ||
                chosen.from,
            );
          const e =
            chosen &&
            new Date(
              chosen.end_date || chosen.endDate || chosen.to_date || chosen.to,
            );
          if (s && !isNaN(s)) from = s;
          if (e && !isNaN(e)) to = e;
        }
        setPeriod({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        });
      } catch {
        // Ignore; defaults already applied
      }
    })();
  }, []);
  async function load() {
    try {
      setLoading(true);
      // Load bank account
      let bRes = null;
      try {
        bRes = await api.get(`/finance/bank-accounts/${bankId}`);
      } catch {
        // Fallback: fetch list and locate
        const list = await api.get("/finance/bank-accounts");
        const found =
          (list.data?.items || []).find(
            (x) => String(x.id) === String(bankId),
          ) || null;
        bRes = { data: found };
      }
      setBank(bRes.data || null);
      // Load bank statement transactions (do not block page if fails)
      try {
        const stmRes = await api.get(
          `/finance/bank-accounts/${bankId}/statement-transactions`,
          {
            params: {
              from: period.from || undefined,
              to: period.to || undefined,
            },
          },
        );
        setLines(stmRes.data?.items || []);
      } catch {
        setLines([]);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load bank");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (period.from && period.to) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId, period.from, period.to]);
  async function importStatements(e) {
    e.preventDefault();
    if (!importFile) {
      toast.error("Please select a file to import");
      return;
    }
    try {
      setImporting(true);
      const fd = new FormData();
      fd.append("file", importFile);
      if (period.from) fd.append("from", period.from);
      if (period.to) fd.append("to", period.to);
      const res = await api.post(
        `/finance/bank-accounts/${bankId}/statement-transactions/import`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success(
        res?.data?.message || "Bank statement transactions imported",
      );
      setImportFile(null);
      load();
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to import bank statements",
      );
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Bank Reconciliation
            </h1>
            <p className="text-sm mt-1">
              {bank?.name || "-"}{" "}
              {bank?.account_number ? `(${bank.account_number})` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/finance/bank-reconciliation"
              className="btn btn-secondary"
            >
              Back to Banks
            </Link>
            <button
              className="btn btn-secondary"
              disabled={loading}
              onClick={load}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Period From</label>
                <input
                  className="input"
                  type="date"
                  value={period.from}
                  onChange={(e) =>
                    setPeriod((p) => ({ ...p, from: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Period To</label>
                <input
                  className="input"
                  type="date"
                  value={period.to}
                  onChange={(e) =>
                    setPeriod((p) => ({ ...p, to: e.target.value }))
                  }
                />
              </div>
            </div>
            <form onSubmit={importStatements} className="flex gap-2 items-end">
              <div>
                <label className="label">Import Statement</label>
                <input
                  className="input"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>
              <button className="btn" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </button>
            </form>
          </div>
          <BankReconciliationMatchPanel
            embedded
            bankId={bankId}
            accountId={
              bank?.account_id ||
              bank?.accountId ||
              bank?.coa_account_id ||
              bank?.ledger_account_id
            }
            periodFrom={period.from}
            periodTo={period.to}
            bankLines={lines}
          />
        </div>
      </div>
    </div>
  );
}
