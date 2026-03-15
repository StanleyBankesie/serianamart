import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function BankReconciliationList() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [recons, setRecons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBankId = searchParams.get("bankId") || "";

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
          "Failed to load bank accounts / reconciliations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedBankId) {
      setBankAccountId(selectedBankId);
    }
  }, [selectedBankId]);

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
        e2?.response?.data?.message || "Failed to create reconciliation",
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
        e2?.response?.data?.message || "Failed to complete reconciliation",
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
        <div className="card-header">
          <h2 className="text-lg font-semibold">Bank Accounts</h2>
          <p className="text-sm text-slate-600">
            Click a bank to view and reconcile transactions
          </p>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Account No</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bankAccounts.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.name}</td>
                    <td>{b.account_number || "No Account No."}</td>
                    <td>
                      {b.currency_code || b.currency_id || b.currencyId || "-"}
                    </td>
                    <td>
                      {Number(b.is_active ?? b.isActive ?? 1) === 1 ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Inactive</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/finance/bank-reconciliation/bank/${b.id}`}
                        className="btn btn-secondary"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {bankAccounts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-slate-600">
                      No bank accounts found
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
