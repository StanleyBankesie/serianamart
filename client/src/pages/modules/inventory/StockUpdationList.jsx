import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";

export default function StockUpdationList() {
  const location = useLocation();
  const { canReverseApproval } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [workflowsCache, setWorkflowsCache] = useState(null);

  const fetchAdjustments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/stock-updation");
      setAdjustments(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load stock updations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);
  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    let cancelled = false;
    async function ensureVisible() {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 5000) {
        try {
          const res = await api.get("/inventory/stock-updation");
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setAdjustments(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (a) =>
                String(a.adjustment_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((a) => Number(a.id) === Number(hid));
          } else {
            hit = arr.length > 0;
          }
          if (hit) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    ensureVisible();
    return () => {
      cancelled = true;
    };
  }, [
    location.state?.highlightRef,
    location.state?.highlightId,
    location.state?.refresh,
  ]);
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setAdjustments((prev) =>
          prev.map((r) =>
            Number(r.id) === id
              ? {
                  ...r,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : r,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-success",
      POSTED: "badge-success",
      REJECTED: "badge-error",
      CANCELLED: "badge-error",
      RETURNED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredAdjustments = useMemo(() => {
    if (!searchTerm.trim()) return adjustments.slice();
    return filterAndSort(adjustments, {
      query: searchTerm,
      getKeys: (adj) => [adj.updation_no],
    });
  }, [adjustments, searchTerm]);

  const formatDateOnly = (v) => {
    if (!v) return "";
    let d = new Date(v);
    if (isNaN(d.getTime())) {
      if (!isNaN(Number(v))) {
        d = new Date(Number(v));
      }
    }
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  };

  // Workflow Logic


  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Updation
              </h1>
              <p className="text-sm mt-1">
                Add stock items to the system
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/stock-updation/new" className="btn-success">
                + New Updation
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by document number..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Document No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                                <th>Created By</th>
                <th>Created Date</th>
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
                ) : error ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : null}

                {filteredAdjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {adj.updation_no}
                    </td>
                    <td>{formatDateOnly(adj.updation_date)}</td>
                    <td>
                      <span className="badge badge-success">
                        STOCK IN
                      </span>
                    </td>
                    <td>{adj.item_count}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(adj.status)} `}>
                        {adj.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <Link
                          to={`/inventory/stock-updation/${adj.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                        {!["APPROVED", "POSTED"].includes(
                          String(adj.status || "").toUpperCase(),
                        ) && (
                          <Link
                            to={`/inventory/stock-updation/${adj.id}?mode=edit`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Edit
                          </Link>
                        )}
                        {adj.status === "APPROVED" ? (
                          <>
                            <span className="text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                              Approved
                            </span>
                            {canReverseApproval() ? (
                              <button
                                type="button"
                                className="ml-2 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
                                onClick={async () => {
                                  try {
                                    await api.post(
                                      "/workflows/reverse-by-document",
                                      {
                                        document_type: "STOCK_UPDATION",
                                        document_id: adj.id,
                                      },
                                    );
                                    toast.success(
                                      "Approval reversed and document returned",
                                    );
                                    setAdjustments((prev) =>
                                      prev.map((x) =>
                                        x.id === adj.id
                                          ? {
                                              ...x,
                                              status: "RETURNED",
                                              forwarded_to_username: null,
                                            }
                                          : x,
                                      ),
                                    );
                                  } catch (e) {
                                    toast.error(
                                      e?.response?.data?.message ||
                                        "Reverse approval failed",
                                    );
                                  }
                                }}
                              >
                                Reverse Approval
                              </button>
                            ) : null}
                          </>
                        ) : adj.forwarded_to_username ? (
                          <span className="text-sm font-medium px-2 py-1 rounded bg-amber-500 text-white whitespace-nowrap inline-flex items-center">
                            Forwarded to {adj.forwarded_to_username}
                          </span>
                        ) : adj.status === "DRAFT" ||
                        adj.status === "RETURNED" ||
                        adj.status === "REJECTED" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await api.post(`/inventory/stock-updation/${adj.id}/submit`);
                                toast.success("Stock updation confirmed and approved");
                                fetchAdjustments();
                              } catch (e) {
                                toast.error(e?.response?.data?.message || "Confirmation failed");
                              }
                            }}
                            className="text-sm font-medium px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap inline-flex items-center"
                          >
                            Confirm Updation
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{adj.created_by_name || "-"}</td>
                    <td>{adj.created_at ? new Date(adj.created_at).toLocaleDateString() : "-"}</td>
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
