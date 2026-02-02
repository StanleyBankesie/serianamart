import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function BankReconciliationList() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [recons, setRecons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bankAccountId, setBankAccountId] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [endingBalance, setEndingBalance] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [baRes, rcRes] = await Promise.all([
        api.get("/finance/bank-accounts"),
        api.get("/finance/bank-reconciliations"),
      ]);
      setBankAccounts(baRes.data?.items || []);
      setRecons(rcRes.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          "Failed to load bank accounts / reconciliations"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (statementFrom && statementTo) {
      const dFrom = new Date(statementFrom);
      const dTo = new Date(statementTo);
      if (dFrom > dTo) {
        toast.error("Statement From must be before or equal to Statement To");
        return;
      }
    }
    try {
      await api.post("/finance/bank-reconciliations", {
        bankAccountId: Number(bankAccountId),
        statementFrom,
        statementTo,
        statementEndingBalance: endingBalance
          ? Number(endingBalance)
          : undefined,
      });
      toast.success("Reconciliation created");
      setBankAccountId("");
      setStatementFrom("");
      setStatementTo("");
      setEndingBalance("");
      load();
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to create reconciliation"
      );
    }
  }

  async function complete(r) {
    if (r.status === "COMPLETED") return;
    if (!window.confirm("Mark this reconciliation as COMPLETED?")) return;
    try {
      await api.post(`/finance/bank-reconciliations/${r.id}/complete`);
      toast.success("Reconciliation completed");
      load();
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to complete reconciliation"
      );
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
              Create and manage bank reconciliations
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
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
        <div className="card-body">
          <form
            onSubmit={create}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <div className="md:col-span-2">
              <label className="label">Bank Account *</label>
              <select
                className="input"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
              >
                <option value="">Select</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.account_number || "No Acc"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Statement From *</label>
              <input
                className="input"
                type="date"
                value={statementFrom}
                onChange={(e) => setStatementFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Statement To *</label>
              <input
                className="input"
                type="date"
                value={statementTo}
                onChange={(e) => setStatementTo(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Ending Balance</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={endingBalance}
                onChange={(e) => setEndingBalance(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button className="btn-success">Create</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="text-right">Ending Balance</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recons.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.bank_account_name}</td>
                    <td>{String(r.statement_from).slice(0, 10)}</td>
                    <td>{String(r.statement_to).slice(0, 10)}</td>
                    <td className="text-right">
                      {Number(r.statement_ending_balance || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </td>
                    <td>
                      {r.status === "COMPLETED" ? (
                        <span className="badge badge-success">Completed</span>
                      ) : (
                        <span className="badge badge-info">Draft</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/finance/bank-reconciliation/${r.id}`}
                          className="btn btn-secondary"
                        >
                          Open
                        </Link>
                        {r.status !== "COMPLETED" && (
                          <button className="btn" onClick={() => complete(r)}>
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {recons.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-600">
                      No reconciliations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
