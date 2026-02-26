import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";

export default function UnitConversionsList() {
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
      .get("/inventory/unit-conversions")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load unit conversions"
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

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((c) => {
      return (
        String(c.item_code || "")
          .toLowerCase()
          .includes(q) ||
        String(c.item_name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.from_uom || "")
          .toLowerCase()
          .includes(q) ||
        String(c.to_uom || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Unit Conversion
              </h1>
              <p className="text-sm mt-1">Define unit conversions per item</p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/unit-conversions/new"
                className="btn-success"
              >
                + New Conversion
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
              placeholder="Search by item, from/to UOM..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Factor</th>
                  <th>Active</th>
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

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No unit conversions found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {c.item_code} - {c.item_name}
                      </div>
                    </td>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {c.from_uom}
                    </td>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {c.to_uom}
                    </td>
                    <td>{c.conversion_factor}</td>
                    <td>{c.is_active ? "Yes" : "No"}</td>
                    <td>
                      {canPerformAction("inventory:unit-conversions", "view") && (
                        <Link
                          to={`/inventory/unit-conversions/${c.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:unit-conversions", "edit") && (
                        <Link
                          to={`/inventory/unit-conversions/${c.id}?mode=edit`}
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
