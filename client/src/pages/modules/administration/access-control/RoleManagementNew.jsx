import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { 
  MODULES_REGISTRY, 
  getAllModuleKeys, 
  getModuleFeatures, 
  getModuleDashboards 
} from "../../../../data/modulesRegistry.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function RoleManagement() {
  const navigate = useNavigate();
  const { refreshPermissions } = usePermission();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });
  const [assignRole, setAssignRole] = useState(null);
  const [editRole, setEditRole] = useState({
    name: "",
    code: "",
    is_active: true,
  });

  // Permission states
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [selectedFeatures, setSelectedFeatures] = useState(new Set());
  const [selectedDashboards, setSelectedDashboards] = useState(new Set());

  function handleModuleSelectAll(moduleKey, checked) {
    // Ensure module is enabled when selecting all
    if (checked && !selectedModules.has(moduleKey)) {
      handleModuleToggle(moduleKey, true);
    }

    const moduleFeatures = getModuleFeatures(moduleKey);
    const moduleDashboards = getModuleDashboards(moduleKey);

    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      for (const f of moduleFeatures) {
        if (checked) next.add(f.feature_key);
        else next.delete(f.feature_key);
      }
      return next;
    });

    setSelectedDashboards((prev) => {
      const next = new Set(prev);
      for (const d of moduleDashboards) {
        if (checked) next.add(d.feature_key);
        else next.delete(d.feature_key);
      }
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rolesRes = await api.get("/access/roles");
      setRoles(rolesRes?.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createRole() {
    try {
      const payload = {
        name: String(newRole.name || "").trim(),
        code: String(newRole.code || "").trim(),
        is_active: !!newRole.is_active,
      };
      if (!payload.name || !payload.code) {
        setError("Name and code are required");
        return;
      }
      await api.post("/access/roles", payload);
      setShowCreate(false);
      setNewRole({ name: "", code: "", is_active: true });
      setSuccess("Role created successfully");
      await load();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create role");
    }
  }

  async function deleteRole(id) {
    if (!window.confirm("Delete role? This cannot be undone.")) return;
    try {
      await api.delete(`/access/roles/${id}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete role");
    }
  }

  async function openRoleSettings(role) {
    try {
      const [modsRes, featsRes] = await Promise.all([
        api.get(`/access/roles/${role.id}/modules`),
        api.get(`/access/roles/${role.id}/features`).catch(() => ({ data: { features: [] } })),
      ]);
      
      const assignedModules = new Set(modsRes?.data?.modules || []);
      const assignedFeatures = new Set((featsRes?.data?.features || []).map(String));
      
      // Separate features and dashboards using registry
      const assignedDashboards = new Set();
      const featuresOnly = new Set();
      
      assignedFeatures.forEach(featureKey => {
        const [moduleKey, itemKey] = featureKey.split(':');
        const moduleInfo = MODULES_REGISTRY[moduleKey];
        if (moduleInfo) {
          const isDashboard = moduleInfo.dashboards.some(d => d.key === itemKey);
          if (isDashboard) {
            assignedDashboards.add(featureKey);
          } else {
            featuresOnly.add(featureKey);
          }
        }
      });

      setAssignRole(role);
      setEditRole({
        name: role.name || "",
        code: role.code || "",
        is_active: !!role.is_active,
      });
      setSelectedModules(assignedModules);
      setSelectedFeatures(featuresOnly);
      setSelectedDashboards(assignedDashboards);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load role settings");
    }
  }

  async function saveRoleSettings() {
    try {
      setError("");
      if (assignRole) {
        const payload = {
          name: String(editRole.name || "").trim(),
          code: String(editRole.code || "").trim(),
          is_active: !!editRole.is_active,
        };
        if (!payload.name || !payload.code) {
          setError("Name and code are required");
          return;
        }
        await api.put(`/access/roles/${assignRole.id}`, payload);
        setAssignRole((prev) => (prev ? { ...prev, ...payload } : prev));
      }

      // Save modules
      await api.put(`/access/roles/${assignRole.id}/modules`, {
        modules: Array.from(selectedModules),
      });

      // Combine features and dashboards
      const allPermissions = [
        ...Array.from(selectedFeatures),
        ...Array.from(selectedDashboards)
      ];
      
      await api.put(`/access/roles/${assignRole.id}/features`, {
        features: allPermissions,
      });

      setSuccess("Role permissions updated successfully");
      try {
        window.dispatchEvent(new Event("rbac:changed"));
      } catch {}
      try {
        await refreshPermissions();
      } catch {}
      await load();
      try {
        const currentRole = assignRole
          ? {
              ...assignRole,
              name: String(editRole.name || "").trim(),
              code: String(editRole.code || "").trim(),
              is_active: !!editRole.is_active,
            }
          : null;
        if (currentRole) await openRoleSettings(currentRole);
      } catch {}
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save role settings");
    }
  }

  // Handle module selection with hierarchy enforcement
  function handleModuleToggle(moduleKey, checked) {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(moduleKey);
      } else {
        next.delete(moduleKey);
        // Remove all features and dashboards when module is deselected
        const moduleFeatures = getModuleFeatures(moduleKey);
        const moduleDashboards = getModuleDashboards(moduleKey);
        
        setSelectedFeatures(featurePrev => {
          const nextFeatures = new Set(featurePrev);
          moduleFeatures.forEach(f => nextFeatures.delete(f.feature_key));
          return nextFeatures;
        });
        
        setSelectedDashboards(dashboardPrev => {
          const nextDashboards = new Set(dashboardPrev);
          moduleDashboards.forEach(d => nextDashboards.delete(d.feature_key));
          return nextDashboards;
        });
      }
      return next;
    });
  }

  // Handle feature selection with module dependency
  function handleFeatureToggle(featureKey, checked) {
    const [moduleKey] = featureKey.split(':');
    if (!selectedModules.has(moduleKey)) {
      // Auto-select module if feature is selected
      handleModuleToggle(moduleKey, true);
    }
    
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(featureKey);
      } else {
        next.delete(featureKey);
      }
      return next;
    });
  }

  // Handle dashboard selection with module dependency
  function handleDashboardToggle(dashboardKey, checked) {
    const [moduleKey] = dashboardKey.split(':');
    if (!selectedModules.has(moduleKey)) {
      // Auto-select module if dashboard is selected
      handleModuleToggle(moduleKey, true);
    }
    
    setSelectedDashboards(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(dashboardKey);
      } else {
        next.delete(dashboardKey);
      }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-sm text-slate-600">
            Create roles and assign module, feature, and dashboard permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/administration")}
          >
            Back to Menu
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            Create Role
          </button>
        </div>
      </div>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success flex justify-between items-center">
          <span>{success}</span>
          <button className="btn-outline" type="button" onClick={() => setSuccess("")}> 
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.code}</td>
                    <td>{r.is_active ? "Active" : "Inactive"}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          className="btn btn-secondary" type="button"
                          onClick={() => openRoleSettings(r)}
                        >
                          Configure Permissions
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow max-w-lg w-full">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Create Role</h2>
              <button
                className="btn-outline"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={newRole.name}
                  onChange={(e) =>
                    setNewRole({ ...newRole, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Code</label>
                <input
                  className="input"
                  value={newRole.code}
                  onChange={(e) =>
                    setNewRole({ ...newRole, code: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={newRole.is_active}
                  onChange={(e) =>
                    setNewRole({ ...newRole, is_active: e.target.checked })
                  }
                />
                <span className="text-sm font-medium">Active</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                className="btn-outline"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="btn-success" type="button" onClick={createRole}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Settings Modal */}
      {assignRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Configure Permissions</h2>
                <span className="text-sm text-slate-500">{editRole.name}</span>
              </div>
              <button
                className="btn-outline"
                type="button"
                onClick={() => setAssignRole(null)}
              >
                ×
              </button>
            </div>
            
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* Role Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Role Name</label>
                  <input
                    className="input"
                    value={editRole.name}
                    onChange={(e) =>
                      setEditRole((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Role Code</label>
                  <input
                    className="input"
                    value={editRole.code}
                    onChange={(e) =>
                      setEditRole((prev) => ({ ...prev, code: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={editRole.is_active}
                      onChange={(e) =>
                        setEditRole((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
              </div>

              {/* Modules Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📦</span>
                  Modules
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {getAllModuleKeys().map((moduleKey) => {
                    const moduleInfo = MODULES_REGISTRY[moduleKey];
                    return (
                      <label key={moduleKey} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedModules.has(moduleKey)}
                          onChange={(e) => handleModuleToggle(moduleKey, e.target.checked)}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{moduleInfo?.icon}</span>
                          <span className="font-medium">{moduleInfo?.name}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Features and Dashboards Section */}
              <div className="space-y-6">
                {getAllModuleKeys().map((moduleKey) => {
                  const moduleInfo = MODULES_REGISTRY[moduleKey];
                  const isModuleSelected = selectedModules.has(moduleKey);
                  const moduleFeatures = getModuleFeatures(moduleKey);
                  const moduleDashboards = getModuleDashboards(moduleKey);
                  const allKeys = [
                    ...moduleFeatures.map((f) => f.feature_key),
                    ...moduleDashboards.map((d) => d.feature_key),
                  ];
                  const selectedCount = allKeys.filter(
                    (k) => selectedFeatures.has(k) || selectedDashboards.has(k),
                  ).length;
                  const isAllSelected = allKeys.length > 0 && selectedCount === allKeys.length;
                  
                  if (!isModuleSelected && moduleFeatures.length === 0 && moduleDashboards.length === 0) {
                    return null;
                  }

                  return (
                    <div key={moduleKey} className="border rounded-lg">
                      <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={isModuleSelected}
                            onChange={(e) => handleModuleToggle(moduleKey, e.target.checked)}
                          />
                          <span className="font-semibold text-lg">{moduleInfo?.icon} {moduleInfo?.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{moduleFeatures.length} features</span>
                          <span>{moduleDashboards.length} dashboards</span>
                          {isModuleSelected && allKeys.length > 0 && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={isAllSelected}
                                onChange={(e) =>
                                  handleModuleSelectAll(moduleKey, e.target.checked)
                                }
                              />
                              Select All
                            </label>
                          )}
                        </div>
                      </div>

                      {isModuleSelected && (
                        <div className="p-4 space-y-4">
                          {/* Features */}
                          {moduleFeatures.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <span>⚡</span>
                                Features
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {moduleFeatures.map((feature) => (
                                  <label
                                    key={feature.feature_key}
                                    className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedFeatures.has(feature.feature_key)}
                                      onChange={(e) => handleFeatureToggle(feature.feature_key, e.target.checked)}
                                    />
                                    <span className="text-sm">{feature.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dashboards */}
                          {moduleDashboards.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <span>📊</span>
                                Dashboards
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {moduleDashboards.map((dashboard) => (
                                  <label
                                    key={dashboard.feature_key}
                                    className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedDashboards.has(dashboard.feature_key)}
                                      onChange={(e) => handleDashboardToggle(dashboard.feature_key, e.target.checked)}
                                    />
                                    <span className="text-sm">{dashboard.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  className="btn-outline"
                  type="button"
                  onClick={() => setAssignRole(null)}
                >
                  Cancel
                </button>
                <button className="btn-success" type="button" onClick={saveRoleSettings}>
                  Save Permissions
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
