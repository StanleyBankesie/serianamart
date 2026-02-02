import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";

export default function MaintenanceWorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const readOnly = mode === "view";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    woNo: "",
    assetNo: "AST-001",
    description: "",
    priority: "MEDIUM",
    status: "OPEN",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchWorkOrder();
  }, [id]);

  async function fetchWorkOrder() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/maintenance/work-orders/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching work order");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isEdit) {
        await api.put(`/maintenance/work-orders/${id}`, form);
      } else {
        await api.post("/maintenance/work-orders", form);
      }
      navigate("/maintenance/work-orders");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving work order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/maintenance/work-orders"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to Work Orders
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {readOnly
            ? "View Work Order"
            : isEdit
              ? "Edit Work Order"
              : "New Work Order"}
        </h1>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <fieldset disabled={readOnly}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">WO No</label>
                  <input
                    className="input"
                    value={form.woNo}
                    onChange={(e) => update("woNo", e.target.value)}
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="label">Asset No</label>
                  <input
                    className="input"
                    value={form.assetNo}
                    onChange={(e) => update("assetNo", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <input
                    className="input"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) => update("priority", e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </fieldset>
            <div className="flex justify-end gap-3">
              <Link to="/maintenance/work-orders" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" disabled={loading || readOnly}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
