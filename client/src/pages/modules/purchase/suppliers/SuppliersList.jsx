import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";

export default function SuppliersList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/purchase/suppliers")
      .then((res) => {
        if (!mounted) return;
        setSuppliers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
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
    return suppliers.filter((s) => {
      return (
        String(s.supplier_code || "")
          .toLowerCase()
          .includes(q) ||
        String(s.supplier_name || "")
          .toLowerCase()
          .includes(q) ||
        String(s.phone || "")
          .toLowerCase()
          .includes(q) ||
        String(s.email || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Supplier Details Setup
              </h1>
              <p className="text-sm mt-1">
                Add and manage supplier master data
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/purchase" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/purchase/suppliers/new" className="btn-success">
                + New Supplier
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
              placeholder="Search by code, name, phone, email..."
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
                  <th>Phone</th>
                  <th>Email</th>
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

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No suppliers found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {s.supplier_code || "-"}
                    </td>
                    <td>{s.supplier_name}</td>
                    <td>{s.phone || "-"}</td>
                    <td>{s.email || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          s.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {s.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/purchase/suppliers/${s.id}?mode=view`}
                        className="text-brand hover:text-brand-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/purchase/suppliers/${s.id}?mode=edit`}
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







