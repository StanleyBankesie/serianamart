import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client";

export default function CostCentersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", name: "" });
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

  const save = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/finance/cost-centers", {
        code: form.code,
        name: form.name,
        is_active: 1,
      });
      setForm({ code: "", name: "" });
      setSuccess("Cost center saved successfully");
      await load();
    } catch (e) {
      setError("Failed to save cost center");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Cost Centers</div>
        </div>
        <div className="card-body space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {success ? (
            <div className="text-sm text-green-700">{success}</div>
          ) : null}
          <form
            onSubmit={save}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div>
              <label className="label">Code</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="OPS"
                required
              />
            </div>
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
                disabled={saving || !form.code || !form.name}
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
