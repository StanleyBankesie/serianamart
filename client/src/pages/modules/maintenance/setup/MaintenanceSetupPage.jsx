import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";

const DEFAULT_PARAMS = {
  default_currency: "GHS",
  warranty_alert_days: "30",
  rfq_response_days: "7",
  notify_email: "",
  auto_schedule_enabled: "false",
};

const TAB_LABELS = [
  { key: "general", label: "General" },
  { key: "catalogs", label: "Codes" },
  { key: "structure", label: "Sections & Locations" },
  { key: "assignments", label: "Assignments" },
  { key: "notifications", label: "Notifications" },
  { key: "scheduling", label: "Scheduling" },
];

const EMPTY_ITEM = {
  item_name: "",
  description: "",
  sort_order: "",
  is_active: true,
};

function SetupItemsEditor({
  title,
  description,
  kind,
  items,
  draft,
  onDraftChange,
  onCreate,
  onSave,
  onDelete,
  hideDescription = false,
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className={hideDescription ? "md:col-span-8" : "md:col-span-4"}>
          <label className="label">Name</label>
          <input
            className="input"
            value={draft.item_name}
            onChange={(e) => onDraftChange(kind, "item_name", e.target.value)}
          />
        </div>
        {!hideDescription && (
        <div className="md:col-span-4">
          <label className="label">Description</label>
          <input
            className="input"
            value={draft.description}
            onChange={(e) => onDraftChange(kind, "description", e.target.value)}
          />
        </div>
        )}
        <div className="md:col-span-2">
          <label className="label">Order</label>
          <input
            className="input"
            type="number"
            value={draft.sort_order}
            onChange={(e) => onDraftChange(kind, "sort_order", e.target.value)}
          />
        </div>
        <label className="md:col-span-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={Boolean(draft.is_active)}
            onChange={(e) => onDraftChange(kind, "is_active", e.target.checked)}
          />
          Active
        </label>
        <div className="md:col-span-1">
          <button type="button" className="btn-primary w-full" onClick={() => onCreate(kind)}>
            Add
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {!hideDescription && <th>Description</th>}
              <th>Order</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={hideDescription ? "4" : "5"} className="text-center py-6 text-slate-500">
                  No records found
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    className="input"
                    value={item.item_name || ""}
                    onChange={(e) => onSave(kind, { ...item, item_name: e.target.value }, true)}
                  />
                </td>
                {!hideDescription && (
                <td>
                  <input
                    className="input"
                    value={item.description || ""}
                    onChange={(e) => onSave(kind, { ...item, description: e.target.value }, true)}
                  />
                </td>
                )}
                <td>
                  <input
                    className="input"
                    type="number"
                    value={item.sort_order ?? 0}
                    onChange={(e) =>
                      onSave(kind, { ...item, sort_order: e.target.value }, true)
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(item.is_active)}
                    onChange={(e) =>
                      onSave(kind, { ...item, is_active: e.target.checked }, false)
                    }
                  />
                </td>
                <td className="whitespace-nowrap space-x-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => onSave(kind, item, false)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    onClick={() => onDelete(kind, item.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MaintenanceSetupPage() {
  const [tab, setTab] = useState("general");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [catalogs, setCatalogs] = useState({
    maintenanceTypes: [],
    priorities: [],
    executionTypes: [],
    sections: [],
    locations: [],
  });
  const [sectionUsers, setSectionUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({
    "maintenance-types": { ...EMPTY_ITEM },
    priorities: { ...EMPTY_ITEM },
    "execution-types": { ...EMPTY_ITEM },
    sections: { ...EMPTY_ITEM },
    locations: { ...EMPTY_ITEM },
  });
  const [assignmentDraft, setAssignmentDraft] = useState({
    section_item_id: "",
    user_id: "",
    assign_work: true,
  });
  const [saving, setSaving] = useState(false);

  async function loadSetup() {
    const [catalogRes, paramRes] = await Promise.all([
      api.get("/maintenance/setup/catalog"),
      api.get("/maintenance/parameters").catch(() => ({ data: { params: {} } })),
    ]);

    setCatalogs(catalogRes.data?.catalogs || {
      maintenanceTypes: [],
      priorities: [],
      executionTypes: [],
      sections: [],
      locations: [],
    });
    setSectionUsers(Array.isArray(catalogRes.data?.sectionUsers) ? catalogRes.data.sectionUsers : []);
    setUsers(Array.isArray(catalogRes.data?.users) ? catalogRes.data.users : []);
    setParams((prev) => ({ ...prev, ...(paramRes.data?.params || {}), ...(catalogRes.data?.params || {}) }));
  }

  useEffect(() => {
    let m = true;
    loadSetup().catch(() => {
      if (m) toast.error("Failed to load setup");
    });
    return () => { m = false; };
  }, []);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const setDraft = (kind, key, value) =>
    setDrafts((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [key]: value },
    }));

  async function save() {
    setSaving(true);
    try {
      await api.put("/maintenance/parameters", { params });
      toast.success("Settings saved");
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  async function createItem(kind) {
    const payload = drafts[kind];
    if (!String(payload.item_name || "").trim()) {
      toast.error("Item name is required");
      return;
    }
    try {
      await api.post(`/maintenance/setup/catalog/${kind}`, payload);
      setDrafts((prev) => ({ ...prev, [kind]: { ...EMPTY_ITEM } }));
      await loadSetup();
      toast.success("Item added");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to add item");
    }
  }

  async function saveItem(kind, item, silent = false) {
    setCatalogs((prev) => {
      const mapping = {
        "maintenance-types": "maintenanceTypes",
        priorities: "priorities",
        "execution-types": "executionTypes",
        sections: "sections",
        locations: "locations",
      };
      const key = mapping[kind];
      return {
        ...prev,
        [key]: prev[key].map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                ...item,
                sort_order: item.sort_order === "" ? 0 : Number(item.sort_order || 0),
                is_active: Boolean(item.is_active),
              }
            : entry,
        ),
      };
    });

    if (silent) return;

    try {
      await api.put(`/maintenance/setup/catalog/${kind}/${item.id}`, {
        ...item,
        sort_order: item.sort_order === "" ? 0 : Number(item.sort_order || 0),
        is_active: item.is_active ? 1 : 0,
      });
      await loadSetup();
      toast.success("Item updated");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update item");
    }
  }

  async function deleteItem(kind, id) {
    try {
      await api.delete(`/maintenance/setup/catalog/${kind}/${id}`);
      await loadSetup();
      toast.success("Item deleted");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete item");
    }
  }

  async function createAssignment() {
    if (!assignmentDraft.section_item_id || !assignmentDraft.user_id) {
      toast.error("Select a maintenance section and user");
      return;
    }
    try {
      await api.post("/maintenance/setup/section-users", {
        section_item_id: Number(assignmentDraft.section_item_id),
        user_id: Number(assignmentDraft.user_id),
        assign_work: assignmentDraft.assign_work ? 1 : 0,
      });
      setAssignmentDraft({ section_item_id: "", user_id: "", assign_work: true });
      await loadSetup();
      toast.success("User linked to maintenance section");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save assignment");
    }
  }

  async function saveAssignment(item) {
    try {
      await api.put(`/maintenance/setup/section-users/${item.id}`, {
        section_item_id: Number(item.section_item_id),
        user_id: Number(item.user_id),
        assign_work: item.assign_work ? 1 : 0,
        is_active: item.is_active ? 1 : 0,
      });
      await loadSetup();
      toast.success("Assignment updated");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update assignment");
    }
  }

  async function deleteAssignment(id) {
    try {
      await api.delete(`/maintenance/setup/section-users/${id}`);
      await loadSetup();
      toast.success("Assignment removed");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to remove assignment");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Maintenance Setup</h1>
            <p className="text-slate-500 text-sm">Configure maintenance parameters and system settings</p>
          </div>
        </div>
        <button type="button" className="btn-success px-8" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {TAB_LABELS.map(t => (
          <button key={t.key} type="button"
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${tab === t.key ? "border-brand-600 text-brand-600 bg-brand-50/50" : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500"}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="card p-8">
        <div className="space-y-8">
          {tab === "general" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                 <h2 className="font-bold uppercase text-xs tracking-wider">Financial & Service Limits</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="label">Default Currency</label>
                  <input className="input w-full" value={params.default_currency} onChange={e => set("default_currency", e.target.value)} />
                </div>
                <div>
                  <label className="label">Warranty Alert (days)</label>
                  <input className="input w-full" type="number" value={params.warranty_alert_days} onChange={e => set("warranty_alert_days", e.target.value)} />
                </div>
                <div>
                  <label className="label">RFQ Response Deadline (days)</label>
                  <input className="input w-full" type="number" value={params.rfq_response_days} onChange={e => set("rfq_response_days", e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {tab === "catalogs" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Maintenance Classification"
                description="Define service categories for request sorting."
                kind="maintenance-types"
                items={catalogs.maintenanceTypes}
                draft={drafts["maintenance-types"]}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
                hideDescription
              />
              <SetupItemsEditor
                title="Service Priorities"
                description="Manage allowed urgency levels for work orders."
                kind="priorities"
                items={catalogs.priorities}
                draft={drafts.priorities}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
                hideDescription
              />
            </div>
          )}
          {tab === "structure" && (
            <div className="space-y-8">
              <SetupItemsEditor
                title="Facility Sections"
                description="Manage physical or logical areas of maintenance."
                kind="sections"
                items={catalogs.sections}
                draft={drafts.sections}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
              />
              <SetupItemsEditor
                title="Sub-Locations"
                description="Specific points or bins within sections."
                kind="locations"
                items={catalogs.locations}
                draft={drafts.locations}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
              />
            </div>
          )}
          {tab === "assignments" && (
            <div className="space-y-6">
              <div className="card bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-6 border-dashed">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Technical Resource Assignment
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Link technicians to specific facility sections.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="label">Section</label>
                    <select
                      className="input w-full"
                      value={assignmentDraft.section_item_id}
                      onChange={(e) =>
                        setAssignmentDraft((prev) => ({
                          ...prev,
                          section_item_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select Section --</option>
                      {catalogs.sections
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <label className="label">User/Technician</label>
                    <select
                      className="input w-full"
                      value={assignmentDraft.user_id}
                      onChange={(e) =>
                        setAssignmentDraft((prev) => ({
                          ...prev,
                          user_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select User --</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.username} {user.email ? `(${user.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="btn-success w-full" onClick={createAssignment}>
                      Add Link
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Resource</th>
                      <th>Communication</th>
                      <th>Work Flow</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sectionUsers.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-10 text-slate-400 italic">No resources assigned.</td></tr>
                    ) : sectionUsers.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold text-slate-900 dark:text-slate-200">{item.section_name}</td>
                        <td className="text-sm font-medium">{item.full_name || item.username}</td>
                        <td className="text-xs text-slate-500">{item.email || "-"}</td>
                        <td>
                           <div className="flex items-center gap-3">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={Boolean(item.assign_work)} onChange={e => {
                                   setSectionUsers(prev => prev.map(en => en.id === item.id ? { ...en, assign_work: e.target.checked } : en));
                                }} />
                                <span className="text-[10px] font-bold uppercase text-slate-500">Assign</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={Boolean(item.is_active)} onChange={e => {
                                   setSectionUsers(prev => prev.map(en => en.id === item.id ? { ...en, is_active: e.target.checked } : en));
                                }} />
                                <span className="text-[10px] font-bold uppercase text-slate-500">Active</span>
                             </label>
                           </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                             <button type="button" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" onClick={() => saveAssignment(item)} title="Save changes"><Save size={16} /></button>
                             <button type="button" className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" onClick={() => deleteAssignment(item.id)} title="Remove assignment">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "notifications" && (
            <div className="max-w-xl space-y-4">
               <div>
                  <label className="label">Master Alert Email</label>
                  <input className="input w-full" type="email" value={params.notify_email} onChange={e => set("notify_email", e.target.value)} placeholder="maintenance@enterprise.com" />
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Receives global alerts for overdue schedules and critical faults.</p>
               </div>
            </div>
          )}
          {tab === "scheduling" && (
            <div className="max-w-xl space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">PM Auto-Generation</div>
                  <div className="text-xs text-slate-500">Automatically spawn job orders from due PM schedules.</div>
                </div>
                <select className="input w-32" value={params.auto_schedule_enabled} onChange={e => set("auto_schedule_enabled", e.target.value)}>
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
