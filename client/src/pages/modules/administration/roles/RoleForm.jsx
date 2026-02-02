import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "api/client";

export default function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    isActive: true,
  });
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [featuresByModule, setFeaturesByModule] = useState({});
  const [pagesSearch, setPagesSearch] = useState("");
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPages();
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchPages();
    if (isEditMode) {
      fetchRole();
    }
  }, [id]);

  async function fetchPages() {
    try {
      const response = await api.get("/admin/pages");
      const items = response.data?.data?.items || [];
      setPages(items);
      const byModule = {};
      const toTitle = (s) =>
        String(s || "")
          .split("-")
          .map((x) => (x[0] ? x[0].toUpperCase() + x.slice(1) : ""))
          .join(" ");
      const getAction = (seg) => {
        if (seg === "new" || seg === "create") return "create";
        if (seg && seg.startsWith(":")) return "edit";
        return "view";
      };
      for (const p of items) {
        const mod = p.module || "General";
        const path = String(p.path || "");
        const parts = path.split("/").filter(Boolean);
        let baseParts = parts.slice();
        let action = "view";
        if (parts.length > 0) {
          const last = parts[parts.length - 1];
          const a = getAction(last);
          action = a;
          if (a !== "view") baseParts = parts.slice(0, parts.length - 1);
        }
        const nameAction = /\bDelete\b/i.test(String(p.name || ""))
          ? "delete"
          : null;
        if (nameAction) action = nameAction;
        let label = "";
        if (baseParts.length >= 2) {
          label = toTitle(baseParts[baseParts.length - 1]);
        } else {
          label =
            String(p.name || "").replace(
              /\s*(List|Form|Edit|Delete)\s*$/i,
              ""
            ) || toTitle(parts[1] || "");
        }
        const featureKey = baseParts.join("/");
        if (!byModule[mod]) byModule[mod] = {};
        if (!byModule[mod][featureKey])
          byModule[mod][featureKey] = { label, actions: {} };
        byModule[mod][featureKey].actions[action] = p;
      }
      setFeaturesByModule(byModule);
    } catch (err) {
      console.error("Error fetching pages:", err);
    }
  }

  async function fetchRole() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/roles/${id}`);
      if (response.data?.data?.item) {
        const role = response.data.data.item;
        setFormData({
          code: role.code,
          name: role.name,
          isActive: !!role.is_active,
        });

        // role.pages is array of page_ids
        if (Array.isArray(role.pages)) {
          setSelectedPages(new Set(role.pages.map(Number)));
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching role");
    } finally {
      setLoading(false);
    }
  }

  const handlePageToggle = (pageId) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const toggleModule = (modulePages, isSelected) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      modulePages.forEach((p) => {
        if (isSelected) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // System generated code from name if not present
      let generatedCode = formData.code;
      if (!generatedCode || !isEditMode) {
        generatedCode = formData.name
          .toUpperCase()
          .trim()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
      }

      const payload = {
        code: generatedCode,
        name: formData.name,
        is_active: formData.isActive,
        pages: Array.from(selectedPages), // Send array of IDs
      };

      if (isEditMode) {
        await api.put(`/admin/roles/${id}`, payload);
      } else {
        await api.post("/admin/roles", payload);
      }
      navigate("/administration/roles");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving role");
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatureAction = (page, isSelected) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(page.id);
      else next.delete(page.id);
      return next;
    });
  };
  const toggleModuleFeatures = (featureEntries, isSelected) => {
    const pagesToToggle = [];
    for (const [, feature] of featureEntries) {
      for (const [, pg] of Object.entries(feature.actions)) {
        pagesToToggle.push(pg);
      }
    }
    setSelectedPages((prev) => {
      const next = new Set(prev);
      for (const pg of pagesToToggle) {
        if (isSelected) next.add(pg.id);
        else next.delete(pg.id);
      }
      return next;
    });
  };
  const toggleModuleAction = (featureEntries, action, isSelected) => {
    const pagesToToggle = [];
    for (const [, feature] of featureEntries) {
      const pg = feature.actions[action];
      if (pg) pagesToToggle.push(pg);
    }
    setSelectedPages((prev) => {
      const next = new Set(prev);
      for (const pg of pagesToToggle) {
        if (isSelected) next.add(pg.id);
        else next.delete(pg.id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Link
              to="/administration/roles"
              className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
            >
              ← Back to Roles
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? "Edit Role" : "New Role"}
            </h1>
            <p className="text-sm mt-1">
              Define role details and select accessible pages
            </p>
          </div>
          <div className="flex gap-4">
            <Link to="/administration/roles" className="btn btn-outline">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Role"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <h2 className="text-lg font-semibold text-white dark:text-slate-100">
              Role Information
            </h2>
          </div>
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Role Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Sales Manager"
                  required
                />
              </div>
              <div className="flex items-center gap-2 mt-8">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
                <span className="text-sm font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">
              Page Access
            </h2>
            <p className="text-sm mt-1">
              Select which pages users with this role can access
            </p>
            <div className="ml-auto">
              <button
                type="button"
                className="btn btn-secondary mr-3"
                onClick={fetchPages}
                disabled={loading}
              >
                Refresh Pages
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-8">
              {Object.entries(featuresByModule).map(
                ([moduleName, featureMap]) => {
                  const featureEntries = Object.entries(featureMap);
                  const allSelected = featureEntries.every(([, feature]) =>
                    Object.values(feature.actions).every((pg) =>
                      selectedPages.has(pg.id)
                    )
                  );
                  return (
                    <div
                      key={moduleName}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 flex justify-between items-center">
                        <span>{moduleName}</span>
                        <div className="flex items-center gap-4 text-sm font-normal">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={allSelected}
                              onChange={(e) =>
                                toggleModuleFeatures(
                                  featureEntries,
                                  e.target.checked
                                )
                              }
                            />
                            Select All
                          </label>
                          {(() => {
                            const viewPages = featureEntries
                              .map(([, f]) => f.actions.view)
                              .filter(Boolean);
                            const allViewSelected =
                              viewPages.length > 0 &&
                              viewPages.every((pg) => selectedPages.has(pg.id));
                            return (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={viewPages.length === 0}
                                  checked={allViewSelected}
                                  onChange={(e) =>
                                    toggleModuleAction(
                                      featureEntries,
                                      "view",
                                      e.target.checked
                                    )
                                  }
                                />
                                View
                              </label>
                            );
                          })()}
                          {(() => {
                            const createPages = featureEntries
                              .map(([, f]) => f.actions.create)
                              .filter(Boolean);
                            const allCreateSelected =
                              createPages.length > 0 &&
                              createPages.every((pg) =>
                                selectedPages.has(pg.id)
                              );
                            return (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={createPages.length === 0}
                                  checked={allCreateSelected}
                                  onChange={(e) =>
                                    toggleModuleAction(
                                      featureEntries,
                                      "create",
                                      e.target.checked
                                    )
                                  }
                                />
                                Add
                              </label>
                            );
                          })()}
                          {(() => {
                            const editPages = featureEntries
                              .map(([, f]) => f.actions.edit)
                              .filter(Boolean);
                            const allEditSelected =
                              editPages.length > 0 &&
                              editPages.every((pg) => selectedPages.has(pg.id));
                            return (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={editPages.length === 0}
                                  checked={allEditSelected}
                                  onChange={(e) =>
                                    toggleModuleAction(
                                      featureEntries,
                                      "edit",
                                      e.target.checked
                                    )
                                  }
                                />
                                Edit
                              </label>
                            );
                          })()}
                          {(() => {
                            const deletePages = featureEntries
                              .map(([, f]) => f.actions.delete)
                              .filter(Boolean);
                            const allDeleteSelected =
                              deletePages.length > 0 &&
                              deletePages.every((pg) =>
                                selectedPages.has(pg.id)
                              );
                            return (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  disabled={deletePages.length === 0}
                                  checked={allDeleteSelected}
                                  onChange={(e) =>
                                    toggleModuleAction(
                                      featureEntries,
                                      "delete",
                                      e.target.checked
                                    )
                                  }
                                />
                                Delete
                              </label>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {featureEntries.map(([featureKey, feature]) => {
                          const viewPage = feature.actions.view;
                          const createPage = feature.actions.create;
                          const editPage = feature.actions.edit;
                          const deletePage = feature.actions.delete;
                          return (
                            <div
                              key={featureKey}
                              className="flex flex-col gap-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800"
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {feature.label}
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm">
                                {viewPage && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedPages.has(viewPage.id)}
                                      onChange={(e) =>
                                        toggleFeatureAction(
                                          viewPage,
                                          e.target.checked
                                        )
                                      }
                                    />
                                    View
                                  </label>
                                )}
                                {createPage && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedPages.has(createPage.id)}
                                      onChange={(e) =>
                                        toggleFeatureAction(
                                          createPage,
                                          e.target.checked
                                        )
                                      }
                                    />
                                    Create
                                  </label>
                                )}
                                {editPage && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedPages.has(editPage.id)}
                                      onChange={(e) =>
                                        toggleFeatureAction(
                                          editPage,
                                          e.target.checked
                                        )
                                      }
                                    />
                                    Edit
                                  </label>
                                )}
                                {deletePage && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-sm"
                                      checked={selectedPages.has(deletePage.id)}
                                      onChange={(e) =>
                                        toggleFeatureAction(
                                          deletePage,
                                          e.target.checked
                                        )
                                      }
                                    />
                                    Delete
                                  </label>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">
              All Pages (Individual)
            </h2>
            <p className="text-sm mt-1">New pages appear automatically</p>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <input
                  className="input"
                  placeholder="Search by module, name, or path"
                  value={pagesSearch}
                  onChange={(e) => setPagesSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center">
                <span className="text-sm text-slate-600">
                  {Array.isArray(pages) ? pages.length : 0} pages
                </span>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="text-left p-2 text-xs uppercase">Module</th>
                    <th className="text-left p-2 text-xs uppercase">Page</th>
                    <th className="text-left p-2 text-xs uppercase">Path</th>
                    <th className="text-left p-2 text-xs uppercase">Select</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pages
                    .filter((p) => {
                      const q = String(pagesSearch || "")
                        .trim()
                        .toLowerCase();
                      if (!q) return true;
                      return (
                        String(p.module || "").toLowerCase().includes(q) ||
                        String(p.name || "").toLowerCase().includes(q) ||
                        String(p.path || "").toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const am = String(a.module || "");
                      const bm = String(b.module || "");
                      if (am === bm) {
                        return String(a.name || "").localeCompare(
                          String(b.name || "")
                        );
                      }
                      return am.localeCompare(bm);
                    })
                    .map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.module || "-"}</td>
                        <td className="p-2">{p.name || "-"}</td>
                        <td className="p-2">{p.path || "-"}</td>
                        <td className="p-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedPages.has(p.id)}
                              onChange={(e) =>
                                handlePageToggle(p.id, e.target.checked)
                              }
                            />
                            <span className="text-xs">Allow</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
