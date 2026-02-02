import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function PdcPostingsList() {
  const [items, setItems] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fltStatus, setFltStatus] = useState("");

  const [voucherId, setVoucherId] = useState("");
  const [instrumentNo, setInstrumentNo] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [pRes, baRes] = await Promise.all([
        api.get("/finance/pdc-postings"),
        api.get("/finance/bank-accounts"),
      ]);
      let list = pRes.data?.items || [];
      if (fltStatus) list = list.filter((x) => x.status === fltStatus);
      setItems(list);
      setBankAccounts(baRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load PDCs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fltStatus]);

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
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Post-Dated Cheques (PDC)
            </h1>
            <p className="text-sm mt-1">Register and manage PDC postings</p>
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
            <div>
              <label className="label">Voucher *</label>
              <input
                className="input mb-2"
                placeholder="Search voucher no."
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
              />
              <select
                className="input"
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
                required
              >
                <option value="">Select</option>
                {(voucherSearch
                  ? vouchers.filter((v) =>
                      String(v.voucher_no || "")
                        .toLowerCase()
                        .includes(voucherSearch.toLowerCase())
                    )
                  : vouchers
                )
                  .slice(0, 50)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucher_no} ({v.voucher_type_code}) -{" "}
                      {String(v.voucher_date).slice(0, 10)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Instrument No. *</label>
              <input
                className="input"
                value={instrumentNo}
                onChange={(e) => setInstrumentNo(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Instrument Date *</label>
              <input
                className="input"
                type="date"
                value={instrumentDate}
                onChange={(e) => setInstrumentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Bank Account</label>
              <select
                className="input"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                <option value="">Select</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.account_number || "No Acc"})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn-success">Add PDC</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={fltStatus}
                onChange={(e) => setFltStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="HELD">Held</option>
                <option value="POSTED">Posted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Instrument No.</th>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.instrument_no}</td>
                    <td>{String(r.instrument_date).slice(0, 10)}</td>
                    <td>{r.voucher_no}</td>
                    <td>
                      <span className="badge">{r.status}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/finance/pdc-postings/${r.id}`}
                          className="btn btn-secondary"
                        >
                          Edit
                        </Link>
                        {r.status === "HELD" && (
                          <>
                            <button
                              className="btn"
                              onClick={() => updateStatus(r, "POSTED")}
                            >
                              Post
                            </button>
                            <button
                              className="btn"
                              onClick={() => updateStatus(r, "CANCELLED")}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn"
                              onClick={() => deletePdc(r)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-600">
                      No PDCs found
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
