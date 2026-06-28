/**
 * @fileoverview Setup component.
 * Provides functionality for Setup.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, User, Trash2, Plus, X, Pencil, Building2, Warehouse } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/* ─────────────────────────────────────── helpers ─── */
function ModalForm({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────── Generic CRUD Section ─── */
function CrudSection({ title, icon, emptyMsg, columns, rows, loading, onAdd, onEdit, onDelete, renderRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <button onClick={onAdd} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              {columns.map(c => <th key={c} className="px-4 py-3">{c}</th>)}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : rows.length > 0 ? rows.map(row => (
              <tr key={row.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                {renderRow(row)}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(row)} className="p-1.5 text-brand hover:text-brand-700 rounded hover:bg-brand-50 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(row.id)} className="p-1.5 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">{emptyMsg}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────────── Main Component ─── */
/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function Setup() {
  const [activeTab, setActiveTab] = useState("managers");
  const [loading, setLoading] = useState(false);

  // ── Project Managers ──────────────────────────────
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // ── Departments ───────────────────────────────────
  const [departments, setDepartments] = useState([]);
  const [deptModal, setDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: "", code: "", is_active: "Y" });
  const [deptSaving, setDeptSaving] = useState(false);

  // ── Warehouses ────────────────────────────────────
  const [warehouses, setWarehouses] = useState([]);
  const [whModal, setWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [whForm, setWhForm] = useState({ warehouse_name: "", warehouse_code: "", location: "", is_active: 1 });
  const [whSaving, setWhSaving] = useState(false);

  /* ── Data Loaders ── */
  const loadManagers = useCallback(async () => {
    try {
      const [mRes, uRes] = await Promise.all([
        api.get("/projects/project-managers").catch(() => ({ data: { items: [] } })),
        api.get("/admin/users", { params: { active: 1 } }).catch(() => ({ data: { items: [] } })),
      ]);
      setManagers(mRes.data?.items || []);
      setUsers(uRes.data?.data?.items || uRes.data?.items || []);
    } catch { toast.error("Failed to load managers"); }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get("/admin/departments");
      setDepartments(res.data?.items || res.data || []);
    } catch { toast.error("Failed to load departments"); }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      setWarehouses(res.data?.items || res.data || []);
    } catch { toast.error("Failed to load warehouses"); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadManagers(), loadDepartments(), loadWarehouses()]).finally(() => setLoading(false));
  }, [loadManagers, loadDepartments, loadWarehouses]);

  /* ── Project Managers ── */
  const handleAddManager = async () => {
    if (!selectedUserId) { toast.error("Select a user"); return; }
    try {
      await api.post("/projects/project-managers", { user_id: Number(selectedUserId) });
      toast.success("Project manager added");
      setSelectedUserId("");
      loadManagers();
    } catch { toast.error("Failed to add manager"); }
  };

  const handleRemoveManager = async (id) => {
    if (!confirm("Remove this user from project managers?")) return;
    try {
      await api.delete(`/projects/project-managers/${id}`);
      toast.success("Manager removed");
      loadManagers();
    } catch { toast.error("Failed to remove manager"); }
  };

  const availableUsers = users.filter(u => !managers.some(m => String(m.user_id) === String(u.id)));

  /* ── Departments ── */
  const openDeptAdd = () => { setEditingDept(null); setDeptForm({ name: "", code: "", is_active: "Y" }); setDeptModal(true); };
  const openDeptEdit = (d) => { setEditingDept(d); setDeptForm({ name: d.name || "", code: d.code || "", is_active: d.is_active || "Y" }); setDeptModal(true); };

  const saveDept = async () => {
    if (!deptForm.name.trim()) { toast.error("Department name is required"); return; }
    setDeptSaving(true);
    try {
      if (editingDept) {
        await api.put(`/admin/departments/${editingDept.id}`, deptForm);
        toast.success("Department updated");
      } else {
        await api.post("/admin/departments", deptForm);
        toast.success("Department created");
      }
      setDeptModal(false);
      loadDepartments();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save department"); }
    finally { setDeptSaving(false); }
  };

  const deleteDept = async (id) => {
    if (!confirm("Delete this department?")) return;
    try {
      await api.delete(`/admin/departments/${id}`);
      toast.success("Department deleted");
      loadDepartments();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete department"); }
  };

  /* ── Warehouses ── */
  const openWhAdd = () => { setEditingWh(null); setWhForm({ warehouse_name: "", warehouse_code: "", location: "", is_active: 1 }); setWhModal(true); };
  const openWhEdit = (w) => { setEditingWh(w); setWhForm({ warehouse_name: w.warehouse_name || "", warehouse_code: w.warehouse_code || "", location: w.location || "", is_active: w.is_active ?? 1 }); setWhModal(true); };

  const saveWh = async () => {
    if (!whForm.warehouse_name.trim()) { toast.error("Warehouse name is required"); return; }
    if (!whForm.warehouse_code.trim()) { toast.error("Warehouse code is required"); return; }
    setWhSaving(true);
    try {
      if (editingWh) {
        await api.put(`/inventory/warehouses/${editingWh.id}`, whForm);
        toast.success("Warehouse updated");
      } else {
        await api.post("/inventory/warehouses", whForm);
        toast.success("Warehouse created");
      }
      setWhModal(false);
      loadWarehouses();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save warehouse"); }
    finally { setWhSaving(false); }
  };

  const deleteWh = async (id) => {
    if (!confirm("Delete this warehouse?")) return;
    try {
      await api.delete(`/inventory/warehouses/${id}`);
      toast.success("Warehouse deleted");
      loadWarehouses();
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to delete warehouse"); }
  };

  const TABS = [
    { id: "managers",    label: "Project Managers" },
    { id: "departments", label: "Departments" },
    { id: "warehouses",  label: "Temp. Storage / Warehouses" },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link to="/project-management" className="btn-secondary text-sm">Back to Menu</Link>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Project Setup</h2>
          <p className="text-xs text-slate-500">Configure managers, departments, and storage</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand text-brand"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Project Managers Tab ── */}
      {activeTab === "managers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">Add Project Manager</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select User</label>
                  <select className="input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                    <option value="">-- Choose User --</option>
                    {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
                <button type="button" onClick={handleAddManager} className="btn-primary flex items-center gap-2 w-full justify-center">
                  <Plus size={16} /> Add Manager
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(m => (
                    <tr key={m.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <User size={14} className="text-slate-400" />{m.username}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{m.email || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRemoveManager(m.id)} className="p-1.5 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {managers.length === 0 && !loading && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No project managers configured</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Departments Tab ── */}
      {activeTab === "departments" && (
        <>
          <CrudSection
            title="Departments"
            icon={<Building2 size={18} className="text-indigo-500" />}
            emptyMsg="No departments found. Add one to get started."
            columns={["Name", "Code", "Status"]}
            rows={departments}
            loading={loading}
            onAdd={openDeptAdd}
            onEdit={openDeptEdit}
            onDelete={deleteDept}
            renderRow={d => (
              <>
                <td className="px-4 py-3 font-medium text-sm">{d.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{d.code || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.is_active === "Y" || d.is_active === 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {d.is_active === "Y" || d.is_active === 1 ? "Active" : "Inactive"}
                  </span>
                </td>
              </>
            )}
          />

          {/* Department Modal */}
          <ModalForm open={deptModal} onClose={() => setDeptModal(false)} title={editingDept ? "Edit Department" : "New Department"}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Department Name *</label>
                <input type="text" className="input w-full" placeholder="e.g. Construction" value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Code</label>
                <input type="text" className="input w-full" placeholder="e.g. CONS" value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="checkbox" checked={deptForm.is_active === "Y"} onChange={e => setDeptForm(p => ({ ...p, is_active: e.target.checked ? "Y" : "N" }))} />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setDeptModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={deptSaving} onClick={saveDept}>
                {deptSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}

      {/* ── Warehouses Tab ── */}
      {activeTab === "warehouses" && (
        <>
          <CrudSection
            title="Temporal Storage / Warehouses"
            icon={<Warehouse size={18} className="text-amber-500" />}
            emptyMsg="No warehouses found. Add one to get started."
            columns={["Name", "Code", "Location", "Status"]}
            rows={warehouses}
            loading={loading}
            onAdd={openWhAdd}
            onEdit={openWhEdit}
            onDelete={deleteWh}
            renderRow={w => (
              <>
                <td className="px-4 py-3 font-medium text-sm">{w.warehouse_name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{w.warehouse_code}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{w.location || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${w.is_active === 1 || w.is_active === "1" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {w.is_active === 1 || w.is_active === "1" ? "Active" : "Inactive"}
                  </span>
                </td>
              </>
            )}
          />

          {/* Warehouse Modal */}
          <ModalForm open={whModal} onClose={() => setWhModal(false)} title={editingWh ? "Edit Warehouse" : "New Warehouse"}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Warehouse Name *</label>
                <input type="text" className="input w-full" placeholder="e.g. Site A Storage" value={whForm.warehouse_name} onChange={e => setWhForm(p => ({ ...p, warehouse_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Warehouse Code *</label>
                <input type="text" className="input w-full" placeholder="e.g. WH-001" value={whForm.warehouse_code} onChange={e => setWhForm(p => ({ ...p, warehouse_code: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Location</label>
                <input type="text" className="input w-full" placeholder="e.g. Block C, Floor 2" value={whForm.location} onChange={e => setWhForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="checkbox" checked={Number(whForm.is_active) === 1} onChange={e => setWhForm(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setWhModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" disabled={whSaving} onClick={saveWh}>
                {whSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </ModalForm>
        </>
      )}
    </div>
  );
}
