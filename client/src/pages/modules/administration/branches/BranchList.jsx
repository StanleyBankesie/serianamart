import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import "../../../../styles/BranchSetup.css";

// Sub-component for User Assignment
function UserAssignmentTab({ branches, companies, onUpdate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignForm, setAssignForm] = useState({
    companyId: "",
    branchIds: [],
  });
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/users");
      setUsers(res.data.items || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = async (user) => {
    setSelectedUser(user);
    const base = {
      companyId: user.company_id || "",
      branchIds: user.branch_id ? [String(user.branch_id)] : [],
    };
    try {
      const res = await api.get(`/admin/users/${user.id}/branches`);
      const ids = Array.isArray(res.data?.items)
        ? res.data.items.map((b) => String(b.id))
        : [];
      setAssignForm({ ...base, branchIds: ids });
    } catch {
      setAssignForm(base);
    }
    setAssignModalOpen(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setAssignLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/branches`, {
        company_id: assignForm.companyId,
        branch_ids: assignForm.branchIds.map((x) => Number(x)),
      });
      await fetchUsers(); // Refresh local list
      if (onUpdate) onUpdate(); // Refresh parent stats if needed
      setAssignModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      alert("Failed to update user branch: " + err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // Filter branches for assignment modal
  const filteredBranches = assignForm.companyId
    ? branches.filter(
        (b) => String(b.company_id) === String(assignForm.companyId)
      )
    : [];

  const filteredUsers = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.full_name && u.full_name.toLowerCase().includes(s))
    );
  });

  return (
    <div>
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={fetchUsers}>
          🔄 Refresh Users
        </button>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="p-8 text-center">Loading users...</div>
        ) : (
          <table className="branch-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Current Company</th>
                <th>Current Branch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-4">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </td>
                    <td>{u.company_name || "Unassigned"}</td>
                    <td>{u.branch_name || "Unassigned"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openAssignModal(u)}
                      >
                        Assign Branch
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {assignModalOpen && (
        <div className="branch-modal-overlay">
          <div className="branch-modal" style={{ maxWidth: "500px" }}>
            <div className="branch-modal-header">
              <h2>Assign Branch to {selectedUser?.username}</h2>
              <button
                className="branch-close-btn"
                onClick={() => setAssignModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="branch-modal-body">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Company
                  </label>
                  <select
                    className="search-input w-full"
                    value={assignForm.companyId}
                    onChange={(e) =>
                      setAssignForm({
                        ...assignForm,
                        companyId: e.target.value,
                        branchId: "",
                      })
                    }
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Branches
                  </label>
                  <div className="space-y-2 max-h-64 overflow-auto border rounded-md p-2">
                    {filteredBranches.map((b) => {
                      const checked = assignForm.branchIds.includes(
                        String(b.id)
                      );
                      return (
                        <label key={b.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setAssignForm((prev) => {
                                const set = new Set(prev.branchIds);
                                if (isChecked) set.add(String(b.id));
                                else set.delete(String(b.id));
                                return {
                                  ...prev,
                                  branchIds: Array.from(set),
                                };
                              });
                            }}
                            disabled={!assignForm.companyId}
                          />
                          <span className="text-sm">{b.name}</span>
                        </label>
                      );
                    })}
                    {!assignForm.companyId ? (
                      <div className="text-xs text-gray-500">
                        Select a company to view branches
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="branch-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={assignLoading}
                >
                  {assignLoading ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BranchList() {
  const [activeTab, setActiveTab] = useState("branches"); // Default to branches as requested by sync task
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]); // Store companies for dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState(null); // null for new, object for edit
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    companyId: "",
    name: "",
    code: "",
    isActive: true,
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    location: "",
    telephone: "",
    email: "",
    remarks: "",
  });

  // Stats (derived or mock)
  const stats = {
    totalBranches: branches.length,
    activeBranches: branches.filter((b) => b.is_active).length,
    activeUsers: 0, // Placeholder
    assignments: 0, // Placeholder
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [branchesRes, companiesRes] = await Promise.all([
        api.get("/admin/branches"),
        api.get("/admin/companies"),
      ]);
      setBranches(branchesRes.data.items || []);
      setCompanies(companiesRes.data.items || []);
    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      // Refresh only branches after update
      const res = await api.get("/admin/branches");
      setBranches(res.data.items || []);
    } catch (err) {
      console.error("Failed to refresh branches", err);
    }
  };

  const openModal = (branch = null) => {
    setCurrentBranch(branch);
    if (branch) {
      setFormData({
        companyId: branch.company_id,
        name: branch.name,
        code: branch.code,
        isActive: branch.is_active,
        address: branch.address || "",
        city: branch.city || "",
        state: branch.state || "",
        postal_code: branch.postal_code || "",
        country: branch.country || "",
        location: branch.location || "",
        telephone: branch.telephone || "",
        email: branch.email || "",
        remarks: branch.remarks || "",
      });
    } else {
      setFormData({
        companyId: "",
        name: "",
        code: "",
        isActive: true,
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
        location: "",
        telephone: "",
        email: "",
        remarks: "",
      });
    }
    setModalError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentBranch(null);
    setModalError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError("");

    try {
      if (currentBranch) {
        // Update
        await api.put(`/admin/branches/${currentBranch.id}`, {
          company_id: formData.companyId,
          name: formData.name,
          code: formData.code,
          is_active: formData.isActive,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          location: formData.location || null,
          telephone: formData.telephone || null,
          email: formData.email || null,
          remarks: formData.remarks || null,
        });
      } else {
        // Create
        await api.post("/admin/branches", {
          company_id: formData.companyId,
          name: formData.name,
          code: formData.code,
          is_active: formData.isActive,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          location: formData.location || null,
          telephone: formData.telephone || null,
          email: formData.email || null,
          remarks: formData.remarks || null,
        });
      }
      await fetchBranches();
      closeModal();
    } catch (err) {
      setModalError(
        err?.response?.data?.message || err.message || "Failed to save branch"
      );
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="branch-setup-container">
      <div className="branch-header">
        <div>
          <h1>🏢 Branch Management System</h1>
        </div>
        <div className="header-actions">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="branch-content">
        {/* Stats Section */}
        <div className="branch-stats">
          <div className="branch-stat-card">
            <h3>Total Branches</h3>
            <div className="value">{stats.totalBranches}</div>
          </div>
          <div className="branch-stat-card">
            <h3>Active Branches</h3>
            <div className="value">{stats.activeBranches}</div>
          </div>
          <div className="branch-stat-card">
            <h3>Assignments</h3>
            <div className="value">{stats.assignments}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="branch-tabs">
          <button
            className={`branch-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 User Branch Assignment
          </button>
          <button
            className={`branch-tab ${activeTab === "branches" ? "active" : ""}`}
            onClick={() => setActiveTab("branches")}
          >
            🏢 Branch Management
          </button>
          <button
            className={`branch-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📊 Assignment History
          </button>
        </div>

        {/* Branch Management Tab */}
        <div
          className={`tab-content ${activeTab === "branches" ? "active" : ""}`}
        >
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search branches..."
            />
            <button className="btn btn-success" onClick={() => openModal(null)}>
              ➕ Add New Branch
            </button>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : (
              <table className="branch-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="text-center py-4 text-gray-500"
                      >
                        No branches found
                      </td>
                    </tr>
                  ) : (
                    branches.map((b) => (
                      <tr key={b.id}>
                        <td className="font-medium">{b.code}</td>
                        <td>{b.name}</td>
                        <td>{b.company_name || "N/A"}</td>
                        <td>
                          {b.is_active ? (
                            <span className="branch-badge branch-badge-success">
                              Active
                            </span>
                          ) : (
                            <span className="branch-badge branch-badge-danger">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openModal(b)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* User Assignment Tab */}
        <div className={`tab-content ${activeTab === "users" ? "active" : ""}`}>
          <UserAssignmentTab
            branches={branches}
            companies={companies}
            onUpdate={fetchData}
          />
        </div>

        {/* History Tab (Placeholder) */}
        <div
          className={`tab-content ${activeTab === "history" ? "active" : ""}`}
        >
          <div className="p-8 text-center text-gray-500">
            <p>History log coming soon.</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="branch-modal-overlay">
          <div className="branch-modal">
            <div className="branch-modal-header">
              <h2>{currentBranch ? "Edit Branch" : "New Branch"}</h2>
              <button className="branch-close-btn" onClick={closeModal}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="branch-modal-body">
                {modalError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {modalError}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Company *
                  </label>
                  <select
                    className="search-input w-full"
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData({ ...formData, companyId: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    className="search-input w-full"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    className="search-input w-full"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Status
                  </label>
                  <select
                    className="search-input w-full"
                    value={formData.isActive ? "1" : "0"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isActive: e.target.value === "1",
                      })
                    }
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.postal_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          postal_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Telephone
                    </label>
                    <input
                      type="text"
                      className="search-input w-full"
                      value={formData.telephone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          telephone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className="search-input w-full"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Remarks
                    </label>
                    <textarea
                      className="search-input w-full"
                      rows="3"
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="branch-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={modalLoading}
                >
                  {modalLoading ? "Saving..." : "Save Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
