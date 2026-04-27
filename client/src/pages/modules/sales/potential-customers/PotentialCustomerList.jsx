import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useDispatch, useSelector } from "react-redux";
import { useAfterSaveRefresh } from "../../../../hooks/useAfterSaveRefresh.js";

export default function PotentialCustomerList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteRaw, setBulkDeleteRaw] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [branchOnly, setBranchOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { hasAccess, scope } = useAuth();
  const { canPerformAction } = usePermission();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sales/prospect-customers", {
        params: { active: !showInactive },
      });
      setCustomers(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error fetching prospective customers",
      );
      console.error("Error fetching prospective customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [showInactive]);

  useAfterSaveRefresh("prospect_customers", fetchCustomers);

  const refresh = () => {
    fetchCustomers();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.delete(`/sales/prospect-customers/${id}`);
      alert("Prospective customer deleted successfully!");
      fetchCustomers();
    } catch (err) {
      alert(
        err?.response?.data?.message || "Error deleting prospective customer",
      );
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.customer_code &&
        c.customer_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const branchFiltered = branchOnly
    ? filteredCustomers.filter(
        (x) => String(x.branch_id || "") === String(scope?.branchId || ""),
      )
    : filteredCustomers;

  if (loading && customers.length === 0) {
    return (
      <div className="text-center py-8">Loading prospective customers...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Prospective Customer Setup
            </h1>
            <p className="text-sm mt-1">
              Manage prospective customers and quotation information
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/sales/prospect-customers/new" className="btn-success">
              + New Prospective Customer
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name, code, or email..."
              className="input flex-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={branchOnly}
                onChange={(e) => setBranchOnly(e.target.checked)}
              />
              Branch Only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show Inactive
            </label>
            <button className="btn btn-outline" onClick={refresh}>
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Price Type</th>
                  <th>Contact</th>
                  <th>Email/Phone</th>
                  <th>Credit Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {branchFiltered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.customer_code}</td>
                    <td>
                      <div className="font-bold">{r.customer_name}</div>
                      {r.address && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">
                          {r.address}
                        </div>
                      )}
                    </td>
                    <td>{r.customer_type || "-"}</td>
                    <td>{r.price_type_name || "-"}</td>
                    <td>{r.contact_person || "-"}</td>
                    <td>
                      <div className="text-sm">{r.email}</div>
                      <div className="text-xs text-slate-500">{r.phone}</div>
                    </td>
                    <td>
                      {r.credit_limit
                        ? `${Number(r.credit_limit).toFixed(2)}`
                        : "-"}
                    </td>
                    <td>
                      {r.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {canPerformAction(
                          "sales:potential-customers",
                          "edit",
                        ) && (
                          <button
                            className="text-brand hover:text-brand-600 text-sm font-medium"
                            onClick={() =>
                              navigate(`/sales/potential-customers/${r.id}`)
                            }
                          >
                            Edit
                          </button>
                        )}
                        {canPerformAction(
                          "sales:potential-customers",
                          "delete",
                        ) && (
                          <button
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            onClick={() => handleDelete(r.id, r.customer_name)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {branchFiltered.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                {customers.length === 0
                  ? "No potential customers found. Create one to get started."
                  : "No matching potential customers found"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
