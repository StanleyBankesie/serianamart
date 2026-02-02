import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";

export default function WorkOrderForm() {
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
    product: "",
    qty: 0,
    status: "PLANNED",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchWorkOrder();
  }, [id]);

  async function fetchWorkOrder() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/production/work-orders/${id}`);
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
        await api.put(`/production/work-orders/${id}`, form);
      } else {
        await api.post("/production/work-orders", form);
      }
      navigate("/production/work-orders");
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
          to="/production/work-orders"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to Work Orders
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {readOnly ? "View Work Order" : isEdit ? "Edit Work Order" : "New Work Order"}
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
                <label className="label">Product *</label>
                <input
                  className="input"
                  value={form.product}
                  onChange={(e) => update("product", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Qty</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.qty}
                  onChange={(e) => update("qty", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="PLANNED">Planned</option>
                  <option value="RELEASED">Released</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              </div>
            </fieldset>
            <div className="flex justify-end gap-3">
              <Link to="/production/work-orders" className="btn-success">
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







