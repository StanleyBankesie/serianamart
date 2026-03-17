import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "api/client";
import { toast } from "react-toastify";
// Use direct reverse flow (like vouchers) for POs
import { filterAndSort } from "@/utils/searchUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import addNotification from "react-push-notification";

export default function PurchaseOrdersImportList() {
  const location = useLocation();
  const [exceptionalAllowed, setExceptionalAllowed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [cancelDenied, setCancelDenied] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const { canPerformAction, hasExceptional } = usePermission();

  async function reversePo(id) {
    try {
      await api.post(`/purchase/orders/import/${id}/reverse`, {
        desired_status: "DRAFT",
      });
      toast.success("Purchase order reversed successfully");
      setPurchaseOrders((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, status: "DRAFT", forwarded_to_username: null }
            : x,
        ),
      );
      try {
        const po = purchaseOrders.find((p) => Number(p.id) === Number(id));
        const icon = "/OMNISUITE_ICON_CLEAR.png";
        const link = `/purchase/purchase-orders-import/${id}`;
        addNotification({
          title: "Purchase Order reversed",
          message: `PO ${po?.po_no || id} is now ready to forward for approval`,
          native:
            typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification?.permission === "granted",
          icon,
          onClick: () => {
            window.location.assign(link);
          },
        });
      } catch {}
    } catch (e) {
      // Try generic endpoint as fallback
      try {
        await api.post(`/purchase/orders/${id}/reverse`, {
          desired_status: "DRAFT",
        });
        toast.success("Purchase order reversed successfully");
        setPurchaseOrders((prev) =>
          prev.map((x) =>
            x.id === id
              ? { ...x, status: "DRAFT", forwarded_to_username: null }
              : x,
          ),
        );
        try {
          const po = purchaseOrders.find((p) => Number(p.id) === Number(id));
          const icon = "/OMNISUITE_ICON_CLEAR.png";
          const link = `/purchase/purchase-orders-import/${id}`;
          addNotification({
            title: "Purchase Order reversed",
            message: `PO ${po?.po_no || id} is now ready to forward for approval`,
            native:
              typeof window !== "undefined" &&
              "Notification" in window &&
              window.Notification?.permission === "granted",
            icon,
            onClick: () => {
              window.location.assign(link);
            },
          });
        } catch {}
      } catch (e2) {
        // Fallback to workflows handler with synonyms
        try {
          const tryWorkflow = async (t) =>
            api.post("/workflows/reverse-by-document", {
              document_type: t,
              document_id: id,
              desired_status: "DRAFT",
            });
          const types = ["PURCHASE_ORDER", "PO", "PURCHASE ORDER"];
          for (const t of types) {
            try {
              await tryWorkflow(t);
              toast.success("Purchase order reversed successfully");
              setPurchaseOrders((prev) =>
                prev.map((x) =>
                  x.id === id
                    ? { ...x, status: "DRAFT", forwarded_to_username: null }
                    : x,
                ),
              );
              try {
                const po = purchaseOrders.find(
                  (p) => Number(p.id) === Number(id),
                );
                const icon = "/OMNISUITE_ICON_CLEAR.png";
                const link = `/purchase/purchase-orders-import/${id}`;
                addNotification({
                  title: "Purchase Order reversed",
                  message: `PO ${po?.po_no || id} is now ready to forward for approval`,
                  native:
                    typeof window !== "undefined" &&
                    "Notification" in window &&
                    window.Notification?.permission === "granted",
                  icon,
                  onClick: () => {
                    window.location.assign(link);
                  },
                });
              } catch {}
              return;
            } catch (_) {}
          }
          // Final fallback: status endpoint
          try {
            await api.put(`/purchase/orders/${id}/status`, {
              status: "DRAFT",
            });
            toast.success("Purchase order reversed successfully");
            setPurchaseOrders((prev) =>
              prev.map((x) =>
                x.id === id
                  ? { ...x, status: "DRAFT", forwarded_to_username: null }
                  : x,
              ),
            );
            try {
              const po = purchaseOrders.find(
                (p) => Number(p.id) === Number(id),
              );
              const icon = "/OMNISUITE_ICON_CLEAR.png";
              const link = `/purchase/purchase-orders-import/${id}`;
              addNotification({
                title: "Purchase Order reversed",
                message: `PO ${po?.po_no || id} is now ready to forward for approval`,
                native:
                  typeof window !== "undefined" &&
                  "Notification" in window &&
                  window.Notification?.permission === "granted",
                icon,
                onClick: () => {
                  window.location.assign(link);
                },
              });
            } catch {}
          } catch (ePut1) {
            toast.error(
              ePut1?.response?.data?.message ||
                e2?.response?.data?.message ||
                e?.response?.data?.message ||
                "Failed to reverse purchase order",
            );
          }
        } catch (eFinal) {
          toast.error(
            eFinal?.response?.data?.message ||
              e2?.response?.data?.message ||
              e?.response?.data?.message ||
              "Failed to reverse purchase order",
          );
        }
      }
    }
  }
  useEffect(() => {
    let cancelled = false;
    async function checkExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        if (!uid || cancelled) return;
        const resp = await api.get(
          `/admin/users/${uid}/exceptional-permissions`,
        );
        const items = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
            ? resp.data.items
            : [];
        let allowed = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          const codeOk = code === "PURCHASE.ORDER.CANCEL";
          return effect === "ALLOW" && active && codeOk;
        });
        const denied = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          return (
            effect === "DENY" && active && code === "PURCHASE.ORDER.CANCEL"
          );
        });
        if (!cancelled) setExceptionalAllowed(allowed);
        if (!cancelled) setCancelDenied(denied);
      } catch {
        if (!cancelled) setExceptionalAllowed(false);
        if (!cancelled) setCancelDenied(false);
      }
    }
    checkExceptional();
    return () => {
      cancelled = true;
    };
  }, []);
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
          all.filter(
            (po) => String(po.po_type || "").toUpperCase() === "IMPORT",
          ),
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load purchase orders",
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
          const res = await api.get("/purchase/orders");
          const all = Array.isArray(res.data?.items) ? res.data.items : [];
          const imports = all.filter(
            (po) => String(po.po_type || "").toUpperCase() === "IMPORT",
          );
          setPurchaseOrders(imports);
          let hit = false;
          if (ref) {
            hit = imports.some(
              (po) =>
                String(po.po_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = imports.some((po) => Number(po.id) === Number(hid));
          } else {
            hit = imports.length > 0;
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
        setPurchaseOrders((prev) =>
          prev.map((po) =>
            Number(po.id) === id
              ? {
                  ...po,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : po,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
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
    const base =
      statusFilter === "ALL"
        ? purchaseOrders.slice()
        : purchaseOrders.filter((po) => po.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (po) => [po.po_no, po.supplier_name],
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
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
    const route = "/purchase/purchase-orders-import";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
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
      return;
    }
    const route = "/purchase/purchase-orders-import";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
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
    // Optimistic UI update before API
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
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
        const hit = options.find(
          (u) => Number(u.id) === Number(targetApproverId),
        );
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setPurchaseOrders((prev) =>
      prev.map((r) =>
        r.id === selectedDoc.id
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    setShowForwardModal(false);
    setSelectedDoc(null);
    try {
      const res = await api.post(`/purchase/orders/${selectedDoc.id}/submit`, {
        amount: selectedDoc?.total_amount ?? null,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
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
        if (targetApproverId && opts.length) {
          const hit = opts.find(
            (u) => Number(u.id) === Number(targetApproverId),
          );
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setPurchaseOrders((prev) =>
        prev.map((r) =>
          r.id === selectedDoc.id
            ? {
                ...r,
                status: newStatus,
                forwarded_to_username:
                  approverName || r.forwarded_to_username || "Approver",
              }
            : r,
        ),
      );
      try {
        toast.success("Purchase order forwarded for approval");
      } catch {}
    } catch (e) {
      try {
        const amount =
          selectedDoc?.total_amount === undefined ||
          selectedDoc?.total_amount === null
            ? null
            : Number(selectedDoc?.total_amount || 0);
        const wfRes = await api.post("/workflows/forward-by-document", {
          document_type: "PURCHASE_ORDER",
          document_id: selectedDoc.id,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
          amount,
        });
        const newStatus = wfRes?.data?.status || "PENDING_APPROVAL";
        setPurchaseOrders((prev) =>
          prev.map((r) =>
            r.id === selectedDoc.id ? { ...r, status: newStatus } : r,
          ),
        );
        try {
          toast.success("Purchase order forwarded for approval");
        } catch {}
      } catch (e2) {
        try {
          await api.put(`/purchase/orders/${selectedDoc.id}/status`, {
            status: "PENDING_APPROVAL",
          });
          toast.success("Purchase order forwarded for approval");
        } catch (e3) {
          setWfError(
            e?.response?.data?.message ||
              e2?.response?.data?.message ||
              e3?.response?.data?.message ||
              "Failed to forward for approval",
          );
        }
      }
    } finally {
      setSubmittingForward(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Orders - Import
          </h1>
          <p className="text-sm mt-1">Manage import purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link
            to="/purchase/purchase-orders-import/new"
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
                        {canPerformAction(
                          "purchase:purchase-orders-import",
                          "view",
                        ) && (
                          <Link
                            to={`/purchase/purchase-orders-import/${po.id}`}
                            className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                          >
                            View
                          </Link>
                        )}
                        <Link
                          to={`/purchase/purchase-orders-import/${po.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Edit
                        </Link>
                        {hasExceptional("PURCHASE.ORDER.CANCEL") &&
                        !po.has_shipping_advice ? (
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-1.5 rounded bg-[#A30000] hover:bg-[#7B0000] text-white text-xs font-semibold"
                            onClick={async () => {
                              if (
                                !window.confirm(`Cancel this PO (${po.po_no})?`)
                              )
                                return;
                              try {
                                await api.delete(`/purchase/orders/${po.id}`);
                                toast.success("Purchase order cancelled");
                                setPurchaseOrders((prev) =>
                                  prev.filter((x) => x.id !== po.id),
                                );
                              } catch (e) {
                                toast.error(
                                  e?.response?.data?.message ||
                                    "Unable to cancel purchase order",
                                );
                              }
                            }}
                          >
                            Cancel
                          </button>
                        ) : null}
                        {po.status === "APPROVED" ? (
                          <>
                            <span className="text-sm font-medium px-2 py-1 rounded bg-green-500 text-white">
                              Approved
                            </span>
                            <button
                              type="button"
                              onClick={() => reversePo(po.id)}
                              className="ml-2 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
                            >
                              Reverse Approval
                            </button>
                          </>
                        ) : po.forwarded_to_username ? (
                          <button
                            type="button"
                            disabled
                            title="Assigned approver"
                            className="ml-3 inline-flex items-center px-3 py-1.5 rounded bg-amber-500 text-white text-xs font-semibold cursor-default select-none"
                          >
                            Forwarded to: {po.forwarded_to_username}
                          </button>
                        ) : po.status === "DRAFT" ||
                          po.status === "REJECTED" ? (
                          <button
                            type="button"
                            onClick={() => openForwardModal(po)}
                            className="text-sm font-medium px-2 py-1 rounded bg-brand text-white hover:bg-brand-700 transition-colors"
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
      {showForwardModal && (
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
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{selectedDoc?.po_no}</span>
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
