import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";

export default function StockTransferList() {
  const { canPerformAction } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/inventory/stock-transfers")
      .then((res) => {
        if (!mounted) return;
        setTransfers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load stock transfers"
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
      RECEIVED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const hay = `${t.transfer_no || ""} ${t.from_branch || ""} ${
        t.to_branch || ""
      }`.toLowerCase();
      return hay.includes(searchTerm.toLowerCase());
    });
  }, [transfers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Transfers
              </h1>
              <p className="text-sm mt-1">
                Transfer stock between warehouses and branches
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/stock-transfers/new" className="btn-success">
                + New Transfer
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by transfer number, from or to branch..."
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
                  <th>From Branch</th>
                  <th>To Branch</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : null}
                {filteredTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {transfer.transfer_no}
                    </td>
                    <td>{transfer.transfer_date}</td>
                    <td>{transfer.from_branch}</td>
                    <td>{transfer.to_branch}</td>
                    <td>{transfer.item_count}</td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(transfer.status)}`}
                      >
                        {transfer.status}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("inventory:stock-transfers", "view") && (
                        <Link
                          to={`/inventory/stock-transfers/${transfer.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:stock-transfers", "edit") && (
                        <Link
                          to={`/inventory/stock-transfers/${transfer.id}?mode=edit`}
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







