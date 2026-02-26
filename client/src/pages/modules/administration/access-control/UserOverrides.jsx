import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";

export default function UserOverrides() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleModules, setRoleModules] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items = res?.data?.data?.items || res?.data?.items || [];
        setUsers(items);
      } catch {}
    }
    loadUsers();
  }, []);

  async function loadContext(userId) {
    setSelectedUser(userId);
    setLoading(true);
    setError("");
    try {
      const userRes = await api.get(`/admin/users/${userId}`);
      const u = userRes?.data?.data?.item || userRes?.data?.item || null;
      setRole(u && u.role ? u.role : null);

      const roleId = Number(u?.role_id || u?.role?.id || 0);
      if (!roleId) {
        setRoleModules([]);
        setRolePermissions({});
      } else {
        const modsRes = await api.get(`/access/roles/${roleId}/modules`);
        const permsRes = await api.get(`/access/roles/${roleId}/permissions`);
        const mods = modsRes?.data?.modules || [];
        setRoleModules(mods);
        const permList = permsRes?.data?.permissions || [];
        const byModule = {};
        for (const p of permList) {
          byModule[p.module_key] = {
            can_view: !!p.can_view,
            can_create: !!p.can_create,
            can_edit: !!p.can_edit,
            can_delete: !!p.can_delete,
          };
        }
        setRolePermissions(byModule);
      }
      const oRes = await api.get(`/access/users/${userId}/overrides`);
      const oList = oRes?.data?.overrides || [];
      const byModuleOverride = {};
      for (const o of oList) {
        byModuleOverride[o.module_key] = {
          can_view: o.can_view,
          can_create: o.can_create,
          can_edit: o.can_edit,
          can_delete: o.can_delete,
        };
      }
      setOverrides(byModuleOverride);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function display(val) {
    if (val == null) return "—";
    return val ? "Yes" : "No";
  }

  function toggleOverride(mk, key) {
    setOverrides((prev) => {
      const next = { ...prev };
      const row = next[mk] || {
        can_view: null,
        can_create: null,
        can_edit: null,
        can_delete: null,
      };
      const current = row[key];
      row[key] = current == null ? true : current ? false : null;
      next[mk] = row;
      return next;
    });
  }

  async function saveOverrides() {
    try {
      const payload = roleModules.map((mk) => ({
        module_key: mk,
        can_view: overrides[mk]?.can_view ?? null,
        can_create: overrides[mk]?.can_create ?? null,
        can_edit: overrides[mk]?.can_edit ?? null,
        can_delete: overrides[mk]?.can_delete ?? null,
      }));
      await api.put(`/access/users/${selectedUser}/overrides`, {
        overrides: payload,
      });
      alert("Saved");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Overrides</h1>
          <p className="text-sm text-slate-600">
            Set exceptional overrides per user
          </p>
        </div>
        <a href="/administration" className="btn btn-secondary">
          Back to Menu
        </a>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">Select User</label>
            <select
              className="input"
              value={selectedUser || ""}
              onChange={(e) => loadContext(Number(e.target.value))}
            >
              <option value="">Choose user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : selectedUser ? (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th className="text-center w-28">Role Default</th>
                    <th className="text-center w-28">Override View</th>
                    <th className="text-center w-28">Override Create</th>
                    <th className="text-center w-28">Override Edit</th>
                    <th className="text-center w-28">Override Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {roleModules.map((mk) => {
                    const roleRow = rolePermissions[mk] || {};
                    const overrideRow = overrides[mk] || {};
                    return (
                      <tr key={mk}>
                        <td className="p-3 font-medium">{mk}</td>
                        <td className="p-3 text-center">
                          V {display(roleRow.can_view)} / C{" "}
                          {display(roleRow.can_create)} / E{" "}
                          {display(roleRow.can_edit)} / D{" "}
                          {display(roleRow.can_delete)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            className="btn btn-xs"
                            onClick={() => toggleOverride(mk, "can_view")}
                          >
                            {display(overrideRow.can_view)}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            className="btn btn-xs"
                            onClick={() => toggleOverride(mk, "can_create")}
                          >
                            {display(overrideRow.can_create)}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            className="btn btn-xs"
                            onClick={() => toggleOverride(mk, "can_edit")}
                          >
                            {display(overrideRow.can_edit)}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            className="btn btn-xs"
                            onClick={() => toggleOverride(mk, "can_delete")}
                          >
                            {display(overrideRow.can_delete)}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-end mt-4">
                <button className="btn btn-success" onClick={saveOverrides}>
                  Save
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
