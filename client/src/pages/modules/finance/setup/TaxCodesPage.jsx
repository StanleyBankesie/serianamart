import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";

export default function TaxCodesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [type, setType] = useState("TAX");
  const [isActive, setIsActive] = useState(true);

  const [editing, setEditing] = useState({});
  const [selectedTaxId, setSelectedTaxId] = useState(null);
  const [selectedTax, setSelectedTax] = useState(null);
  const [components, setComponents] = useState([]);
  const [compName, setCompName] = useState("");
  const [compRate, setCompRate] = useState("");
  const [compOrder, setCompOrder] = useState("");
  const [compActive, setCompActive] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/tax-codes");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load tax codes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadComponents(taxId) {
    try {
      const res = await api.get(`/finance/tax-codes/${taxId}/components`);
      setComponents(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load tax components"
      );
    }
  }

  function showComponents(r) {
    setSelectedTaxId(r.id);
    setSelectedTax(r);
    setCompName("");
    setCompRate("");
    setCompOrder("");
    setCompActive(true);
    loadComponents(r.id);
  }

  async function addComponent(e) {
    e.preventDefault();
    if (!selectedTaxId) return;
    try {
      await api.post(`/finance/tax-codes/${selectedTaxId}/components`, {
        componentName: compName.trim(),
        ratePercent: compRate ? Number(compRate) : 0,
        sortOrder: compOrder ? Number(compOrder) : 100,
        isActive: compActive,
      });
      toast.success("Component added");
      setCompName("");
      setCompRate("");
      setCompOrder("");
      setCompActive(true);
      loadComponents(selectedTaxId);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to add tax component");
    }
  }

  const [compEditing, setCompEditing] = useState({});

  function compStartEdit(c) {
    setCompEditing((p) => ({
      ...p,
      [c.id]: {
        component_name: c.component_name,
        rate_percent: c.rate_percent,
        sort_order: c.sort_order,
        is_active: c.is_active,
      },
    }));
  }

  function compUpdateEdit(id, field, value) {
    setCompEditing((p) => ({
      ...p,
      [id]: { ...(p[id] || {}), [field]: value },
    }));
  }

  async function compSaveEdit(id) {
    const data = compEditing[id];
    if (!data) return;
    try {
      await api.put(`/finance/tax-components/${id}`, {
        componentName: data.component_name,
        ratePercent:
          data.rate_percent === "" || data.rate_percent === null
            ? undefined
            : Number(data.rate_percent),
        sortOrder:
          data.sort_order === "" || data.sort_order === null
            ? undefined
            : Number(data.sort_order),
        isActive: data.is_active,
      });
      toast.success("Component updated");
      setCompEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      loadComponents(selectedTaxId);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update component");
    }
  }

  async function compDisable(id) {
    if (!window.confirm("Disable this component?")) return;
    try {
      await api.delete(`/finance/tax-components/${id}`);
      toast.success("Component disabled");
      setCompEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      loadComponents(selectedTaxId);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to disable component");
    }
  }

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/tax-codes", {
        code: code.trim(),
        name: name.trim(),
        ratePercent: ratePercent ? Number(ratePercent) : 0,
        type,
        isActive,
      });
      toast.success("Tax code created");
      setCode("");
      setName("");
      setRatePercent("");
      setType("TAX");
      setIsActive(true);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create tax code");
    }
  }

  function startEdit(r) {
    setEditing((p) => ({
      ...p,
      [r.id]: {
        name: r.name,
        rate_percent: r.rate_percent,
        type: r.type,
        is_active: r.is_active,
      },
    }));
  }

  function updateEdit(id, field, value) {
    setEditing((p) => ({
      ...p,
      [id]: { ...(p[id] || {}), [field]: value },
    }));
  }

  async function saveEdit(id) {
    const data = editing[id];
    if (!data) return;
    try {
      await api.put(`/finance/tax-codes/${id}`, {
        name: data.name,
        ratePercent:
          data.rate_percent === "" || data.rate_percent === null
            ? undefined
            : Number(data.rate_percent),
        type: data.type,
        isActive: data.is_active,
      });
      toast.success("Tax code updated");
      setEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to update tax code");
    }
  }

  function cancelEdit(id) {
    setEditing((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function toggleActive(r) {
    try {
      await api.put(`/finance/tax-codes/${r.id}`, {
        isActive: !r.is_active,
      });
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to toggle status");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Tax Codes & Deductions
            </h1>
            <p className="text-sm mt-1">
              Configure tax and deduction codes used across modules
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn btn-secondary"
              onClick={load}
              disabled={loading}
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
              <label className="label">Code *</label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Rate (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Type *</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
              >
                <option value="TAX">Tax</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
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
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Rate (%)</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const isRowEditing = !!editing[r.id];
                  const draft = editing[r.id] || {};
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.code}</td>
                      <td>
                        {isRowEditing ? (
                          <input
                            className="input"
                            value={draft.name ?? ""}
                            onChange={(e) =>
                              updateEdit(r.id, "name", e.target.value)
                            }
                          />
                        ) : (
                          r.name
                        )}
                      </td>
                      <td>
                        {isRowEditing ? (
                          <select
                            className="input"
                            value={draft.type ?? "TAX"}
                            onChange={(e) =>
                              updateEdit(r.id, "type", e.target.value)
                            }
                          >
                            <option value="TAX">Tax</option>
                            <option value="DEDUCTION">Deduction</option>
                          </select>
                        ) : (
                          r.type
                        )}
                      </td>
                      <td>
                        {isRowEditing ? (
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              draft.rate_percent === undefined
                                ? r.rate_percent
                                : draft.rate_percent
                            }
                            onChange={(e) =>
                              updateEdit(r.id, "rate_percent", e.target.value)
                            }
                          />
                        ) : (
                          Number(r.rate_percent || 0).toFixed(2)
                        )}
                      </td>
                      <td>
                        {isRowEditing ? (
                          <select
                            className="input"
                            value={(draft.is_active ? 1 : 0).toString()}
                            onChange={(e) =>
                              updateEdit(
                                r.id,
                                "is_active",
                                e.target.value === "1"
                              )
                            }
                          >
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                        ) : r.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-error">Inactive</span>
                        )}
                      </td>
                      <td className="text-right">
                        {!isRowEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn btn-secondary"
                              onClick={() => startEdit(r)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn"
                              onClick={() => showComponents(r)}
                            >
                              Components
                            </button>
                            <button
                              className="btn"
                              onClick={() => toggleActive(r)}
                            >
                              {r.is_active ? "Disable" : "Enable"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-success"
                              onClick={() => saveEdit(r.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn"
                              onClick={() => cancelEdit(r.id)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTaxId && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Components for {selectedTax?.code} - {selectedTax?.name}
              </h2>
              <p className="text-sm">Define composite taxes/deductions</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => loadComponents(selectedTaxId)}
              >
                Refresh
              </button>
              <button className="btn" onClick={() => setSelectedTaxId(null)}>
                Close
              </button>
            </div>
          </div>
          <div className="card-body space-y-4">
            <form
              onSubmit={addComponent}
              className="grid grid-cols-1 md:grid-cols-6 gap-3"
            >
              <div className="md:col-span-2">
                <label className="label">Component Name *</label>
                <input
                  className="input"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Rate (%)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={compRate}
                  onChange={(e) => setCompRate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={compOrder}
                  onChange={(e) => setCompOrder(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={compActive}
                    onChange={(e) => setCompActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <div className="flex items-end">
                <button className="btn-success">Add Component</button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Rate (%)</th>
                    <th>Sort</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => {
                    const isEdit = !!compEditing[c.id];
                    const d = compEditing[c.id] || {};
                    return (
                      <tr key={c.id}>
                        <td className="font-medium">
                          {isEdit ? (
                            <input
                              className="input"
                              value={
                                d.component_name === undefined
                                  ? c.component_name
                                  : d.component_name
                              }
                              onChange={(e) =>
                                compUpdateEdit(
                                  c.id,
                                  "component_name",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            c.component_name
                          )}
                        </td>
                        <td>
                          {isEdit ? (
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                d.rate_percent === undefined
                                  ? c.rate_percent
                                  : d.rate_percent
                              }
                              onChange={(e) =>
                                compUpdateEdit(
                                  c.id,
                                  "rate_percent",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            Number(c.rate_percent || 0).toFixed(2)
                          )}
                        </td>
                        <td>
                          {isEdit ? (
                            <input
                              className="input"
                              type="number"
                              min="0"
                              value={
                                d.sort_order === undefined
                                  ? c.sort_order
                                  : d.sort_order
                              }
                              onChange={(e) =>
                                compUpdateEdit(
                                  c.id,
                                  "sort_order",
                                  e.target.value
                                )
                              }
                            />
                          ) : (
                            c.sort_order
                          )}
                        </td>
                        <td>
                          {isEdit ? (
                            <select
                              className="input"
                              value={(d.is_active ? 1 : 0).toString()}
                              onChange={(e) =>
                                compUpdateEdit(
                                  c.id,
                                  "is_active",
                                  e.target.value === "1"
                                )
                              }
                            >
                              <option value="1">Active</option>
                              <option value="0">Inactive</option>
                            </select>
                          ) : c.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </td>
                        <td className="text-right">
                          {!isEdit ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="btn btn-secondary"
                                onClick={() => compStartEdit(c)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn"
                                onClick={() => compDisable(c.id)}
                              >
                                Disable
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                className="btn-success"
                                onClick={() => compSaveEdit(c.id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn"
                                onClick={() =>
                                  setCompEditing((p) => {
                                    const n = { ...p };
                                    delete n[c.id];
                                    return n;
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {components.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-6 text-slate-600"
                      >
                        No components defined
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
