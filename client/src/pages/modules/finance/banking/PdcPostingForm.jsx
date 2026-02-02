import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";

export default function PdcPostingForm() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [draft, setDraft] = useState({});
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [pRes, baRes] = await Promise.all([
        api.get("/finance/pdc-postings"),
        api.get("/finance/bank-accounts"),
      ]);
      const found = (pRes.data?.items || []).find(
        (x) => Number(x.id) === Number(id)
      );
      setItem(found || null);
      setDraft({});
      setBankAccounts(baRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load PDC");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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

  async function save() {
    if (
      (draft.instrument_date !== undefined &&
        !String(draft.instrument_date).trim()) ||
      (!item?.instrument_date && draft.instrument_date === undefined)
    ) {
      toast.error("Instrument Date is required");
      return;
    }
    const effVoucherId =
      draft.voucher_id === undefined || draft.voucher_id === ""
        ? item?.voucher_id
        : Number(draft.voucher_id);
    const effInstrumentDate =
      draft.instrument_date === undefined ||
      !String(draft.instrument_date).trim()
        ? item?.instrument_date
        : draft.instrument_date;
    if (effVoucherId && effInstrumentDate) {
      const v = vouchers.find((x) => Number(x.id) === Number(effVoucherId));
      if (v) {
        const iDate = new Date(effInstrumentDate);
        const vDate = new Date(v.voucher_date);
        if (iDate < vDate) {
          toast.error("Instrument Date must be on or after voucher date");
          return;
        }
      }
    }
    try {
      await api.put(`/finance/pdc-postings/${id}`, {
        voucherId:
          draft.voucher_id === undefined ? undefined : Number(draft.voucher_id),
        instrumentNo: draft.instrument_no || undefined,
        instrumentDate: draft.instrument_date || undefined,
        bankAccountId:
          draft.bank_account_id === undefined
            ? undefined
            : draft.bank_account_id
            ? Number(draft.bank_account_id)
            : null,
        status: draft.status || undefined,
      });
      toast.success("PDC updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update PDC");
    }
  }

  if (!item && !loading) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header">
            <h1 className="text-2xl font-bold">PDC Not Found</h1>
          </div>
          <div className="card-body">
            <Link to="/finance/pdc-postings" className="btn">
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Edit Post-Dated Cheque
            </h1>
            <p className="text-sm mt-1">{item?.instrument_no}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/finance/pdc-postings" className="btn btn-secondary">
              Back to List
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

      {item && (
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="label">Voucher</label>
                <input
                  className="input mb-2"
                  placeholder="Search voucher no."
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                />
                <select
                  className="input"
                  value={
                    draft.voucher_id === undefined
                      ? item.voucher_id ?? ""
                      : draft.voucher_id
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, voucher_id: e.target.value }))
                  }
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
                <label className="label">Instrument No.</label>
                <input
                  className="input"
                  value={
                    draft.instrument_no === undefined
                      ? item.instrument_no ?? ""
                      : draft.instrument_no
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, instrument_no: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Instrument Date</label>
                <input
                  className="input"
                  type="date"
                  value={
                    draft.instrument_date === undefined
                      ? item.instrument_date?.slice(0, 10)
                      : draft.instrument_date
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, instrument_date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Bank Account</label>
                <select
                  className="input"
                  value={
                    draft.bank_account_id === undefined
                      ? item.bank_account_id ?? ""
                      : draft.bank_account_id
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, bank_account_id: e.target.value }))
                  }
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
                <label className="label">Status</label>
                <select
                  className="input"
                  value={
                    draft.status === undefined ? item.status : draft.status
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="HELD">Held</option>
                  <option value="POSTED">Posted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="btn-success" onClick={save}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
