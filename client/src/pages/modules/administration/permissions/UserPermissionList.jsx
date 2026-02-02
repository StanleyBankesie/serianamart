import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";

export default function UserPermissionList() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/user-assignments");
      const items =
        (res.data && res.data.data && res.data.data.items) ||
        res.data?.items ||
        [];
      setAssignments(items);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }

  const filtered = assignments.filter((a) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(a.username || "").toLowerCase().includes(q) ||
      String(a.email || "").toLowerCase().includes(q) ||
      String(a.role_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            User Permissions
          </h1>
          <p className="text-sm mt-1">
            Review users with customized page-level permissions and manage
            assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/administration/user-permissions")}
          >
            Assign Rights
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-4 flex items-center justify-between">
            <input
              type="text"
              placeholder="Search by user, email, role..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={fetchAssignments}>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Customized Pages</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.username}</td>
                      <td>{item.email}</td>
                      <td>
                        {item.role_name ? (
                          <span className="badge">{item.role_name}</span>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {Number(item.custom_count || 0)}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            navigate("/administration/user-permissions", {
                              state: { selectedUser: item.id },
                            })
                          }
                          className="btn btn-sm btn-ghost text-brand hover:bg-brand/10"
                        >
                          Edit Permissions
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10">
                        <div className="text-slate-500">
                          No permission assignments found.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
