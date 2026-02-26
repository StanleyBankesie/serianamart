import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function ShippingAdviceList() {
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const { canPerformAction } = usePermission();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/purchase/shipping-advices")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load shipping advice"
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

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      IN_TRANSIT: "badge-warning",
      ARRIVED: "badge-success",
      CLEARED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((r) => {
      const no = String(r.advice_no || "").toLowerCase();
      const po = String(r.po_no || "").toLowerCase();
      const bl = String(r.bill_of_lading || "").toLowerCase();
      return no.includes(q) || po.includes(q) || bl.includes(q);
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Shipping Advice
          </h1>
          <p className="text-sm mt-1">Track shipments and vessel information</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          {canPerformAction("purchase:shipping-advice", "create") && (
            <Link to="/purchase/shipping-advice/new" className="btn-success">
              + New Shipping Advice
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by advice no / PO / vessel..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Advice No</th>
                <th>Date</th>
                <th>PO</th>
                <th>Supplier</th>
                <th>ETD</th>
                <th>ETA</th>
                <th>Status</th>
                <th>Actions</th>
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
              ) : error ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No records
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.advice_no}</td>
                    <td>
                      {r.advice_date
                        ? new Date(r.advice_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{r.po_no}</td>
                    <td>{r.supplier_name}</td>
                    <td>
                      {r.etd_date
                        ? new Date(r.etd_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.eta_date
                        ? new Date(r.eta_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("purchase:shipping-advice", "view") && (
                        <Link
                          to={`/purchase/shipping-advice/${r.id}?mode=view`}
                          className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("purchase:shipping-advice", "edit") && (
                        <Link
                          to={`/purchase/shipping-advice/${r.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium ml-2"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
