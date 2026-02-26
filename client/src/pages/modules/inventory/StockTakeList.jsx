import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";

export default function StockTakeList() {
  const { canPerformAction } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/stock-takes")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock takes");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((s) => {
      return (
        String(s.stock_take_no || "")
          .toLowerCase()
          .includes(q) ||
        String(s.status || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Daily Stock Take
              </h1>
              <p className="text-sm mt-1">
                Perform physical stock counts
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/stock-take/new" className="btn-success">
                + New Stock Take
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
              placeholder="Search by stock take no or status..."
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
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No stock takes found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {s.stock_take_no}
                    </td>
                    <td>
                      {s.stock_take_date
                        ? String(s.stock_take_date).slice(0, 10)
                        : "-"}
                    </td>
                    <td>{s.warehouse_name || "-"}</td>
                    <td>
                      <span className="badge badge-info">
                        {s.status || "DRAFT"}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("inventory:stock-take", "view") && (
                        <Link
                          to={`/inventory/stock-take/${s.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:stock-take", "edit") && (
                        <Link
                          to={`/inventory/stock-take/${s.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
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
    </div>
  );
}







