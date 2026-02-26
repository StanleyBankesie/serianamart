import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function CustomerList() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteRaw, setBulkDeleteRaw] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkForce, setBulkForce] = useState(false);
  const [bulkCascade, setBulkCascade] = useState(false);
  const [bulkCleanupFinance, setBulkCleanupFinance] = useState(false);
  const { hasAccess, scope } = useAuth();
  const { canPerformAction } = usePermission();
  const [branchOnly, setBranchOnly] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/sales/customers", {
        params: { active: true },
      });
      const items =
        (response.data && response.data.data && response.data.data.items) ||
        response.data?.items ||
        [];
      setCustomers(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching customers");
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get("/sales/customers/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "CustomerTemplate.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading template", err);
      alert("Error downloading template");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await api.post("/sales/customers/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Customers imported successfully!");
      fetchCustomers();
    } catch (err) {
      console.error("Error importing customers", err);
      alert(err?.response?.data?.message || "Error importing customers");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredCustomers = customers.filter(
    (r) =>
      r &&
      (String(r.customer_code || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
        String(r.customer_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(r.email || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  if (loading) {
    return <div className="text-center py-8">Loading customers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Customer Setup
            </h1>
            <p className="text-sm mt-1">
              Manage customers and their information
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="btn btn-secondary">
              Template
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              className="btn btn-primary"
            >
              Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx, .xls"
              onChange={handleImport}
            />
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/sales/customers/new" className="btn-success">
              + New Customer
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
              placeholder="Search customers..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={branchOnly}
                onChange={(e) => setBranchOnly(e.target.checked)}
              />
              <span>Show current branch only</span>
            </label>
            <button className="btn btn-outline" onClick={fetchCustomers}>
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
                </tr>
              </thead>
              <tbody>
                {(branchOnly
                  ? filteredCustomers.filter(
                      (x) =>
                        String(x.branch_id || "") ===
                        String(scope?.branchId || ""),
                    )
                  : filteredCustomers
                ).map((r) => (
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
                      {canPerformAction("sales:customers", "edit") && (
                        <button
                          className="text-brand hover:text-brand-600 text-sm font-medium"
                          onClick={() => navigate(`/sales/customers/${r.id}`)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                No customers found
              </div>
            )}
          </div>
        </div>
      </div>

      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Bulk Delete Customers</h2>
              <button
                onClick={() => {
                  setShowBulkDelete(false);
                  setBulkDeleteRaw("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Paste names and/or codes. Raw blobs accepted; codes like C00003
                will be detected.
              </div>
              <textarea
                className="input w-full h-40"
                placeholder="Enter customer names/codes/raw data..."
                value={bulkDeleteRaw}
                onChange={(e) => setBulkDeleteRaw(e.target.value)}
              />
              <div className="text-xs text-slate-600">
                This action deletes matching customers for the current company.
              </div>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkForce}
                  onChange={(e) => setBulkForce(e.target.checked)}
                />
                <span>Force delete (temporarily disable constraints)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkCascade}
                  onChange={(e) => setBulkCascade(e.target.checked)}
                />
                <span>Cascade delete (remove dependent sales rows)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={bulkCleanupFinance}
                  onChange={(e) => setBulkCleanupFinance(e.target.checked)}
                />
                <span>Also cleanup finance accounts</span>
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowBulkDelete(false);
                  setBulkDeleteRaw("");
                }}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!bulkDeleteRaw.trim()) {
                    alert("Enter names or codes to delete.");
                    return;
                  }
                  if (
                    !window.confirm(
                      "Are you sure you want to delete the provided customers?",
                    )
                  ) {
                    return;
                  }
                  try {
                    setBulkDeleting(true);
                    const res = await api.post("/sales/customers/bulk-delete", {
                      raw: bulkDeleteRaw,
                      force: bulkForce,
                      cascade: bulkCascade,
                      cleanup_finance: bulkCleanupFinance,
                    });
                    const a = Number(res?.data?.deletedByName || 0);
                    const b = Number(res?.data?.deletedByCode || 0);
                    const matched = Number(res?.data?.matched || 0);
                    const deleted = Number(res?.data?.deleted || a + b);
                    const msg =
                      a || b
                        ? `Deleted by name: ${a}\nDeleted by code: ${b}\nTotal: ${
                            a + b
                          }`
                        : `Matched: ${matched}\nDeleted: ${deleted}`;
                    alert(msg);
                    setShowBulkDelete(false);
                    setBulkDeleteRaw("");
                    await fetchCustomers();
                  } catch (err) {
                    alert(
                      err?.response?.data?.message ||
                        "Bulk delete failed. Ensure you have delete rights.",
                    );
                  } finally {
                    setBulkDeleting(false);
                  }
                }}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
