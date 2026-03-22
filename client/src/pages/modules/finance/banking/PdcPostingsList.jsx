import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function PdcPostingsList() {
  const [items, setItems] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fltStatus, setFltStatus] = useState("ALL");
  const [fltBank, setFltBank] = useState("");
  const [fltFrom, setFltFrom] = useState("");
  const [fltTo, setFltTo] = useState("");

  const [voucherId, setVoucherId] = useState("");
  const [instrumentNo, setInstrumentNo] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const params = {};
      if (fltStatus && fltStatus !== "ALL") params.status = fltStatus;
      if (fltBank) params.bankAccountId = fltBank;
      if (fltFrom) params.from = fltFrom;
      if (fltTo) params.to = fltTo;

      const [pRes, baRes] = await Promise.all([
        api.get("/finance/pdc-postings", { params }),
        api.get("/finance/bank-accounts"),
      ]);
      setItems(pRes.data?.items || []);
      setBankAccounts(baRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load PDCs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fltStatus, fltBank, fltFrom, fltTo]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/finance/vouchers");
        setVouchers(res.data?.items || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!voucherId) {
      toast.error("Voucher ID is required");
      return;
    }
    if (!instrumentNo.trim()) {
      toast.error("Instrument No. is required");
      return;
    }
    if (!instrumentDate) {
      toast.error("Instrument Date is required");
      return;
    }
    const v = vouchers.find((x) => Number(x.id) === Number(voucherId));
    if (v) {
      const iDate = new Date(instrumentDate);
      const vDate = new Date(v.voucher_date);
      if (iDate < vDate) {
        toast.error("Instrument Date must be on or after voucher date");
        return;
      }
    }
    try {
      await api.post("/finance/pdc-postings", {
        voucherId: Number(voucherId),
        instrumentNo: instrumentNo.trim(),
        instrumentDate,
        bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      });
      toast.success("PDC created");
      setVoucherId("");
      setInstrumentNo("");
      setInstrumentDate("");
      setBankAccountId("");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create PDC");
    }
  }

  async function updateStatus(r, nextStatus) {
    if (!window.confirm(`Change status to ${nextStatus}?`)) return;
    try {
      await api.put(`/finance/pdc-postings/${r.id}`, {
        status: nextStatus,
      });
      toast.success("Status updated");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to update status");
    }
  }

  async function deletePdc(r) {
    if (!window.confirm("Delete this PDC?")) return;
    try {
      await api.delete(`/finance/pdc-postings/${r.id}`);
      toast.success("PDC deleted");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to delete PDC");
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-brand p-6 text-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Post-Dated Cheques (PDC)
          </h1>
          <p className="text-blue-100 mt-1 font-medium">
            Register and manage PDC postings across all bank accounts
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/finance"
            className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
          >
            Return to Menu
          </Link>
          <button
            className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
            disabled={loading}
            onClick={load}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-xl border border-slate-200 sticky top-4">
            <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-700">
                New PDC Posting
              </h2>
            </div>
            <div className="card-body p-5">
              <form onSubmit={create} className="space-y-4">
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Voucher Search
                  </label>
                  <input
                    className="input input-bordered w-full input-sm"
                    placeholder="Search voucher no..."
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                  />
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Voucher *
                  </label>
                  <select
                    className="select select-bordered w-full select-sm"
                    value={voucherId}
                    onChange={(e) => setVoucherId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Voucher --</option>
                    {(voucherSearch
                      ? vouchers.filter((v) =>
                          String(v.voucher_no || "")
                            .toLowerCase()
                            .includes(voucherSearch.toLowerCase()),
                        )
                      : vouchers
                    )
                      .slice(0, 50)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.voucher_no} ({v.voucher_type_code})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Cheque No *
                  </label>
                  <input
                    className="input input-bordered w-full input-sm"
                    value={instrumentNo}
                    onChange={(e) => setInstrumentNo(e.target.value)}
                    placeholder="Cheque / Reference No."
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Cheque Date *
                  </label>
                  <input
                    className="input input-bordered w-full input-sm"
                    type="date"
                    value={instrumentDate}
                    onChange={(e) => setInstrumentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase">
                    Bank Account
                  </label>
                  <select
                    className="select select-bordered w-full select-sm"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                  >
                    <option value="">-- Select Bank --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.account_number || "No Acc"})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-success btn-sm w-full mt-2 text-white">
                  Add PDC Posting
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div class="card bg-base-100 shadow-xl border border-slate-200 overflow-hidden">
            <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-700">
                  PDC Registry
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      From:
                    </span>
                    <input
                      type="date"
                      className="input input-bordered input-xs"
                      value={fltFrom}
                      onChange={(e) => setFltFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      To:
                    </span>
                    <input
                      type="date"
                      className="input input-bordered input-xs"
                      value={fltTo}
                      onChange={(e) => setFltTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Bank:
                    </span>
                    <select
                      className="select select-bordered select-xs"
                      value={fltBank}
                      onChange={(e) => setFltBank(e.target.value)}
                    >
                      <option value="">All Banks</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Status:
                    </span>
                    <select
                      className="select select-bordered select-xs"
                      value={fltStatus}
                      onChange={(e) => setFltStatus(e.target.value)}
                    >
                      <option value="ALL">All Status</option>
                      <option value="HELD">Held</option>
                      <option value="POSTED">Posted</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-xs font-bold uppercase">
                        Cheque Number
                      </th>
                      <th className="text-xs font-bold uppercase">Date</th>
                      <th className="text-xs font-bold uppercase">
                        Bank Account
                      </th>
                      <th className="text-xs font-bold uppercase">Voucher</th>
                      <th className="text-xs font-bold uppercase">
                        Created Date
                      </th>
                      <th className="text-xs font-bold uppercase">
                        Created By
                      </th>
                      <th className="text-xs font-bold uppercase text-center">
                        Status
                      </th>
                      <th className="text-xs font-bold uppercase text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {items.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td>
                          <div className="font-bold text-slate-700">
                            {r.instrument_no}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase">
                            ID: {r.id}
                          </div>
                        </td>
                        <td className="font-medium text-slate-600">
                          {String(r.instrument_date).slice(0, 10)}
                        </td>
                        <td className="text-slate-600 italic">
                          {r.bank_account_name || "-"}
                        </td>
                        <td>
                          <span className="badge badge-outline badge-sm font-semibold">
                            {r.voucher_no}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="text-xs text-slate-500">
                          {r.creator_username || "-"}
                        </td>
                        <td className="text-center">
                          <span
                            className={`badge badge-sm font-bold ${
                              r.status === "POSTED"
                                ? "badge-success"
                                : r.status === "CANCELLED"
                                  ? "badge-error"
                                  : "badge-warning"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Link
                              to={`/finance/pdc-postings/${r.id}`}
                              className="btn btn-ghost btn-xs text-brand hover:bg-brand/10"
                            >
                              Edit
                            </Link>
                            {r.status === "HELD" && (
                              <>
                                <button
                                  className="btn btn-ghost btn-xs text-success hover:bg-success/10"
                                  onClick={() => updateStatus(r, "POSTED")}
                                  title="Post PDC"
                                >
                                  Post
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                                  onClick={() => updateStatus(r, "CANCELLED")}
                                  title="Cancel PDC"
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-slate-400 hover:bg-slate-100"
                                  onClick={() => deletePdc(r)}
                                  title="Delete PDC"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center text-slate-400">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-12 w-12 mb-2 opacity-20"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                            <span className="font-medium italic">
                              No PDCs found for the current filter
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
