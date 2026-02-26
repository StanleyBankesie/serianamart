import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../../api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";

export default function MaterialRequisitionList() {
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const { canPerformAction } = usePermission();
  const [targetApproverId, setTargetApproverId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/material-requisitions")
      .then((res) => {
        if (!mounted) return;
        setRequisitions(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load material requisitions",
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
      PENDING: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      SUBMITTED: "badge-warning",
      APPROVED: "badge-success",
      ISSUED: "badge-success",
      REJECTED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const no = String(req.requisition_no || "").toLowerCase();
      const by = String(req.requested_by || "").toLowerCase();
      const q = searchTerm.toLowerCase();
      return no.includes(q) || by.includes(q);
    });
  }, [requisitions, searchTerm]);

  const openForwardModal = async (req) => {
    setSelectedReq(req);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        setWorkflowsCache(Array.isArray(res.data?.items) ? res.data.items : []);
        await computeCandidateFromList(
          Array.isArray(res.data?.items) ? res.data.items : [],
        );
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
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/material-requisitions";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MATERIAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MATERIAL_REQUISITION",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    if (chosen) {
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
            : null,
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
          e?.response?.data?.message || "Failed to load workflow details",
        );
      } finally {
        setWfLoading(false);
      }
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/material-requisitions";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MATERIAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MATERIAL_REQUISITION",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
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
          : null,
      );
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (!selectedReq) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(
        `/inventory/material-requisitions/${selectedReq.id}/submit`,
        {
          amount: null,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        },
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setRequisitions((prev) =>
        prev.map((r) =>
          r.id === selectedReq.id ? { ...r, status: newStatus } : r,
        ),
      );
      setShowForwardModal(false);
      setSelectedReq(null);
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Material Requisitions
              </h1>
              <p className="text-sm mt-1">
                Request materials from warehouse inventory
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/material-requisitions/new"
                className="btn-success"
              >
                + New Requisition
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {loading ? <div className="text-sm mb-4">Loading...</div> : null}
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by requisition number or requested by..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Requisition No</th>
                  <th>Date</th>
                  <th>Requested By</th>
                  <th>Department</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequisitions.map((req) => (
                  <tr key={req.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {req.requisition_no}
                    </td>
                    <td>{req.requisition_date}</td>
                    <td>{req.requested_by || "-"}</td>
                    <td>{req.department_name || "-"}</td>
                    <td>{req.warehouse_name || "-"}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("inventory:material-requisitions", "view") && (
                        <Link
                          to={`/inventory/material-requisitions/${req.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:material-requisitions", "edit") && (
                        <Link
                          to={`/inventory/material-requisitions/${req.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                        >
                          Edit
                        </Link>
                      )}
                      {req.status === "APPROVED" ? (
                        <span className="ml-3 text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                          Approved
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openForwardModal(req)}
                          className="ml-3 text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors"
                          disabled={
                            submittingForward ||
                            req.status === "ISSUED" ||
                            req.status === "PENDING_APPROVAL" ||
                            hasInactiveWorkflow
                          }
                        >
                          Forward for Approval
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedReq(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Requisition:{" "}
                <span className="font-semibold">
                  {selectedReq?.requisition_no}
                </span>
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
                            e.target.value ? Number(e.target.value) : null,
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
                                    firstApprover.approvalLimit,
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
                  setSelectedReq(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={submittingForward}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
