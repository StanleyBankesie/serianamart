import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function ServiceRequestsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const { canPerformAction } = usePermission();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/purchase/service-requests");
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setItems(rows);
      } catch (e) {
        const msg =
          e?.response?.data?.message || "Failed to load service requests";
        setError(msg);
        toast.error(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = String(searchTerm || "").toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      return (
        String(r.request_no || "").toLowerCase().includes(q) ||
        String(r.requester_company || "").toLowerCase().includes(q) ||
        String(r.requester_full_name || "").toLowerCase().includes(q) ||
        String(r.service_type || "").toLowerCase().includes(q) ||
        String(r.status || "").toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm]);

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Service Requests</div>
            <div className="flex gap-2">
              <Link to="/service-management" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/service-management/service-requests/new"
                className="btn-success"
              >
                + New Request
              </Link>
            </div>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by no, customer, service, status..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      No service requests found
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td>{r.request_no}</td>
                      <td>{r.request_date}</td>
                      <td>{r.requester_company || r.requester_full_name}</td>
                      <td>{String(r.service_type || "").replace(/_/g, " ")}</td>
                      <td className="capitalize">{r.priority}</td>
                      <td>{r.status}</td>
                      <td className="whitespace-nowrap">
                        {canPerformAction("service-management:service-requests", "view") && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm mr-2"
                            onClick={async () => {
                              try {
                                const resp = await api.get(
                                  `/purchase/service-requests/${r.id}`,
                                );
                                setViewItem(resp.data?.item || null);
                              } catch (e) {
                                toast.error(
                                  e?.response?.data?.message ||
                                    "Failed to load request",
                                );
                              }
                            }}
                          >
                            View
                          </button>
                        )}
                        {canPerformAction("service-management:service-requests", "edit") && (
                          <Link
                            to={`/service-management/service-requests/new?id=${r.id}`}
                            className="btn-primary btn-sm"
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {viewItem && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="card w-full max-w-lg">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Service Request Details</div>
            </div>
            <div className="card-body space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Request No</div>
                  <div className="text-sm">{viewItem.request_no}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="text-sm">{viewItem.request_date}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Customer</div>
                  <div className="text-sm">{viewItem.requester_full_name}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Address</div>
                  <div className="text-sm">{viewItem.requester_address}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="text-sm">{viewItem.requester_email}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  <div className="text-sm">{viewItem.requester_phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Service Type</div>
                  <div className="text-sm">{viewItem.service_type}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Priority</div>
                  <div className="text-sm capitalize">{viewItem.priority}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Title</div>
                  <div className="text-sm">{viewItem.request_title}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Description</div>
                  <div className="text-sm">{viewItem.description}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setViewItem(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
