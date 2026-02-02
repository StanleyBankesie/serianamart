import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function PurchaseOrdersLocalList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/purchase/orders")
      .then((res) => {
        if (!mounted) return;
        const all = Array.isArray(res.data?.items) ? res.data.items : [];
        setPurchaseOrders(
          all.filter((po) => String(po.po_type || "").toUpperCase() === "LOCAL")
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load purchase orders"
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
    const statusConfig = {
      DRAFT: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-info",
      RECEIVED: "badge-success",
      RETURNED: "badge-error",
      CANCELLED: "badge-error",
    };
    return statusConfig[status] || "badge-info";
  };

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        String(po.po_no || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(po.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  const openForwardModal = async (po) => {
    setSelectedPO(po);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER"
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details"
      );
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER"
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details"
      );
    } finally {
      setWfLoading(false);
    }
  };

  const forwardForApproval = async () => {
    if (!selectedPO) return;
    const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
    const first = hasSteps ? workflowSteps[0] : null;
    const opts = first
      ? Array.isArray(first.approvers) && first.approvers.length
        ? first.approvers
        : first.approver_user_id
        ? [{ id: first.approver_user_id }]
        : []
      : [];
    if (candidateWorkflow && opts.length > 0 && !targetApproverId) {
      setWfError("Please select target approver");
      return;
    }
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(`/purchase/orders/${selectedPO.id}/submit`, {
        amount:
          selectedPO.total_amount === undefined ||
          selectedPO.total_amount === null
            ? null
            : Number(selectedPO.total_amount || 0),
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setPurchaseOrders((prev) =>
        prev.map((po) =>
          po.id === selectedPO.id ? { ...po, status: newStatus } : po
        )
      );
      setShowForwardModal(false);
      setSelectedPO(null);
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval"
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Orders - Local
          </h1>
          <p className="text-sm mt-1">Manage local purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link
            to="/purchase/purchase-orders-local/new"
            className="btn-success"
          >
            + New Purchase Order
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by PO no or supplier..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="RECEIVED">Received</option>
                <option value="RETURNED">Returned</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>PO No</th>
                <th>PO Date</th>
                <th>Supplier</th>
                <th className="text-right">Total Amount</th>
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
              ) : error ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="font-medium">{po.po_no}</td>
                    <td>
                      {po.po_date
                        ? new Date(po.po_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{po.supplier_name}</td>
                    <td className="text-right font-medium">
                      {Number(po.total_amount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/purchase/purchase-orders-local/${po.id}`}
                          className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                        >
                          View
                        </Link>
                        {po.status === "DRAFT" && (
                          <Link
                            to={`/purchase/purchase-orders-local/${po.id}/edit`}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                          >
                            Edit
                          </Link>
                        )}
                        {po.status === "APPROVED" ? (
                          <span className="text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                            Approved
                          </span>
                        ) : (po.status === "DRAFT" || po.status === "RETURNED") ? (
                          <button
                            type="button"
                            className="text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors"
                            onClick={() => openForwardModal(po)}
                          >
                            Forward for Approval
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span>
              Showing {filteredOrders.length} of {purchaseOrders.length} orders
            </span>
            <div className="flex gap-2">
              <button className="btn-success px-3 py-1.5" disabled>
                Previous
              </button>
              <button className="btn-success px-3 py-1.5" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95%]">
            <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
              <div className="font-semibold">
                Forward Purchase Order for Approval
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                  setSelectedPO(null);
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{selectedPO?.po_no || ""}</span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
              </div>
              <div>
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                      ? [
                          {
                            id: first.approver_user_id,
                            name:
                              first.approver_name ||
                              String(first.approver_user_id),
                          },
                        ]
                      : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${
                              firstApprover.stepName
                            }${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                  setSelectedPO(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardForApproval}
                disabled={
                  submittingForward ||
                  !selectedPO ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
