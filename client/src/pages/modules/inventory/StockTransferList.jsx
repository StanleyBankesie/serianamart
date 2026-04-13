import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";

export default function StockTransferList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshData = () => {
    setLoading(true);
    setError("");
    api
      .get("/inventory/stock-transfers")
      .then((res) => {
        setTransfers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        setError(
          e?.response?.data?.message || "Failed to load stock transfers",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshData();
  }, []);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    id: null,
    loading: false,
  });

  const handleConfirm = async () => {
    const { id } = confirmDialog;
    if (!id) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    try {
      await api.put(`/inventory/stock-transfers/${id}/status`, {
        status: "IN TRANSIT",
      });
      refreshData();
      setConfirmDialog({ open: false, id: null, loading: false });
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to confirm transfer");
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      IN_TRANSIT: "badge-warning",
      "IN TRANSIT": "badge-warning",
      RECEIVED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredTransfers = useMemo(() => {
    if (!searchTerm.trim()) return transfers.slice();
    return filterAndSort(transfers, {
      query: searchTerm,
      getKeys: (t) => [
        t.transfer_no,
        t.from_branch,
        t.to_branch,
        t.from_warehouse,
        t.to_warehouse,
        t.status,
      ],
    });
  }, [transfers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
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
                  <th>From Warehouse</th>
                  <th>To Branch</th>
                  <th>To Warehouse</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : null}
                {filteredTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {transfer.transfer_no}
                    </td>
                    <td>
                      {transfer.transfer_date
                        ? new Date(transfer.transfer_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )
                        : "-"}
                    </td>
                    <td>{transfer.from_branch || "-"}</td>
                    <td>{transfer.from_warehouse || "-"}</td>
                    <td>{transfer.to_branch || "-"}</td>
                    <td>{transfer.to_warehouse || "-"}</td>
                    <td>{transfer.item_count}</td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(transfer.status)}`}
                      >
                        {transfer.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <Link
                          to={`/inventory/stock-transfers/${transfer.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                        {transfer.status === "DRAFT" ? (
                          <>
                            <Link
                              to={`/inventory/stock-transfers/${transfer.id}?mode=edit`}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  id: transfer.id,
                                  loading: false,
                                })
                              }
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm"
                            >
                              Confirm Transfer
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Confirm Transfer</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to confirm this transfer?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  onClick={() =>
                    setConfirmDialog({ open: false, id: null, loading: false })
                  }
                  disabled={confirmDialog.loading}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                  onClick={handleConfirm}
                  disabled={confirmDialog.loading}
                >
                  {confirmDialog.loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Confirming...
                    </>
                  ) : (
                    "Confirm Transfer"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingCreateButton
        to="/inventory/stock-transfers/new"
        title="New Stock Transfer"
      />
    </div>
  );
}
