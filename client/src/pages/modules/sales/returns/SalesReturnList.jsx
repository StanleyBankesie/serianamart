import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { Search } from "lucide-react";

export default function SalesReturnList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/sales/returns")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load sales returns");
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
    return items.filter((r) => {
      const no = String(r.return_no || "").toLowerCase();
      const cust = String(r.customer_name || "").toLowerCase();
      const inv = String(r.invoice_id || "").toLowerCase();
      return no.includes(q) || cust.includes(q) || inv.includes(q);
    });
  }, [items, searchTerm]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter(
      (r) => r.status === "PENDING" || r.status === "PENDING_APPROVAL",
    ).length;
    const approved = items.filter(
      (r) => r.status === "APPROVED" || r.status === "POSTED",
    ).length;
    const draft = items.filter((r) => r.status === "DRAFT").length;
    return { total, pending, approved, draft };
  }, [items]);

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(list);
        await computeCandidateFromList(list);
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
    const route = "/inventory/sales-returns";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SALES_RETURN",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_RETURN",
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
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/sales-returns";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SALES_RETURN",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_RETURN",
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
    if (!selectedDoc) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(`/sales/returns/${selectedDoc.id}/submit`, {
        amount: Number(selectedDoc.total_amount || 0) || null,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING";
      setItems((prev) =>
        prev.map((r) =>
          r.id === selectedDoc.id ? { ...r, status: newStatus } : r,
        ),
      );
      setShowForwardModal(false);
      setSelectedDoc(null);
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
        <div className="card-header bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>↩️</span> Sales Returns
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Process customer returns and track status
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/inventory/sales-returns/new"
                className="btn btn-primary"
              >
                New Sales Return
              </Link>
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Total Returns</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Draft</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.draft}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="text-2xl font-bold text-emerald-600">
                {stats.approved}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Search by return no, customer, or invoice"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading sales returns...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              No sales returns found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Return No</th>
                    <th>Return Date</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.return_no}</td>
                      <td>
                        {r.return_date
                          ? new Date(r.return_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{r.customer_name || "-"}</td>
                      <td className="text-right">
                        {Number(r.total_amount || 0).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === "APPROVED" || r.status === "POSTED"
                              ? "badge-success"
                              : r.status === "PENDING" ||
                                  r.status === "PENDING_APPROVAL" ||
                                  r.status === "SUBMITTED"
                                ? "badge-warning"
                                : r.status === "CANCELLED"
                                  ? "badge-error"
                                  : "badge-info"
                          }`}
                        >
                          {r.status || "DRAFT"}
                        </span>
                      </td>
                      <td className="text-right">
                        {r.status === "APPROVED" || r.status === "POSTED" ? (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-green-500 text-white">
                            Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openForwardModal(r)}
                            className="text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700"
                            disabled={
                              submittingForward ||
                              r.status === "PENDING" ||
                              r.status === "PENDING_APPROVAL" ||
                              r.status === "SUBMITTED" ||
                              r.status === "CANCELLED" ||
                              hasInactiveWorkflow
                            }
                          >
                            {submittingForward
                              ? "Forwarding..."
                              : "Forward for Approval"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                  setSelectedDoc(null);
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
                Sales Return:{" "}
                <span className="font-semibold">
                  {selectedDoc?.return_no || `#${selectedDoc?.id}`}
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
                  setSelectedDoc(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
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
