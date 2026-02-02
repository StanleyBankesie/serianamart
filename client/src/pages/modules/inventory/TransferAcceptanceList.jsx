import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";

export default function TransferAcceptanceList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/transfer-acceptance")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load transfers");
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
    return items.filter((t) => {
      return (
        String(t.transfer_no || "")
          .toLowerCase()
          .includes(q) ||
        String(t.from_warehouse_name || t.from_warehouse_id || "")
          .toLowerCase()
          .includes(q) ||
        String(t.to_warehouse_name || t.to_warehouse_id || "")
          .toLowerCase()
          .includes(q) ||
        String(t.status || "")
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
                Transfer Acceptance
              </h1>
              <p className="text-sm mt-1">Receive transferred stock</p>
            </div>
            <Link to="/inventory" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by transfer no, from warehouse, status..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Transfer No</th>
                  <th>Date</th>
                  <th>From Warehouse</th>
                  <th>To Warehouse</th>
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
                      No transfers available for acceptance
                    </td>
                  </tr>
                ) : null}

                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {t.transfer_no}
                    </td>
                    <td>
                      {t.transfer_date
                        ? String(t.transfer_date).slice(0, 10)
                        : "-"}
                    </td>
                    <td>
                      {t.from_warehouse_name || t.from_warehouse_id || "-"}
                    </td>
                    <td>{t.to_warehouse_name || t.to_warehouse_id || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === "IN_TRANSIT"
                            ? "badge-warning"
                            : "badge-info"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/inventory/transfer-acceptance/${t.id}`}
                        className="text-brand hover:text-brand-700 text-sm font-medium"
                      >
                        Open
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
