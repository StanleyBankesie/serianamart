import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import "../../../../styles/UserManagement.css";

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Stats
  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/admin/users");
      const items = Array.isArray(response.data?.data?.items)
        ? response.data.data.items
        : [];
      setUsers(items);
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      String(user.full_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(user.username || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(user.email || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.is_active) ||
      (statusFilter === "inactive" && !user.is_active);

    const matchesType =
      typeFilter === "all" ||
      (user.user_type &&
        user.user_type.toLowerCase() === typeFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      // Assuming we might implement DELETE later, or just deactivate
      // For now, let's try to deactivate via PUT if DELETE not supported
      // But admin.routes.js doesn't have DELETE yet.
      // I'll skip DELETE implementation or just show alert.
      alert("Delete functionality not yet implemented in backend.");
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>🔐 User Management System</h1>
        <div className="user-header-actions">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link
            to="/administration/users/new"
            className="btn btn-primary"
            style={{
              textDecoration: "none",
              color: "white",
              padding: "10px 20px",
              borderRadius: "6px",
              background: "#28a745",
            }}
          >
            ➕ Create New User
          </Link>
          <button
            className="btn btn-secondary"
            onClick={fetchUsers}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              background: "#6c757d",
              color: "white",
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="user-search-section">
        <div className="user-search-box">
          <div className="user-form-group">
            <label>Search by Name/Email</label>
            <input
              type="text"
              className="user-form-control"
              placeholder="Enter name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="user-form-group">
            <label>Status</label>
            <select
              className="user-form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="user-table-container">
        <div className="user-stats">
          <div className="user-stat-card">
            <h3>Total Users</h3>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="user-stat-card">
            <h3>Active Users</h3>
            <div className="stat-value">{stats.active}</div>
          </div>
          <div className="user-stat-card">
            <h3>Inactive Users</h3>
            <div className="stat-value">{stats.inactive}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading users...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Email</th>
                <th>Company</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = (user.full_name || user.username || "?")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.profile_picture_url ? (
                              <img
                                src={user.profile_picture_url}
                                alt={user.username}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="user-details">
                            <span className="user-name">
                              {user.full_name || "N/A"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.user_type || "Internal"}</td>
                      <td>{user.company_name || "N/A"}</td>
                      <td>{user.branch_name || "N/A"}</td>
                      <td>
                        {user.is_active ? (
                          <span className="user-status-badge user-status-active">
                            Active
                          </span>
                        ) : (
                          <span className="user-status-badge user-status-inactive">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        <div className="user-action-buttons">
                          <Link
                            to={`/administration/users/${user.id}`}
                            className="btn"
                            style={{
                              background: "#007bff",
                              color: "white",
                              padding: "6px 12px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              textDecoration: "none",
                            }}
                          >
                            ✏️ Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
