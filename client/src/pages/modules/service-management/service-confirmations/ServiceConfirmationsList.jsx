/**
 * @fileoverview ServiceConfirmationsList component.
 * Provides functionality for ServiceConfirmationsList.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceConfirmationsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingExecutions, setPendingExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { canPerformAction } = usePermission();
  const loadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      api.get("/purchase/service-confirmations").catch(() => ({ data: { items: [] } })),
      api.get("/purchase/service-orders", { params: { type: "EXTERNAL" } }).catch(() => ({ data: { items: [] } })),
      api.get("/purchase/service-executions", { params: { type: "EXTERNAL" } }).catch(() => ({ data: { items: [] } })),
    ])
      .then(([confRes, orderRes, execRes]) => {
        if (!mounted) return;
        const confirmations = Array.isArray(confRes.data?.items) ? confRes.data.items : [];
        const allOrders = Array.isArray(orderRes.data?.items) ? orderRes.data.items : [];
        const allExecs = Array.isArray(execRes.data?.items) ? execRes.data.items : [];

        const confirmedOrderIds = new Set(confirmations.map((c) => String(c.order_id || "")));

        const pending = allOrders.filter(
          (o) => String(o.status || "").toUpperCase() !== "DONE"
        );
        setPendingOrders(pending);

        const pendingExec = allExecs.filter(
          (e) => ["POSTED", "APPROVED"].includes(String(e.status || "").toUpperCase()),
        );
        setPendingExecutions(pendingExec);
        setItems(confirmations);
        loadedRef.current = true;
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load service confirmations",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const q = searchTerm.trim().toLowerCase();

  const filtered = items.filter((c) => {
    if (!q) return true;
    return [c.sc_no, c.supplier_name, c.status].some(
      (v) => String(v || "").toLowerCase().includes(q),
    );
  });

  const filteredPendingOrders = pendingOrders.filter((o) => {
    if (!q) return true;
    return [o.order_no, o.customer_name, o.service_type, o.status].some(
      (v) => String(v || "").toLowerCase().includes(q),
    );
  });

  const filteredPendingExecs = pendingExecutions.filter((e) => {
    if (!q) return true;
    return [e.execution_no, e.order_no, e.customer_name, e.status].some(
      (v) => String(v || "").toLowerCase().includes(q),
    );
  });

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Service Confirmation
              </h1>
              <p className="text-sm mt-1">Confirm service receipts</p>
            </div>
            <div className="flex gap-2">
              <Link to="/service-management" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/service-management/service-orders"
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                View Confirmed Orders
              </Link>
              <Link
                to="/service-management/service-confirmation/new"
                className="btn-success"
              >
                + New Confirmation
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
              placeholder="Search by no, supplier, status..."
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
                  <th>Supplier / Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length && !filteredPendingOrders.length && !filteredPendingExecs.length ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No confirmations found
                    </td>
                  </tr>
                ) : null}

                {filteredPendingOrders.map((o) => (
                  <tr key={`order-${o.id}`} className="bg-blue-50/30 dark:bg-blue-900/10">
                    <td colSpan="8" className="p-0">
                      <div className="grid grid-cols-8 gap-0 items-center px-3 py-2">
                        <div className="font-medium text-blue-700 dark:text-blue-300">
                          {o.order_no || "-"}
                        </div>
                        <div>{o.order_date ? String(o.order_date).slice(0, 10) : "-"}</div>
                        <div>{o.customer_name || "-"}</div>
                        <div>{Number(o.total_amount || 0).toFixed(2)}</div>
                        <div>
                          <span className="badge badge-info">
                            {o.status || "-"}
                          </span>
                        </div>
                        <div>
                          <Link
                            to={`/service-management/service-confirmation/new?order_id=${o.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                          >
                            + Create Confirmation
                          </Link>
                        </div>
                        <div>{o.created_by_name || "-"}</div>
                        <div>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"}</div>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredPendingOrders.length > 0 && (
                  <tr>
                    <td colSpan="8" className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      ↑ Pending Service Orders (Ready for Confirmation)
                    </td>
                  </tr>
                )}

                {filteredPendingExecs.map((e) => (
                  <tr key={`exec-${e.id}`} className="bg-amber-50/30 dark:bg-amber-900/10">
                    <td colSpan="8" className="p-0">
                      <div className="grid grid-cols-8 gap-0 items-center px-3 py-2">
                        <div className="font-medium text-amber-700 dark:text-amber-300">
                          {e.execution_no || "-"}
                        </div>
                        <div>{e.execution_date ? String(e.execution_date).slice(0, 10) : "-"}</div>
                        <div>{e.customer_name || e.order_no || "-"}</div>
                        <div>-</div>
                        <div>
                          <span className="badge badge-info">
                            {e.status || "-"}
                          </span>
                        </div>
                        <div>
                          <Link
                            to={`/service-management/service-confirmation/new?execution_id=${e.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                          >
                            + Create Confirmation
                          </Link>
                        </div>
                        <div>{e.created_by_name || "-"}</div>
                        <div>{e.created_at ? new Date(e.created_at).toLocaleDateString() : "-"}</div>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredPendingExecs.length > 0 && (
                  <tr>
                    <td colSpan="8" className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      ↑ Pending Service Executions (Ready for Confirmation)
                    </td>
                  </tr>
                )}

                {filtered.length > 0 && (
                  <>
                    {(filteredPendingOrders.length > 0 || filteredPendingExecs.length > 0) ? (
                      <tr>
                        <td colSpan="8" className="bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Confirmed Service Orders
                        </td>
                      </tr>
                    ) : null}
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium text-brand-700 dark:text-brand-300">
                          {c.sc_no}
                        </td>
                        <td>{c.sc_date ? String(c.sc_date).slice(0, 10) : "-"}</td>
                        <td>{c.supplier_name || "-"}</td>
                        <td>{Number(c.total_amount || 0).toFixed(2)}</td>
                        <td>
                          <span className="badge badge-info">
                            {c.status || "DRAFT"}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link
                              to={`/service-management/service-confirmation/${c.id}?mode=view`}
                              className={`text-brand hover:text-brand-700 text-sm font-medium ${!canPerformAction("service-management:service-confirmations", "view") ? 'invisible pointer-events-none' : ''}`}
                            >
                              View
                            </Link>
                            {String(c.status || "").toUpperCase() !== "APPROVED" && (
                              <Link
                                to={`/service-management/service-confirmation/${c.id}?mode=edit`}
                                className={`text-blue-600 hover:text-blue-700 text-sm font-medium ${!canPerformAction("service-management:service-confirmations", "edit") ? 'invisible pointer-events-none' : ''}`}
                              >
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                        <td>{c.created_by_name || "-"}</td>
                        <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
