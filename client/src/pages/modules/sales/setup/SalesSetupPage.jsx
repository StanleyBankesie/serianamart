import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Link } from "react-router-dom";
import { Trash2, Plus, Save, RotateCcw } from "lucide-react";

export default function SalesSetupPage() {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing return reasons
  async function loadReasons() {
    try {
      setLoading(true);
      const res = await api.get("/sales/return-reasons");
      setReasons(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load return reasons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReasons();
  }, []);

  // Handle local text changes in the reasons rows
  function handleReasonChange(index, field, value) {
    setReasons((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  // Add an empty row for a new reason
  function handleAddRow() {
    setReasons((prev) => [
      ...prev,
      {
        id: "",
        reason_code: "",
        reason_name: "",
        is_active: 1,
      },
    ]);
  }

  // Remove a row (delete from database if saved, or just remove from state if not saved)
  async function handleRemoveRow(index, id) {
    if (!id) {
      setReasons((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    if (!window.confirm("Are you sure you want to delete this return reason?")) {
      return;
    }

    try {
      setSaving(true);
      await api.delete(`/sales/return-reasons/${id}`);
      toast.success("Return reason deleted successfully");
      setReasons((prev) => prev.filter((_, i) => i !== index));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete return reason");
    } finally {
      setSaving(false);
    }
  }

  // Save all reasons to the backend
  async function handleSave() {
    // Validate inputs
    const invalid = reasons.some((r) => !r.reason_code.trim() || !r.reason_name.trim());
    if (invalid) {
      toast.error("Please fill in both the Reason Code and Reason Name for all rows.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/sales/return-reasons", { reasons });
      toast.success("Sales return reasons saved successfully");
      await loadReasons();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save return reasons");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Sales Module Setup</h1>
            <p className="text-sm mt-1">Configure return workflows, reasons, and parameters</p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary shadow-sm">
              Return to Menu
            </Link>
            <button
              className="btn btn-secondary flex items-center gap-1"
              onClick={loadReasons}
              disabled={loading || saving}
            >
              <RotateCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Return Reasons Configuration Card */}
      <div className="card">
        <div className="card-header bg-brand/10 dark:bg-brand/20 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Reasons for Return Configuration
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-1"
            onClick={handleAddRow}
            disabled={loading || saving}
          >
            <Plus className="w-4 h-4" />
            Add Reason
          </button>
        </div>
        <div className="card-body p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              <div className="mt-2 text-slate-600 dark:text-slate-400">Loading configurations...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Reason Code *</th>
                      <th style={{ width: "50%" }}>Reason Name / Description *</th>
                      <th style={{ width: "12%", textAlign: "center" }}>Status</th>
                      <th style={{ width: "8%", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reasons.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-500">
                          No return reasons configured. Click "Add Reason" to create one.
                        </td>
                      </tr>
                    ) : (
                      reasons.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td>
                            <input
                              className="input font-semibold"
                              placeholder="e.g. DAMAGED"
                              value={r.reason_code}
                              onChange={(e) =>
                                handleReasonChange(idx, "reason_code", e.target.value.toUpperCase().replace(/\s+/g, "_"))
                              }
                              disabled={saving}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              placeholder="e.g. Item Damaged in Transit"
                              value={r.reason_name}
                              onChange={(e) => handleReasonChange(idx, "reason_name", e.target.value)}
                              disabled={saving}
                            />
                          </td>
                          <td className="text-center">
                            <select
                              className="input text-center"
                              value={r.is_active}
                              onChange={(e) => handleReasonChange(idx, "is_active", Number(e.target.value))}
                              disabled={saving}
                            >
                              <option value={1}>Active</option>
                              <option value={0}>Inactive</option>
                            </select>
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline hover:bg-red-500 hover:text-white p-2 rounded-lg text-red-500 border border-slate-200 dark:border-slate-700"
                              onClick={() => handleRemoveRow(idx, r.id)}
                              disabled={saving}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {reasons.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    className="btn btn-success flex items-center gap-1 px-6"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
