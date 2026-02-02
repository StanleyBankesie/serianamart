import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function WarehousesList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/warehouses")
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load warehouses");
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
    return warehouses.filter((w) => {
      return (
        String(w.warehouse_code || "")
          .toLowerCase()
          .includes(q) ||
        String(w.warehouse_name || "")
          .toLowerCase()
          .includes(q) ||
        String(w.location || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [warehouses, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Warehouse Setup
              </h1>
              <p className="text-sm mt-1">
                Configure warehouses for stock operations
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/warehouses/new" className="btn-success">
                + New Warehouse
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
              placeholder="Search by code, name, location..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Location</th>
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
                      No warehouses found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {w.warehouse_code}
                    </td>
                    <td>{w.warehouse_name}</td>
                    <td>{w.location || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          w.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {w.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/inventory/warehouses/${w.id}?mode=view`}
                        className="text-brand hover:text-brand-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/inventory/warehouses/${w.id}?mode=edit`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                      >
                        Edit
                      </Link>
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
