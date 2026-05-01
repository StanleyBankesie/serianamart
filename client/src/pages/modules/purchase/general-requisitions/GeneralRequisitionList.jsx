import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

export default function GeneralRequisitionList() {
  const navigate = useNavigate();
  const { hasExceptional } = usePermission();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  const [exCancelAllowed, setExCancelAllowed] = useState(false);
  const [exReverseAllowed, setExReverseAllowed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  function normalizeStatus(s) {
    return String(s || "DRAFT").toUpperCase();
  }
  function statusLabel(s) {
    const k = normalizeStatus(s);
    if (k === "PENDING_APPROVAL") return "Pending Approval";
    return k;
  }
  function getStatusBadge(s) {
    const k = normalizeStatus(s);
    const map = {
      DRAFT: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-info",
      REJECTED: "badge-error",
      CANCELLED: "badge-error",
      FULFILLED: "badge-success",
    };
    return map[k] || "badge-info";
  }

  useEffect(() => {
    let cancelled = false;
    async function loadExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        setCurrentUserId(uid || null);
        if (!uid || cancelled) return;
        const resp = await api.get(`/admin/users/${uid}/exceptional-permissions`);
        const arr = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
          ? resp.data.items
          : [];
        const allowedCancel = arr.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(p.permission_code || p.permissionCode || "").toUpperCase();
          return effect === "ALLOW" && active && code === "PURCHASE.GENERAL_REQUISITION.CANCEL";
        });
        const allowedReverse = arr.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(p.permission_code || p.permissionCode || "").toUpperCase();
          return effect === "ALLOW" && active && code === "WORKFLOW.APPROVAL.REVERSE";
        });
        if (!cancelled) {
          setExCancelAllowed(allowedCancel);
          setExReverseAllowed(allowedReverse);
        }
      } catch {
        if (!cancelled) {
          setExCancelAllowed(false);
          setExReverseAllowed(false);
        }
      }
    }
    loadExceptional();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        const normalized = status === "RETURNED" ? "DRAFT" : status;
        setItems((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status: normalized,
                  ...(normalized === "DRAFT" ? { forwarded_to_username: null } : {}),
                }
              : x,
          ),
        );
        if (normalized === "APPROVED") {
          (async () => {
            try {
              await api.put(`/purchase/general-requisitions/${id}/status`, {
                status: "APPROVED",
              });
            } catch {}
          })();
        }
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () => window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/purchase/general-requisitions")
      .then((res) => {
        if (!mounted) return;
        const all = Array.isArray(res.data?.items) ? res.data.items : [];
        setItems(all);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load general requisitions");
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
    const base = statusFilter === "ALL" ? items.slice() : items.filter((r) => normalizeStatus(r.status) === statusFilter);
    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (r) =>
        String(r.requisition_no || "").toLowerCase().includes(q) ||
        String(r.department || "").toLowerCase().includes(q) ||
        String(r.requested_by || "").toLowerCase().includes(q),
    );
  }, [items, statusFilter, searchTerm]);

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(arr);
        await computeCandidateFromList(arr);
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
    const route = "/purchase/general-requisitions";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) => String(w.document_route) === route || normalize(w.document_type) === "GENERAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      workflowsCache.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "GENERAL_REQUISITION") ||
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
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (arr) => {
    if (!arr || !arr.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/purchase/general-requisitions";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = arr.filter(
      (w) => String(w.document_route) === route || normalize(w.document_type) === "GENERAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      arr.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      arr.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "GENERAL_REQUISITION") ||
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
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (!selectedDoc) return;
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
    let optimisticApprover = null;
    try {
      const options = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
          : first.approver_user_id
          ? [
              {
                id: first.approver_user_id,
                name: first.approver_name || String(first.approver_user_id),
              },
            ]
          : []
        : [];
      if (targetApproverId && options.length) {
        const hit = options.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setItems((prev) =>
      prev.map((r) =>
        r.id === selectedDoc.id
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username: optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    setShowForwardModal(false);
    try {
      await api.put(`/purchase/general-requisitions/${selectedDoc.id}/status`, {
        status: "PENDING_APPROVAL",
      });
    } catch {}
    const amount =
      selectedDoc.total_estimated_cost == null ? null : Number(selectedDoc.total_estimated_cost || 0);
    try {
      const res = await api.post(`/purchase/general-requisitions/${selectedDoc.id}/submit`, {
        amount,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setItems((prev) =>
        prev.map((x) => (x.id === selectedDoc.id ? { ...x, status: newStatus } : x)),
      );
      toast.success("General requisition forwarded for approval");
      const instanceId = res?.data?.instanceId;
      if (instanceId && targetApproverId && currentUserId && Number(targetApproverId) === Number(currentUserId)) {
        navigate(`/administration/workflows/approvals/${instanceId}`);
      }
    } catch (e1) {
      try {
        const wfRes = await api.post("/workflows/forward-by-document", {
          document_type: "GENERAL_REQUISITION",
          document_id: selectedDoc.id,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
          amount,
        });
        const newStatus = wfRes?.data?.status || "PENDING_APPROVAL";
        setItems((prev) =>
          prev.map((x) => (x.id === selectedDoc.id ? { ...x, status: newStatus } : x)),
        );
        toast.success("General requisition forwarded for approval");
        const instanceId = wfRes?.data?.instanceId;
        if (instanceId && targetApproverId && currentUserId && Number(targetApproverId) === Number(currentUserId)) {
          navigate(`/administration/workflows/approvals/${instanceId}`);
        }
      } catch (e2) {
        await api.put(`/purchase/general-requisitions/${selectedDoc.id}/status`, {
          status: "PENDING_APPROVAL",
        });
        toast.success("General requisition forwarded for approval");
      }
    } finally {
      setSubmittingForward(false);
    }
  };

  const reverseApproval = async (id) => {
    try {
      await api.post("/workflows/reverse-by-document", {
        document_type: "GENERAL_REQUISITION",
        document_id: id,
        desired_status: "DRAFT",
      });
    } catch (e1) {
      try {
        await api.put(`/purchase/general-requisitions/${id}/status`, { status: "DRAFT" });
      } catch {}
    }
    toast.success("Approval reversed");
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "DRAFT", forwarded_to_username: null } : x)),
    );
  };

  const cancelDoc = async (id) => {
    if (!window.confirm("Cancel this requisition?")) return;
    try {
      await api.put(`/purchase/general-requisitions/${id}/status`, { status: "CANCELLED" });
      toast.success("Requisition cancelled");
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Unable to cancel requisition");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/purchase" className="text-sm text-brand hover:text-brand-600">
            ← Back to Purchase
          </Link>
          <h1 className="text-2xl font-bold mt-2">General Requisitions</h1>
          <p className="text-sm text-slate-600">Request items for purchase or services to be rendered</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/purchase/general-requisitions/new")}>
          + New Requisition
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status</label>
              <select className="input h-9 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="FULFILLED">Fulfilled</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Search</label>
              <input
                className="input h-9 text-sm w-full"
                placeholder="Search by requisition no, department, requested by"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Req. No</th>
                <th>Date</th>
                <th>Type</th>
                <th>Department</th>
                <th>Requested By</th>
                <th>Priority</th>
                <th className="text-center">Items</th>
                <th className="text-right">Est. Cost</th>
                <th>Status</th>
                <th>Actions</th>
                            <th>Created By</th>
              <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500">
                    No requisitions found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm text-brand">{r.requisition_no}</td>
                    <td className="text-sm">{String(r.requisition_date || "").slice(0, 10)}</td>
                    <td className="text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.requisition_type === "SERVICE"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {r.requisition_type}
                      </span>
                    </td>
                    <td className="text-sm">{r.department || "-"}</td>
                    <td className="text-sm">{r.requested_by || "-"}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase">
                        {r.priority || "-"}
                      </span>
                    </td>
                    <td className="text-center text-sm font-mono">{r.item_count || 0}</td>
                    <td className="text-right font-mono text-sm">
                      {Number(r.total_estimated_cost || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>{statusLabel(r.status)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-brand hover:text-brand-600 text-sm font-medium"
                          onClick={() => navigate(`/purchase/general-requisitions/${r.id}`)}
                        >
                          View
                        </button>
                        {["DRAFT", "REJECTED"].includes(normalizeStatus(r.status)) ? (
                          <Link
                            to={`/purchase/general-requisitions/${r.id}/edit`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Edit
                          </Link>
                        ) : null}
                        {normalizeStatus(r.status) === "APPROVED" ? (
                          <>
                            <span className="text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                              Approved
                            </span>
                            {(hasExceptional("WORKFLOW.APPROVAL.REVERSE") || exReverseAllowed) && (
                              <button
                                type="button"
                                className="ml-2 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
                                onClick={() => reverseApproval(r.id)}
                              >
                                Reverse Approval
                              </button>
                            )}
                          </>
                        ) : r.forwarded_to_username || normalizeStatus(r.status) === "PENDING_APPROVAL" ? (
                          <button
                            type="button"
                            disabled
                            title="Assigned approver"
                            className="ml-3 inline-flex items-center px-3 py-1.5 rounded bg-amber-500 text-white text-xs font-semibold cursor-default select-none whitespace-nowrap"
                          >
                            Forwarded to: {r.forwarded_to_username || "Approver"}
                          </button>
                        ) : ["DRAFT", "REJECTED"].includes(normalizeStatus(r.status)) ? (
                          <button
                            type="button"
                            className="text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors whitespace-nowrap inline-flex items-center"
                            onClick={() => openForwardModal(r)}
                            disabled={hasInactiveWorkflow}
                          >
                            Forward for Approval
                          </button>
                        ) : null}
                        {(hasExceptional("PURCHASE.GENERAL_REQUISITION.CANCEL") || exCancelAllowed) &&
                        !["CANCELLED", "FULFILLED"].includes(normalizeStatus(r.status)) ? (
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-1.5 rounded bg-[#A30000] hover:bg-[#7B0000] text-white text-xs font-semibold"
                            onClick={() => cancelDoc(r.id)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedDoc(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No: <span className="font-semibold">{selectedDoc?.requisition_no || "-"}</span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>{wfLoading ? <div className="text-sm">Loading workflow...</div> : null}</div>
              <div>{wfError ? <div className="text-sm text-red-600">{wfError}</div> : null}</div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
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
                            name: first.approver_name || String(first.approver_user_id),
                          },
                        ]
                      : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
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
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
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
                  setSelectedDoc(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={
                  submittingForward ||
                  !selectedDoc ||
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
