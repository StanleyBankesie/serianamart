import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const DEFAULT_PARAMS = {
  maintenance_types: "Corrective,Preventive,Predictive,Emergency,Routine",
  priority_levels: "LOW,NORMAL,HIGH,CRITICAL",
  resolution_codes: "REPAIRED,REPLACED,SCHEDULED,DEFERRED,NO_FAULT_FOUND",
  default_currency: "GHS",
  warranty_alert_days: "30",
  rfq_response_days: "7",
  notify_email: "",
  auto_schedule_enabled: "false",
};

const TAB_LABELS = [
  { key: "general", label: "General" },
  { key: "types", label: "Maintenance Types" },
  { key: "notifications", label: "Notifications" },
  { key: "scheduling", label: "Scheduling" },
];

export default function MaintenanceSetupPage() {
  const [tab, setTab] = useState("general");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let m = true;
    api.get("/maintenance/parameters")
      .then(r => { if (m && r.data?.params) setParams(p => ({ ...p, ...r.data.params })); })
      .catch(() => {});
    return () => { m = false; };
  }, []);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.put("/maintenance/parameters", { params });
      toast.success("Settings saved");
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/maintenance" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Maintenance Setup</h1>
          <p className="text-sm mt-1">Configure maintenance parameters and system settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TAB_LABELS.map(t => (
          <button key={t.key} type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400"}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          {tab === "general" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Default Currency</label>
                  <input className="input" value={params.default_currency} onChange={e => set("default_currency", e.target.value)} />
                </div>
                <div>
                  <label className="label">Warranty Alert (days before expiry)</label>
                  <input className="input" type="number" value={params.warranty_alert_days} onChange={e => set("warranty_alert_days", e.target.value)} />
                </div>
                <div>
                  <label className="label">RFQ Default Response Days</label>
                  <input className="input" type="number" value={params.rfq_response_days} onChange={e => set("rfq_response_days", e.target.value)} />
                </div>
              </div>
            </>
          )}
          {tab === "types" && (
            <>
              <div>
                <label className="label">Maintenance Types (comma-separated)</label>
                <textarea className="input" rows={3} value={params.maintenance_types} onChange={e => set("maintenance_types", e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">These values appear in maintenance request dropdowns.</p>
              </div>
              <div>
                <label className="label">Priority Levels (comma-separated)</label>
                <textarea className="input" rows={2} value={params.priority_levels} onChange={e => set("priority_levels", e.target.value)} />
              </div>
              <div>
                <label className="label">Resolution Codes (comma-separated)</label>
                <textarea className="input" rows={3} value={params.resolution_codes} onChange={e => set("resolution_codes", e.target.value)} />
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <div>
                <label className="label">Notification Email</label>
                <input className="input" type="email" value={params.notify_email} onChange={e => set("notify_email", e.target.value)} placeholder="maintenance@company.com" />
                <p className="text-xs text-slate-500 mt-1">Receives alerts for overdue schedules and warranty expirations.</p>
              </div>
            </>
          )}
          {tab === "scheduling" && (
            <>
              <div className="flex items-center gap-3">
                <label className="label mb-0">Auto-Schedule from PM Calendar</label>
                <select className="input w-40" value={params.auto_schedule_enabled} onChange={e => set("auto_schedule_enabled", e.target.value)}>
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">When enabled, the system will auto-create job orders from due PM schedules.</p>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
      </div>
    </div>
  );
}
