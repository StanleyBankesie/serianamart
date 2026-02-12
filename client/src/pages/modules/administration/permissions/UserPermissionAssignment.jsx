import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "api/client";

export default function UserPermissionAssignment() {
  const location = useLocation();
  const [allPages, setAllPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(
    location.state?.selectedUser || "",
  );
  const [role, setRole] = useState(null);
  const [pages, setPages] = useState([]);
  const [permissions, setPermissions] = useState({}); // pageId -> { canView, canCreate, ... }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchUsers();
    fetchAllPages();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserContext(selectedUser);
    } else {
      setRole(null);
      setPages([]);
      setPermissions({});
    }
  }, [selectedUser]);

  async function fetchUsers() {
    try {
      const res = await api.get("/admin/users");
      const items =
        (res.data && res.data.data && res.data.data.items) ||
        res.data?.items ||
        [];
      setUsers(items);
    } catch (err) {
      console.error(err);
      try {
        await api.post("/admin/error-logs", {
          module: "Administration",
          action: "FetchUsersForPermissions",
          error_code: err?.code || null,
          message: err?.message || "Failed to load users",
          details: { path: "/admin/users" },
        });
      } catch {}
    }
  }

  async function fetchAllPages() {
    try {
      const res = await api.get("/admin/pages");
      const items =
        (res.data && res.data.data && res.data.data.items) ||
        res.data?.items ||
        [];
      setAllPages(items);
    } catch (err) {
      // silent
    }
  }

  async function fetchUserContext(userId) {
    setLoading(true);
    setRole(null);
    setPages([]);
    setPermissions({});
    setMessage({ type: "", text: "" });

    try {
      const res = await api.get(`/admin/users/${userId}/permissions-context`);
      const role =
        (res.data && res.data.data && res.data.data.role) || res.data?.role;
      const pages =
        (res.data && res.data.data && res.data.data.pages) ||
        res.data?.pages ||
        [];
      setRole(role || null);
      setPages(pages);

      const perms = {};
      const permList =
        (res.data && res.data.data && res.data.data.permissions) ||
        res.data?.permissions ||
        [];
      permList.forEach((p) => {
        perms[p.page_id] = {
          canView: !!p.can_view,
          canCreate: !!p.can_create,
          canEdit: !!p.can_edit,
          canDelete: !!p.can_delete,
        };
      });
      setPermissions(perms);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error loading permissions context" });
      try {
        await api.post("/admin/error-logs", {
          module: "Administration",
          action: "FetchUserPermissionsContext",
          error_code: err?.code || null,
          message: err?.message || "Failed to load permissions context",
          details: { userId },
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  const handleToggle = (pageId, field) => {
    setPermissions((prev) => {
      const current = prev[pageId] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };
      return {
        ...prev,
        [pageId]: { ...current, [field]: !current[field] },
      };
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = Object.entries(permissions).map(([pageId, p]) => ({
        page_id: Number(pageId),
        can_view: p.canView,
        can_create: p.canCreate,
        can_edit: p.canEdit,
        can_delete: p.canDelete,
      }));

      await api.post(`/admin/users/${selectedUser}/permissions`, {
        permissions: payload,
      });
      setMessage({ type: "success", text: "Permissions saved successfully!" });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error saving permissions." });
      try {
        await api.post(`/admin/error-logs`, {
          module: "Administration",
          action: "SaveUserPermissions",
          error_code: err?.code || null,
          message: err?.message || "Failed to save permissions",
          details: { userId: selectedUser, payloadSize: payload.length },
        });
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  // Group pages by module
  const pagesByModule = pages.reduce((acc, page) => {
    if (!acc[page.module]) acc[page.module] = [];
    acc[page.module].push(page);
    return acc;
  }, {});
  const allPagesByModule = allPages.reduce((acc, page) => {
    if (!acc[page.module]) acc[page.module] = [];
    acc[page.module].push(page);
    return acc;
  }, {});
  const rolePageIds = new Set(pages.map((p) => p.id));
  const additionalPages = allPages.filter((p) => !rolePageIds.has(p.id));
  const moduleDefaults = Object.fromEntries(
    Object.entries(allPagesByModule).map(([moduleName, modulePages]) => {
      const list = modulePages.filter((p) => p.path);
      const candidates = list.filter(
        (p) =>
          !/\/(new|create)\b/.test(String(p.path || "")) &&
          !/:id\b/.test(String(p.path || "")),
      );
      const pick = candidates[0] || list[0] || null;
      return [moduleName, pick];
    }),
  );
  const dashboardsByModule = Object.fromEntries(
    Object.entries(allPagesByModule).map(([moduleName, modulePages]) => {
      const dashboards = modulePages.filter((p) => {
        const path = String(p.path || "");
        if (!path) return false;
        if (/\/(new|create)\b/.test(path)) return false;
        if (/:id\b/.test(path)) return false;
        return true;
      });
      return [moduleName, dashboards];
    }),
  );
  const featuredPaths = [
    "/sales/sales-orders",
    "/sales/invoices",
    "/service-management/service-confirmation",
    "/service-management/service-bills",
  ];
  const featuredPages = pages.filter((p) => featuredPaths.includes(p.path));

  const toggleRow = (pageId, value) => {
    setPermissions((prev) => ({
      ...prev,
      [pageId]: {
        canView: value,
        canCreate: value,
        canEdit: value,
        canDelete: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link
            to="/administration/permissions"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
          >
            ← Back to Permissions
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            User Permission Assignment
          </h1>
          <p className="text-sm mt-1">
            Select a user to configure their specific access rights based on
            their assigned role.
          </p>
        </div>
        {selectedUser && pages.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Select User</label>
              <select
                className="input"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">-- Select User --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            {selectedUser && (
              <div>
                <label className="label">Assigned Role</label>
                <div className="p-2 border rounded bg-slate-50 dark:bg-slate-800">
                  {role ? (
                    <span className="font-semibold text-brand">
                      {role.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">
                      No Role Assigned
                    </span>
                  )}
                </div>
                {role && (
                  <div className="text-xs text-slate-500 mt-1">
                    Role defines which pages are visible. Configure CRUD rights
                    below.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {message.text && (
        <div
          className={`alert ${
            message.type === "success" ? "alert-success" : "alert-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && (
        <div className="flex justify-center p-8">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      )}

      {!loading && selectedUser && pages.length === 0 && (
        <div className="card bg-base-200">
          <div className="card-body text-center text-slate-500">
            {role
              ? "This role has no pages assigned. You can grant access from Additional Pages below."
              : "Assign a role to this user first to configure permissions, or grant access from Additional Pages below."}
          </div>
        </div>
      )}

      {!loading && selectedUser && pages.length > 0 && (
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Permissions</h2>
          </div>
          <div className="card-body">
            <div className="space-y-8">
              {Object.keys(moduleDefaults).length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                    Dashboard Access
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                          <th className="p-3 w-1/3">Module</th>
                          <th className="p-3 text-center w-24">Can View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(moduleDefaults)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([moduleName, page]) => {
                            if (!page) return null;
                            const p = permissions[page.id] || {
                              canView: false,
                              canCreate: false,
                              canEdit: false,
                              canDelete: false,
                            };
                            return (
                              <tr
                                key={`module-${moduleName}`}
                                className="border-t border-slate-100 dark:border-slate-800"
                              >
                                <td className="p-3">
                                  <div className="font-medium">
                                    {moduleName}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {page.name} • {page.path}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={p.canView}
                                    onChange={() =>
                                      handleToggle(page.id, "canView")
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {Object.keys(dashboardsByModule).length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                    Module Dashboards (Home Cards)
                  </div>
                  <div className="space-y-6 p-4">
                    {Object.entries(dashboardsByModule)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([moduleName, modulePages]) => {
                        const allViewed = modulePages.every(
                          (pg) => (permissions[pg.id] || {}).canView,
                        );
                        return (
                          <div
                            key={`dash-${moduleName}`}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                          >
                            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                              <div>{moduleName}</div>
                              <label className="flex items-center gap-2 text-xs">
                                <span>View all</span>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={allViewed}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setPermissions((prev) => {
                                      const next = { ...prev };
                                      for (const pg of modulePages) {
                                        const curr = next[pg.id] || {
                                          canView: false,
                                          canCreate: false,
                                          canEdit: false,
                                          canDelete: false,
                                        };
                                        next[pg.id] = { ...curr, canView: val };
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              </label>
                            </div>
                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {modulePages.map((page) => {
                                  const p = permissions[page.id] || {
                                    canView: false,
                                    canCreate: false,
                                    canEdit: false,
                                    canDelete: false,
                                  };
                                  return (
                                    <div
                                      key={`dash-page-${page.id}`}
                                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between"
                                    >
                                      <div>
                                        <div className="font-medium">
                                          {page.name}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {page.path}
                                        </div>
                                      </div>
                                      <label className="flex items-center gap-2">
                                        <span className="text-xs">View</span>
                                        <input
                                          type="checkbox"
                                          className="checkbox checkbox-sm"
                                          checked={p.canView}
                                          onChange={() =>
                                            handleToggle(page.id, "canView")
                                          }
                                        />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {featuredPages.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                    Homepage Featured
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                          <th className="p-3 w-1/3">Page</th>
                          <th className="p-3 text-center w-24">View</th>
                          <th className="p-3 text-center w-24">Create</th>
                          <th className="p-3 text-center w-24">Edit</th>
                          <th className="p-3 text-center w-24">Delete</th>
                          <th className="p-3 text-center w-24">All</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featuredPages.map((page) => {
                          const p = permissions[page.id] || {
                            canView: false,
                            canCreate: false,
                            canEdit: false,
                            canDelete: false,
                          };
                          const allSelected =
                            p.canView &&
                            p.canCreate &&
                            p.canEdit &&
                            p.canDelete;
                          return (
                            <tr
                              key={page.id}
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              <td className="p-3">
                                <div className="font-medium">{page.name}</div>
                                <div className="text-xs text-slate-500">
                                  {page.code}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={p.canView}
                                  onChange={() =>
                                    handleToggle(page.id, "canView")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={p.canCreate}
                                  onChange={() =>
                                    handleToggle(page.id, "canCreate")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={p.canEdit}
                                  onChange={() =>
                                    handleToggle(page.id, "canEdit")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={p.canDelete}
                                  onChange={() =>
                                    handleToggle(page.id, "canDelete")
                                  }
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={allSelected}
                                  onChange={(e) =>
                                    toggleRow(page.id, e.target.checked)
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {Object.entries(pagesByModule).map(
                ([moduleName, modulePages]) => (
                  <div
                    key={moduleName}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                      {moduleName}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                            <th className="p-3 w-1/3">Page</th>
                            <th className="p-3 text-center w-24">View</th>
                            <th className="p-3 text-center w-24">Create</th>
                            <th className="p-3 text-center w-24">Edit</th>
                            <th className="p-3 text-center w-24">Delete</th>
                            <th className="p-3 text-center w-24">All</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modulePages.map((page) => {
                            const p = permissions[page.id] || {
                              canView: false,
                              canCreate: false,
                              canEdit: false,
                              canDelete: false,
                            };
                            const allSelected =
                              p.canView &&
                              p.canCreate &&
                              p.canEdit &&
                              p.canDelete;

                            return (
                              <tr
                                key={page.id}
                                className="border-t border-slate-100 dark:border-slate-800"
                              >
                                <td className="p-3">
                                  <div className="font-medium">{page.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {page.code}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={p.canView}
                                    onChange={() =>
                                      handleToggle(page.id, "canView")
                                    }
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={p.canCreate}
                                    onChange={() =>
                                      handleToggle(page.id, "canCreate")
                                    }
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={p.canEdit}
                                    onChange={() =>
                                      handleToggle(page.id, "canEdit")
                                    }
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={p.canDelete}
                                    onChange={() =>
                                      handleToggle(page.id, "canDelete")
                                    }
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm"
                                    checked={allSelected}
                                    onChange={(e) =>
                                      toggleRow(page.id, e.target.checked)
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ),
              )}
              {additionalPages.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
                    Additional Pages (Grant access beyond role)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-left">
                          <th className="p-3 w-1/3">Page</th>
                          <th className="p-3 text-center w-24">View</th>
                          <th className="p-3 text-center w-24">Create</th>
                          <th className="p-3 text-center w-24">Edit</th>
                          <th className="p-3 text-center w-24">Delete</th>
                          <th className="p-3 text-center w-24">All</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(allPagesByModule).map(
                          ([moduleName, modulePages]) =>
                            modulePages
                              .filter((p) => !rolePageIds.has(p.id))
                              .map((page) => {
                                const p = permissions[page.id] || {
                                  canView: false,
                                  canCreate: false,
                                  canEdit: false,
                                  canDelete: false,
                                };
                                const allSelected =
                                  p.canView &&
                                  p.canCreate &&
                                  p.canEdit &&
                                  p.canDelete;
                                return (
                                  <tr
                                    key={`extra-${page.id}`}
                                    className="border-t border-slate-100 dark:border-slate-800"
                                  >
                                    <td className="p-3">
                                      <div className="font-medium">
                                        {page.name}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {moduleName} • {page.code}
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={p.canView}
                                        onChange={() =>
                                          handleToggle(page.id, "canView")
                                        }
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={p.canCreate}
                                        onChange={() =>
                                          handleToggle(page.id, "canCreate")
                                        }
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={p.canEdit}
                                        onChange={() =>
                                          handleToggle(page.id, "canEdit")
                                        }
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={p.canDelete}
                                        onChange={() =>
                                          handleToggle(page.id, "canDelete")
                                        }
                                      />
                                    </td>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={allSelected}
                                        onChange={(e) =>
                                          toggleRow(page.id, e.target.checked)
                                        }
                                      />
                                    </td>
                                  </tr>
                                );
                              }),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="card-footer bg-slate-50 dark:bg-slate-800 p-4 rounded-b-lg flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
