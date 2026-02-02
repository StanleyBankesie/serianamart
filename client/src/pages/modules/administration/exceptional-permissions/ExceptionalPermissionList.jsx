import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function ExceptionalPermissionList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      setLoading(true);
      const res = await api.get("/admin/exceptional-permissions");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to load exceptional permissions",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Exceptional Permissions
          </h1>
          <p className="text-sm mt-1">
            Grant temporary allow/deny permissions to specific users
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/administration/users" className="btn btn-secondary">
            Return to Users
          </Link>
          <Link
            to="/administration/exceptional-permissions/new"
            className="btn-success"
          >
            + New Exceptional Permission
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {error && (
            <div className="alert alert-error mb-3">
              <span>{error}</span>
            </div>
          )}
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Permission</th>
                    <th>Type</th>
                    <th>Effect</th>
                    <th>Validity</th>
                    <th>Reason</th>
                    <th>Approver</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="text-center py-4 text-slate-500"
                      >
                        No exceptional permissions found.
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">
                          {r.username || "Unknown User"}
                        </td>
                        <td>{r.permission_code}</td>
                        <td>
                          <span className="badge badge-neutral">
                            {r.exception_type || "TEMPORARY"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.effect === "ALLOW"
                                ? "badge-success"
                                : "badge-error"
                            }`}
                          >
                            {r.effect}
                          </span>
                        </td>
                        <td className="text-xs">
                          <div>
                            From:{" "}
                            {r.effective_from
                              ? new Date(r.effective_from).toLocaleDateString()
                              : "N/A"}
                          </div>
                          <div>
                            To:{" "}
                            {r.effective_to
                              ? new Date(r.effective_to).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </td>
                        <td className="max-w-xs truncate" title={r.reason}>
                          {r.reason}
                        </td>
                        <td className="text-sm">
                          {r.approver_name || "System"}
                        </td>
                        <td>
                          {r.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/administration/exceptional-permissions/${r.id}`}
                            className="text-brand hover:text-brand-600 text-sm font-medium"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
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
