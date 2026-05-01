import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function BankReconciliationList() {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [recons, setRecons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedBankId = searchParams.get("bankId") || "";

  const [bankAccountId, setBankAccountId] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [endingBalance, setEndingBalance] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isFromLocked, setIsFromLocked] = useState(false);

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

  useEffect(() => {
    if (bankAccountId) {
      const bankRecons = recons
        .filter(
          (r) =>
            String(r.bank_account_id) === String(bankAccountId) &&
            r.status === "COMPLETED",
        )
        .sort((a, b) => new Date(b.statement_to) - new Date(a.statement_to));

      if (bankRecons.length > 0) {
        const lastTo = bankRecons[0].statement_to?.slice(0, 10);
        const lastEndingBalance = Number(
          bankRecons[0].statement_ending_balance || 0,
        );
        setOpeningBalance(lastEndingBalance);

        if (lastTo) {
          // Set "From" to be the day after "To" of the previous reconciliation
          const d = new Date(lastTo + "T12:00:00");
          d.setDate(d.getDate() + 1);
          const nextFrom = d.toISOString().slice(0, 10);
          setStatementFrom(nextFrom);
          setStatementTo(nextFrom);
          setIsFromLocked(true);
        } else {
          setStatementFrom("");
          setIsFromLocked(false);
        }
      } else {
        setStatementFrom("");
        setOpeningBalance(0);
        setIsFromLocked(false);
      }
    } else {
      setStatementFrom("");
      setOpeningBalance(0);
      setIsFromLocked(false);
    }
  }, [bankAccountId, recons]);

  async function create(e) {
    e.preventDefault();
    if (!bankAccountId || !statementFrom || !statementTo) {
      toast.error("Bank Account, Statement From and Statement To are required");
      return;
    }
    try {
      const res = await api.post("/finance/bank-reconciliations", {
        bankAccountId: Number(bankAccountId),
        statementFrom,
        statementTo,
        statementEndingBalance: endingBalance ? Number(endingBalance) : 0,
        status: "DRAFT",
      });
      toast.success("Reconciliation created");
      navigate(`/finance/bank-reconciliation/${res.data.id}`);
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to create reconciliation",
      );
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center bg-brand p-4 text-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-sm opacity-90">
            Manage and create bank reconciliations
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/finance"
            className="btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Return to Menu
          </Link>
          <button
            onClick={load}
            className="btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-xl border border-slate-200">
            <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold">New Reconciliation</h2>
            </div>
            <div className="card-body p-4">
              <form onSubmit={create} className="space-y-4">
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Bank Account
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Bank --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.account_number})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Opening Balance
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full bg-slate-50 font-mono"
                    value={openingBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                    readOnly
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Carried forward from the last completed reconciliation.
                  </p>
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Statement From
                  </label>
                  <input
                    type="date"
                    className={`input input-bordered w-full ${isFromLocked ? "bg-blue-50 border-blue-300" : ""}`}
                    value={statementFrom}
                    onChange={(e) =>
                      !isFromLocked && setStatementFrom(e.target.value)
                    }
                    readOnly={isFromLocked}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Statement To
                  </label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={statementTo}
                    onChange={(e) => setStatementTo(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Ending Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered w-full"
                    value={endingBalance}
                    onChange={(e) => setEndingBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full mt-2"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Start Reconciliation"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-xl border border-slate-200">
            <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold">Existing Reconciliations</h2>
            </div>
            <div className="card-body p-0 overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-xs font-bold uppercase">
                      Bank
                    </th>
                    <th className="text-xs font-bold uppercase">
                      Account No
                    </th>
                    <th className="text-xs font-bold uppercase">Period</th>
                    <th className="text-right text-xs font-bold uppercase">
                      Ending Balance
                    </th>
                    <th className="text-xs font-bold uppercase">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recons.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="text-center py-8 text-slate-500 italic"
                      >
                        No reconciliations found
                      </td>
                    </tr>
                  ) : (
                    recons.map((r) => {
                      const bankAccount = bankAccounts.find(
                        (b) => String(b.id) === String(r.bank_account_id)
                      );
                      return (
                        <tr key={r.id} className="hover">
                          <td className="font-medium text-sm">
                            {bankAccount?.bank_name || bankAccount?.name || r.bank_account_name || "-"}
                          </td>
                          <td className="text-sm font-mono">
                            {bankAccount?.account_number || "-"}
                          </td>
                          <td className="text-sm">
                            {r.statement_from?.slice(0, 10)} to{" "}
                            {r.statement_to?.slice(0, 10)}
                          </td>
                          <td className="text-right text-sm font-mono">
                            {Number(
                              r.statement_ending_balance || 0,
                            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span
                              className={`badge badge-sm ${r.status === "COMPLETED" ? "badge-success" : r.status === "PENDING" ? "badge-warning" : "badge-info"}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="text-right">
                            <Link
                              to={`/finance/bank-reconciliation/${r.id}`}
                              className="btn btn-xs btn-primary"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
