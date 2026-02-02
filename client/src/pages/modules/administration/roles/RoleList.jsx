import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function RoleList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/admin/roles");
      const items = Array.isArray(response.data?.data?.items)
        ? response.data.data.items
        : [];
      setRoles(items);
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      String(role.name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(role.code || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return <div className="text-center py-8">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Role Setup
          </h1>
          <p className="text-sm mt-1">Configure roles and assign permissions</p>
        </div>
        <div className="flex gap-2">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/administration/roles/new" className="btn-success">
            + New Role
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search roles..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Role Code</th>
                  <th>Role Name</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <code className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                        {role.code}
                      </code>
                    </td>
                    <td className="font-medium text-slate-900 dark:text-slate-100">
                      {role.name}
                    </td>
                    <td>
                      {role.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Inactive</span>
                      )}
                    </td>
                    <td className="text-slate-600 dark:text-slate-400">
                      {new Date(role.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/administration/roles/${role.id}`}
                          className="text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRoles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                No roles found matching your search.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
