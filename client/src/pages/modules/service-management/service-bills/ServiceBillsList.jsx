import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function ServiceBillsList() {
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const successMsg = location.state?.success || "";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/purchase/service-bills")
      .then((res) => {
        setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message || "Failed to load service bills",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((r) => {
      const no = String(r.bill_no || "").toLowerCase();
      const client = String(r.client_name || "").toLowerCase();
      const st = String(r.status || "").toUpperCase();
      const matchSearch = !q || no.includes(q) || client.includes(q);
      const matchStatus =
        statusFilter === "ALL" || st === String(statusFilter).toUpperCase();
      return matchSearch && matchStatus;
    });
  }, [items, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Service Bills
          </h1>
          <p className="text-sm mt-1">Prepare and manage service bills</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/purchase/service-bills/new" className="btn-success">
            + New Bill
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {successMsg ? (
            <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
              {successMsg}
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 text-sm text-red-600">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by bill no or client..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center text-slate-500 dark:text-slate-400"
                    >
                      No service bills
                    </td>
                  </tr>
                ) : null}

                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.bill_no}</td>
                    <td>{r.bill_date}</td>
                    <td>{r.client_name || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          String(r.payment || "").toUpperCase() === "PAID"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {String(r.payment || "UNPAID").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          String(r.status || "").toUpperCase() === "PAID"
                            ? "badge-success"
                            : String(r.status || "").toUpperCase() === "OVERDUE"
                              ? "badge-error"
                              : "badge-warning"
                        }`}
                      >
                        {String(r.status || "").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {canPerformAction("service-management:service-bills", "view") && (
                          <Link
                            to={`/purchase/service-bills/${r.id}?mode=view`}
                            className="btn btn-xs btn-outline"
                          >
                            View
                          </Link>
                        )}
                        {canPerformAction("service-management:service-bills", "edit") && (
                          <Link
                            to={`/purchase/service-bills/${r.id}?mode=edit`}
                            className={`btn btn-xs btn-primary ${
                              String(r.payment || "").toUpperCase() === "PAID"
                                ? "pointer-events-none opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                            aria-disabled={
                              String(r.payment || "").toUpperCase() === "PAID"
                            }
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
