import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function ServiceExecutionsList() {
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const success = location.state?.success || "";

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/purchase/service-executions");
      const arr =
        (res.data && res.data.data && res.data.data.items) ||
        res.data?.items ||
        [];
      setItems(arr);
    } catch (e) {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Service Executions</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/service-management" className="btn-secondary">
            Back to Menu
          </Link>
          <Link to="/service-management/service-execution" className="btn">
            New Execution
          </Link>
        </div>
      </div>
      {success ? (
        <div className="p-2 rounded bg-green-50 text-green-700 border border-green-200">
          {success}
        </div>
      ) : null}
      {error ? <div className="text-red-600">{error}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution No</th>
                    <th>Order No</th>
                    <th>Type</th>
                    <th>Supervisor</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.execution_no || ""}</td>
                      <td>{it.order_no || ""}</td>
                      <td>{String(it.order_type || "")}</td>
                      <td>
                        {it.assigned_supervisor_username ||
                          it.assigned_supervisor_user_id ||
                          ""}
                      </td>
                      <td>{it.execution_date || ""}</td>
                      <td>{it.status || ""}</td>
                      <td>
                        {canPerformAction("service-management:service-executions", "view") && (
                          <Link
                            to={`/service-management/service-executions/${it.id}`}
                            className="btn-secondary btn-sm"
                          >
                            View
                          </Link>
                        )}
                        {canPerformAction("service-management:service-executions", "edit") && (
                          <Link
                            to={`/service-management/service-execution?id=${it.id}&mode=edit`}
                            className="btn-primary btn-sm ml-2"
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500">
                        No service executions found
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
