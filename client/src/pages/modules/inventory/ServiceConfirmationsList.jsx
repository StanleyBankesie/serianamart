import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";

export default function ServiceConfirmationsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/service-confirmations")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load service confirmations"
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
        String(c.sc_no || "")
          .toLowerCase()
          .includes(q) ||
        String(c.supplier_name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.status || "")
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
                Service Confirmation
              </h1>
              <p className="text-sm mt-1">
                Confirm service receipts
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/purchase/service-confirmation/new"
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
                  <th>Supplier</th>
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

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No confirmations found
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
                          to={`/purchase/service-confirmation/${c.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                        <Link
                          to={`/purchase/service-confirmation/${c.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Edit
                        </Link>
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






