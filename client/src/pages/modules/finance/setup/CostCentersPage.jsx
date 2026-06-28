/**
 * @fileoverview CostCentersPage component.
 * Provides functionality for CostCentersPage.
 */

import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client";
import { Link } from "react-router-dom";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CostCentersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await api.get("/finance/cost-centers");
      const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setItems(rows);
    } catch (e) {
      setError("Cost center API not available");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateCode = () => {
    const codes = items.map((it) => it.code).filter(Boolean);
    let next = 1;
    while (codes.includes(String(next).padStart(4, "0"))) next++;
    return String(next).padStart(4, "0");
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/finance/cost-centers", {
        code: generateCode(),
        name: form.name,
        is_active: 1,
      });
      setForm({ name: "" });
      setSuccess("Cost center saved successfully");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save cost center");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/finance"
            className="btn btn-sm btn-outline gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Finance
          </Link>
          <h1 className="text-2xl font-bold">Cost Centers</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Manage Cost Centers</div>
        </div>
        <div className="card-body space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {success ? (
            <div className="text-sm text-green-700">{success}</div>
          ) : null}
          <form
            onSubmit={save}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Operations"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                className="btn-primary"
                disabled={saving || !form.name}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center text-slate-500">
                      No cost centers
                    </td>
                  </tr>
                ) : null}
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.code}</td>
                    <td>{it.name}</td>
                    <td>
                      {Number(it.is_active) === 1 ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
