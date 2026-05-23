import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";

export default function PurchaseSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [setup, setSetup] = useState({
    freight_account_id: "",
    other_charges_account_id: "",
  });
  const [reasons, setReasons] = useState([]);
  const [reasonsSaving, setReasonsSaving] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [setupRes, accountsRes, reasonsRes] = await Promise.all([
        api.get("/purchase/setup"),
        api.get("/finance/accounts", { params: { postable: 1, active: 1 } }),
        api
          .get("/purchase/return-rejection-reasons")
          .catch(() => ({ data: { items: [] } })),
      ]);

      if (setupRes.data) {
        setSetup({
          freight_account_id: setupRes.data.freight_account_id || "",
          other_charges_account_id:
            setupRes.data.other_charges_account_id || "",
        });
      }

      setAccounts(
        Array.isArray(accountsRes.data?.items) ? accountsRes.data.items : [],
      );
      setReasons(
        Array.isArray(reasonsRes?.data?.items) ? reasonsRes.data.items : [],
      );
    } catch (err) {
      toast.error("Failed to load setup data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put("/purchase/setup", {
        freight_account_id: setup.freight_account_id || null,
        other_charges_account_id: setup.other_charges_account_id || null,
      });
      toast.success("Purchase setup updated successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save setup");
    } finally {
      setSaving(false);
    }
  }

  function handleReasonChange(id, field, value) {
    setReasons((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function addReason() {
    const newId = Date.now();
    const maxNum = reasons.reduce((mx, r) => {
      const m = (r.reason_code || "").match(/^RJ-?(\d+)$/i);
      return m ? Math.max(mx, parseInt(m[1], 10)) : mx;
    }, 0);
    const nextCode = `RJ-${String(maxNum + 1).padStart(3, "0")}`;
    setReasons((prev) => [
      ...prev,
      { id: newId, reason_code: nextCode, reason_name: "", is_active: 1, _new: true },
    ]);
  }

  function removeReason(id) {
    setReasons((prev) => prev.filter((r) => r.id !== id));
  }

  async function saveReasons() {
    setReasonsSaving(true);
    try {
      const payload = reasons.map((r) => ({
        id: r._new ? undefined : r.id,
        reason_code: r.reason_code,
        reason_name: r.reason_name,
        is_active: r.is_active,
      }));
      await api.post("/purchase/return-rejection-reasons", {
        reasons: payload,
      });
      toast.success("Rejection reasons saved");
      const res = await api.get("/purchase/return-rejection-reasons");
      setReasons(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save rejection reasons",
      );
    } finally {
      setReasonsSaving(false);
    }
  }

  async function deleteReason(id) {
    try {
      await api.delete(`/purchase/return-rejection-reasons/${id}`);
      toast.success("Reason deleted");
      setReasons((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete reason");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading setup...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            ⚙️ Purchase Setup
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Configure default ledger accounts for purchase transactions
          </p>
        </div>
        <Link to="/purchase" className="btn btn-secondary">
          Return to Menu
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold">
                Financial Account Mapping
              </h2>
            </div>
            <div className="card-body space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 text-sm">
                <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Automatic Account Resolution
                </div>
                <p className="text-blue-800 dark:text-blue-200">
                  If these accounts are not configured, the system will use the
                  auto-resolver to find appropriate accounts based on the
                  company's chart of accounts structure.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label">Freight Charges Account</label>
                  <select
                    className="input"
                    value={setup.freight_account_id}
                    onChange={(e) =>
                      setSetup((prev) => ({
                        ...prev,
                        freight_account_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Auto-Resolve (Recommended)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Ledger account to debit for freight/shipping costs.
                  </p>
                </div>

                <div>
                  <label className="label">Other Charges Account</label>
                  <select
                    className="input"
                    value={setup.other_charges_account_id}
                    onChange={(e) =>
                      setSetup((prev) => ({
                        ...prev,
                        other_charges_account_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Auto-Resolve (Recommended)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Ledger account to debit for miscellaneous purchase charges.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-footer bg-slate-50 dark:bg-slate-800/50 p-4 flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving Changes..." : "Save Configuration"}
              </button>
            </div>
          </form>

          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold">Reasons for Rejection</h2>
            </div>
            <div className="card-body space-y-4">
              <p className="text-sm text-slate-600">
                Configure rejection reasons available when processing purchase
                returns.
              </p>
              {reasons.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <label className="label text-xs">Code</label>
                    <input
                      className="input w-24"
                      placeholder="e.g. DAMAGED"
                      value={r.reason_code}
                      onChange={(e) =>
                        handleReasonChange(r.id, "reason_code", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Name</label>
                    <input
                      className="input w-36"
                      placeholder="e.g. Damaged Goods"
                      value={r.reason_name}
                      onChange={(e) =>
                        handleReasonChange(r.id, "reason_name", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Active</label>
                    <select
                      className="input"
                      value={r.is_active ? 1 : 0}
                      onChange={(e) =>
                        handleReasonChange(
                          r.id,
                          "is_active",
                          Number(e.target.value),
                        )
                      }
                    >
                      <option value={1}>Yes</option>
                      <option value={0}>No</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (r._new) {
                          removeReason(r.id);
                        } else {
                          deleteReason(r.id);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addReason}
              >
                Add Reason
              </button>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveReasons}
                  disabled={reasonsSaving}
                >
                  {reasonsSaving ? "Saving..." : "Save Rejection Reasons"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold">Quick Help</h3>
            </div>
            <div className="card-body text-sm space-y-4">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Tax Accounts
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Individual tax component accounts are managed within the
                  Finance module under{" "}
                  <strong>
                    Finance {">"} Setup {">"} Tax Codes
                  </strong>
                  .
                </p>
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Inventory Accounts
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Inventory clearing and stock accounts are resolved per-item
                  based on the Inventory configuration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
