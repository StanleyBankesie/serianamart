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
          {tab === "catalogs" && (
            <div className="space-y-4">
              <SetupItemsEditor
                title="Maintenance Types"
                description="Add each maintenance type individually for request forms."
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
                title="Priorities"
                description="Maintain the allowed priority values individually."
                kind="priorities"
                items={catalogs.priorities}
                draft={drafts.priorities}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
                hideDescription
              />
              <SetupItemsEditor
                title="Execution Types"
                description="Indicate where the order should be done (e.g. In House or by Service Provider)."
                kind="execution-types"
                items={catalogs.executionTypes}
                draft={drafts["execution-types"]}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
              />
            </div>
          )}
          {tab === "structure" && (
            <div className="space-y-4">
              <SetupItemsEditor
                title="Maintenance Sections"
                description="Create the maintenance sections that appear on maintenance requests."
                kind="sections"
                items={catalogs.sections}
                draft={drafts.sections}
                onDraftChange={setDraft}
                onCreate={createItem}
                onSave={saveItem}
                onDelete={deleteItem}
              />
              <SetupItemsEditor
                title="Locations"
                description="Create the locations that appear on maintenance requests."
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
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Section Users
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Link users to a maintenance section and mark whether work should be assigned to them.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="label">Maintenance Section</label>
                    <select
                      className="input"
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
                    <label className="label">User</label>
                    <select
                      className="input"
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
                          {user.full_name || user.username} {user.email ? `- ${user.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="md:col-span-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={assignmentDraft.assign_work}
                      onChange={(e) =>
                        setAssignmentDraft((prev) => ({
                          ...prev,
                          assign_work: e.target.checked,
                        }))
                      }
                    />
                    Assign Work
                  </label>
                  <div className="md:col-span-1">
                    <button type="button" className="btn-primary w-full" onClick={createAssignment}>
                      Add
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>User</th>
                        <th>Email</th>
                        <th>Assign Work</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionUsers.length === 0 && (
                        <tr>
                          <td colSpan="6" className="text-center py-6 text-slate-500">
                            No section users linked
                          </td>
                        </tr>
                      )}
                      {sectionUsers.map((item) => (
                        <tr key={item.id}>
                          <td>{item.section_name}</td>
                          <td>{item.full_name || item.username}</td>
                          <td>{item.email || "-"}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(item.assign_work)}
                              onChange={(e) =>
                                setSectionUsers((prev) =>
                                  prev.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, assign_work: e.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(item.is_active)}
                              onChange={(e) =>
                                setSectionUsers((prev) =>
                                  prev.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, is_active: e.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => saveAssignment(item)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => deleteAssignment(item.id)}
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
            </div>
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
