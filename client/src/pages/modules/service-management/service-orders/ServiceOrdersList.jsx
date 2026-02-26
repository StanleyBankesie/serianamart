import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function ServiceOrdersList() {
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const successMsg = location.state?.success || "";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const resp = await api.get("/purchase/service-orders");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setItems(rows);
      } catch (e) {
        if (mounted) {
          setError("No service order API found. Showing placeholder list.");
          setItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = String(search || "").toLowerCase();
    if (!q) return items;
    return (items || []).filter((it) => {
      const text =
        [
          it.order_no,
          it.customer_name,
          it.service_type,
          it.status,
          it.work_location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase() || "";
      return text.includes(q);
    });
  }, [items, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Service Orders</div>
            <div className="flex gap-2">
              <Link to="/service-management" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/service-management/service-orders/new"
                className="btn-success"
              >
                + New Order
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {successMsg ? (
            <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
              {successMsg}
            </div>
          ) : null}
          {error ? (
            <div className="text-sm text-red-600 mb-3">{error}</div>
          ) : null}
          <div className="mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-slate-500">
                      No service orders
                    </td>
                  </tr>
                ) : null}
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td>{it.order_no}</td>
                    <td>{it.order_date}</td>
                    <td>{it.customer_name}</td>
                    <td>{it.service_type}</td>
                    <td>{it.status}</td>
                    <td className="text-right">
                      {Number(it.total_amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {canPerformAction("service-management:service-orders", "view") && (
                          <Link
                            to={`/service-management/service-orders/${it.id}`}
                            className="btn btn-secondary btn-sm"
                          >
                            View
                          </Link>
                        )}
                        {canPerformAction("service-management:service-orders", "edit") && (
                          <Link
                            to={`/service-management/service-orders/${it.id}`}
                            className="btn btn-primary btn-sm"
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
