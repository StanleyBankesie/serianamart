/**
 * @fileoverview MaintenanceJobOrderForm component.
 * Provides functionality for MaintenanceJobOrderForm.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const ORDER_TYPES = [
  "Corrective",
  "Preventive",
  "Predictive",
  "Emergency",
  "Routine",
];
const STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceJobOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;

  const [form, setForm] = useState({
    order_no: "",
    order_date: new Date().toISOString().slice(0, 10),
    request_id: params.get("request_id") || "",
    asset_name: decodeURIComponent(params.get("asset_name") || ""),
    order_type: "",
    job_order_type: "Planned",
    assigned_team: "",
    assigned_technician: "",
    location: "",
    supervisor: "",
    service_provider: "",
    scheduled_date: "",
    instructions: "",
    status: "DRAFT",
    notes: "",
  });
  const [requests, setRequests] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [setupCatalogs, setSetupCatalogs] = useState({ supervisors: [], technicians: [], teams: [], serviceProviders: [], jobOrderTypes: [] });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
      api
        .get("/maintenance/maintenance-requests")
        .then((r) => {
          if (mounted)
            setRequests((Array.isArray(r.data?.items) ? r.data.items : []).filter(req => String(req.status).toUpperCase() === "APPROVED"));
        })
        .catch(() => {});
    api
      .get("/maintenance/equipment")
      .then((r) => {
        if (mounted)
          setEquipment(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {});
    api
      .get("/maintenance/setup/catalog")
      .then((r) => {
        if (mounted) {
          const c = r.data?.catalogs || {};
          setSetupCatalogs({
            supervisors: Array.isArray(c.supervisors) ? c.supervisors : [],
            technicians: Array.isArray(c.technicians) ? c.technicians : [],
            teams: Array.isArray(c.teams) ? c.teams : [],
            serviceProviders: Array.isArray(c.serviceProviders) ? c.serviceProviders : [],
            jobOrderTypes: Array.isArray(c.jobOrderTypes) ? c.jobOrderTypes : [],
          });
        }
      })
      .catch(() => {});
    if (isEdit) {
      api
        .get(`/maintenance/job-orders/${id}`)
        .then((r) => {
          const item = r.data?.item || {};
          if (mounted)
            setForm((p) => ({
              ...p,
              ...item,
              order_date: (item.order_date || "").slice(0, 10),
              scheduled_date: (item.scheduled_date || "").slice(0, 10),
            }));
        })
        .catch(() => toast.error("Failed to load job order"));
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.order_date || !form.order_type) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance/job-orders/${id}`, form);
        toast.success("Job order updated");
      } else {
        const r = await api.post("/maintenance/job-orders", form);
        toast.success(`Job order ${r.data?.order_no} created`);
      }
      navigate("/maintenance/job-orders", { state: { refresh: true } });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance/job-orders" className="btn-secondary">
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit" : "New"} Job Order
          </h1>
          <p className="text-sm mt-1">
            Create and assign a maintenance job order
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">
            Job Order Details
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Order Date *</label>
                <input
                  className="input w-[216px]"
                  type="date"
                  value={form.order_date}
                  onChange={(e) => update("order_date", e.target.value)}
                  required
                />
            </div>
            <div>
              <label className="label">Linked Request</label>
              <select
                  className="input w-[216px]"
                  value={form.request_id}
                  onChange={(e) => update("request_id", e.target.value)}
                >
                  <option value="">-- None --</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.request_no}
                    </option>
                  ))}
                </select>
            </div>
            <div>
              <label className="label">Equipment / Asset</label>
                <select
                  className="input w-[216px]"
                  value={form.asset_name}
                  onChange={(e) => update("asset_name", e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.equipment_name}>
                      {eq.equipment_code} – {eq.equipment_name}
                    </option>
                  ))}
                </select>
            </div>
            <div>
              <label className="label">Order Type *</label>
                <select
                  className="input w-[216px]"
                  value={form.order_type}
                  onChange={(e) => update("order_type", e.target.value)}
                  required
                >
                  <option value="">-- Select Type --</option>
                  {ORDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
            </div>
            <div>
              <label className="label">Job Order Type *</label>
                <select
                  className="input w-[216px]"
                  value={form.job_order_type}
                  onChange={(e) => update("job_order_type", e.target.value)}
              >
                <option value="">-- Select --</option>
                {setupCatalogs.jobOrderTypes.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.item_name}>{t.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Scheduled Date</label>
                <input
                  className="input w-[216px]"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => update("scheduled_date", e.target.value)}
                />
            </div>
            <div>
              <label className="label">Location</label>
                <input
                  className="input w-[216px]"
                  value={form.location || ""}
                  onChange={(e) => update("location", e.target.value)}
                placeholder="Location"
              />
            </div>
            <div>
              <label className="label">Supervisor</label>
                <select
                  className="input w-[216px]"
                  value={form.supervisor || ""}
                  onChange={(e) => update("supervisor", e.target.value)}
              >
                <option value="">-- Select --</option>
                {setupCatalogs.supervisors.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.item_name}>{s.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Service Provider</label>
                <select
                  className="input w-[216px]"
                  value={form.service_provider || ""}
                  onChange={(e) => update("service_provider", e.target.value)}
              >
                <option value="">-- Select --</option>
                {setupCatalogs.serviceProviders.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.item_name}>{s.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assigned Team</label>
                <select
                  className="input w-[216px]"
                  value={form.assigned_team}
                  onChange={(e) => update("assigned_team", e.target.value)}
              >
                <option value="">-- Select --</option>
                {setupCatalogs.teams.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.item_name}>{t.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assigned Technician</label>
                <select
                  className="input w-[216px]"
                  value={form.assigned_technician}
                  onChange={(e) => update("assigned_technician", e.target.value)}
              >
                <option value="">-- Select --</option>
                {setupCatalogs.technicians.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.item_name}>{t.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
                <select
                  className="input w-[216px]"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <div className="flex-1">
                <label className="label">Instructions</label>
                <textarea
                  className="input w-96"
                  rows={7}
                  value={form.instructions}
                  onChange={(e) => update("instructions", e.target.value)}
                  placeholder="Work instructions and scope..."
                />
              </div>
              <div className="flex-1">
                <label className="label">Notes</label>
                <textarea
                  className="input w-96"
                  rows={7}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/maintenance/job-orders" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Job Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
