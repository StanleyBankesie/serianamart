import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import client from "../../api/client";

export default function HomePage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [pendingItems, setPendingItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [overview, setOverview] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [modalInstanceId, setModalInstanceId] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalComment, setModalComment] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProcessing, setModalProcessing] = useState(false);
  const [modalNextUser, setModalNextUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    client
      .get("/workflows/approvals/pending")
      .then((res) => {
        if (cancelled) return;
        setPendingItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingItems([]);
      });

    client
      .get("/workflows/notifications")
      .then((res) => {
        if (cancelled) return;
        setNotifications(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setNotifications([]);
      });

    client
      .get("/pos/analytics/overview")
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const normalizeType = (s) =>
    String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  const displayType = (s) => {
    const t = normalizeType(s);
    if (t === "MATERIAL_REQUISITION") return "Material Requisition";
    if (t === "RETURN_TO_STORES") return "Return to Stores";
    if (t.startsWith("PURCHASE_ORDER:")) {
      const sub = t.split(":")[1];
      if (sub === "LOCAL") return "Purchase Order - Local";
      if (sub === "IMPORT") return "Purchase Order - Import";
      return "Purchase Order";
    }
    if (t === "GOODS_RECEIPT") return "GRN";
    if (t === "GRN") return "GRN";
    if (t === "GOODS_RECEIPT_NOTE") return "GRN";
    if (
      t === "GOODS_RECEIPT:LOCAL" ||
      t === "GRN:LOCAL" ||
      t === "GOODS_RECEIPT_NOTE:LOCAL"
    )
      return "GRN Local";
    if (
      t === "GOODS_RECEIPT:IMPORT" ||
      t === "GRN:IMPORT" ||
      t === "GOODS_RECEIPT_NOTE:IMPORT"
    )
      return "GRN Import";
    return String(s || "Document");
  };
  const typeKey = (it) => {
    const base = normalizeType(it.document_type);
    if (base === "PURCHASE_ORDER") {
      const sub = normalizeType(it.po_type);
      return sub ? `${base}:${sub}` : base;
    }
    if (
      base === "GOODS_RECEIPT" ||
      base === "GRN" ||
      base === "GOODS_RECEIPT_NOTE"
    ) {
      const ref = String(it.doc_ref || "");
      const sub = ref.startsWith("GL-")
        ? "LOCAL"
        : ref.startsWith("GI-")
          ? "IMPORT"
          : "";
      return sub ? `${base}:${sub}` : base;
    }
    return base;
  };
  const uniquePending = useMemo(() => {
    const m = new Map();
    for (const it of pendingItems) {
      const key = String(
        it.workflow_instance_id ||
          `${normalizeType(it.document_type)}-${it.document_id}`,
      );
      if (!m.has(key)) m.set(key, it);
    }
    return Array.from(m.values());
  }, [pendingItems]);
  const groupedPending = useMemo(() => {
    const out = {};
    for (const it of uniquePending) {
      const k = typeKey(it);
      if (!out[k]) out[k] = [];
      out[k].push(it);
    }
    return out;
  }, [uniquePending]);
  const orderedGroups = useMemo(() => {
    const keys = Object.keys(groupedPending);
    const order = [
      "MATERIAL_REQUISITION",
      "RETURN_TO_STORES",
      "STOCK_ADJUSTMENT",
    ];
    const head = order.filter((k) => keys.includes(k));
    const tail = keys.filter((k) => !order.includes(k)).sort();
    return [...head, ...tail];
  }, [groupedPending]);
  const docLabel = (it) => {
    const t = displayType(typeKey(it));
    const ref = it.doc_ref ? String(it.doc_ref) : `#${it.document_id}`;
    return `${t} ${ref}`;
  };

  const openApprovalModal = async (id) => {
    setShowApprovalModal(true);
    setModalInstanceId(id);
    setModalLoading(true);
    setModalData(null);
    setModalComment("");
    try {
      const res = await client.get(`/workflows/approvals/instance/${id}`);
      const item = res.data?.item || null;
      setModalData(item);
      if (
        item &&
        !item.is_last_step &&
        Array.isArray(item.next_step_approvers)
      ) {
        const first = item.next_step_approvers[0];
        setModalNextUser(first ? first.id : null);
      } else {
        setModalNextUser(null);
      }
    } catch (e) {
      setModalData(null);
    } finally {
      setModalLoading(false);
    }
  };

  const extractInstanceIdFromLink = (link) => {
    const s = String(link || "");
    const m = s.match(/approvals\/(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const markNotificationRead = async (id) => {
    try {
      await client.put(`/workflows/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
    } catch {
      // ignore
    }
  };

  const closeApprovalModal = () => {
    setShowApprovalModal(false);
    setModalInstanceId(null);
    setModalData(null);
    setModalComment("");
    setModalLoading(false);
    setModalProcessing(false);
    setModalNextUser(null);
  };

  const handleModalAction = async (action) => {
    if (!modalInstanceId) return;
    if (!modalComment && (action === "REJECT" || action === "RETURN")) {
      alert("Please provide a comment for rejection/return");
      return;
    }
    if (action === "APPROVE" && modalData && !modalData.is_last_step) {
      if (!modalNextUser) {
        alert("Please select the next approver");
        return;
      }
    }
    setModalProcessing(true);
    try {
      await client.post(`/workflows/${modalInstanceId}/action`, {
        action,
        comments: modalComment,
        target_user_id:
          modalData && !modalData.is_last_step ? modalNextUser : null,
      });
      setPendingItems((items) =>
        items.filter((i) => i.workflow_instance_id !== modalInstanceId),
      );
      closeApprovalModal();
    } catch (e) {
      alert(e?.response?.data?.message || "Action failed");
    } finally {
      setModalProcessing(false);
    }
  };

  function fmtCurrency(n) {
    const num = Number(n || 0);
    return `₵${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const metrics = [
    {
      label: "Today Sales",
      value: fmtCurrency(overview?.todaySales || 0),
      // icon: "💵",
      path: "/sales",
      color: "from-ticker-green to-ticker-green",
    },
    {
      label: "Total Customers",
      value: String(overview?.totalCustomers ?? 0),
      // icon: "👥",
      path: "/sales/customers",
      color: "from-ticker-blue to-ticker-blue",
    },
    {
      label: "Average Order",
      value: fmtCurrency(overview?.averageOrder || 0),
      // icon: "🧾",
      path: "/sales/reports",
      color: "from-ticker-purple to-ticker-purple",
    },
    {
      label: "Monthly Revenue",
      value: fmtCurrency(overview?.monthlyRevenue || 0),
      // icon: "📊",
      path: "/finance/reports",
      color: "from-ticker-orange to-ticker-orange",
    },
  ];

  const quickActions = [
    {
      label: "New Sale",
      icon: "➕",
      path: "/pos/sales/new",
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Inventory",
      icon: "📦",
      path: "/inventory",
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Customers",
      icon: "👥",
      path: "/sales/customers",
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Reports",
      icon: "📊",
      path: "/reports",
      color: "text-orange-600 bg-orange-50",
    },
    {
      label: "Settings",
      icon: "⚙",
      path: "/administration/settings",
      color: "text-slate-600 bg-slate-50",
    },
    {
      label: "Help",
      icon: "❓",
      path: "/help",
      color: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 fullbleed-sm">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 to-brand-800 p-8 shadow-erp text-white">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.name || user?.username || "User"}! 👋
            </h1>
            <p className="mt-2 text-brand-100 text-lg max-w-2xl">
              Here's an overview of your business performance and pending tasks
              today.
            </p>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-20" />
        </div>

        {/* Tickers / Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <div
              key={index}
              onClick={() => navigate(metric.path)}
              className={`relative overflow-hidden rounded-xl p-6 shadow-erp-sm hover:shadow-erp-md transition-all duration-200 cursor-pointer group bg-gradient-to-r ${metric.color} text-white`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-wider">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {metric.value}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white/20 text-white">
                  <span className="text-2xl">{metric.icon}</span>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
                <span className="text-6xl text-white/20">{metric.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-erp p-6 border border-slate-100 h-full">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-amber-500">⚡</span> Quick Actions
              </h2>
              <div className="space-y-3">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigate(action.path)}
                    className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 text-left group"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${action.color}`}
                    >
                      {action.icon}
                    </div>
                    <span className="font-medium text-slate-700 group-hover:text-brand-700">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow & Notifications Section (Replaces Modules) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workflow / Pending Approvals */}
            <div className="bg-white rounded-xl shadow-erp p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-blue-500">✅</span> Pending Approvals
                </h2>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                  {uniquePending.length} Pending
                </span>
              </div>

              {uniquePending.length > 0 ? (
                <div className="space-y-4">
                  {orderedGroups.map((key) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-slate-700">
                          {displayType(key)}
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                          {groupedPending[key].length}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {groupedPending[key].map((item) => (
                          <div
                            key={item.workflow_instance_id}
                            className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-lg px-2 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                                {item.initiator
                                  ? item.initiator.charAt(0)
                                  : "U"}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {docLabel(item)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.submitted_at
                                    ? new Date(
                                        item.submitted_at,
                                      ).toLocaleString()
                                    : "Just now"}{" "}
                                  • {item.workflow_name || "Approval Required"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  openApprovalModal(item.workflow_instance_id)
                                }
                                className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/administration/workflows/approvals/${item.workflow_instance_id}`,
                                  )
                                }
                                className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  No pending approvals found. You're all caught up! 🎉
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notifications Card */}
              <div className="bg-white rounded-xl shadow-erp p-6 border border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="text-brand-500">🔔</span> Notifications
                </h2>
                {notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((note, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-start p-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <div className="mt-1 w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-800 leading-snug">
                            {note.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {note.date || "Just now"}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {extractInstanceIdFromLink(note.link) ? (
                            <button
                              onClick={() =>
                                openApprovalModal(
                                  extractInstanceIdFromLink(note.link),
                                )
                              }
                              className="px-3 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md transition-colors"
                            >
                              Pending Approval
                            </button>
                          ) : null}
                          <button
                            onClick={() => markNotificationRead(note.id)}
                            className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            Mark Read
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No new notifications.
                  </div>
                )}
              </div>

              {/* Recent Activity / System Status (Industry Standard Filler) */}
              <div className="bg-white rounded-xl shadow-erp p-6 border border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="text-purple-500">📊</span> System Status
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Server Uptime</span>
                      <span className="text-green-600 font-medium">99.9%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: "99.9%" }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Database Load</span>
                      <span className="text-brand-600 font-medium">34%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full"
                        style={{ width: "34%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
                      Recent Login
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span>🖥️</span>
                      <span>Windows PC • Chrome</span>
                      <span className="text-slate-400 ml-auto">10:42 AM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-lg overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Approval</h2>
              <button
                onClick={closeApprovalModal}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              {modalLoading ? (
                <div className="text-sm">Loading...</div>
              ) : modalData ? (
                <>
                  <div className="text-sm text-slate-700">
                    Document:{" "}
                    <span className="font-semibold">
                      {modalData.document_type} #{modalData.document_id}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">
                    Current Step:{" "}
                    <span className="font-semibold">{modalData.step_name}</span>
                  </div>
                  <div className="text-sm text-slate-700">
                    Amount:{" "}
                    <span className="font-semibold">
                      {modalData.amount != null
                        ? Number(modalData.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Comments
                    </label>
                    <textarea
                      className="input w-full h-24"
                      placeholder="Enter comments..."
                      value={modalComment}
                      onChange={(e) => setModalComment(e.target.value)}
                    />
                  </div>
                  {!modalData.is_last_step &&
                    Array.isArray(modalData.next_step_approvers) && (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Forward To
                        </label>
                        <select
                          className="input w-full"
                          value={modalNextUser || ""}
                          onChange={(e) =>
                            setModalNextUser(Number(e.target.value))
                          }
                        >
                          <option value="">Select user</option>
                          {modalData.next_step_approvers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </>
              ) : (
                <div className="text-sm text-red-600">
                  Failed to load approval
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={closeApprovalModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700 disabled:opacity-50"
                onClick={() => handleModalAction("APPROVE")}
                disabled={modalProcessing}
              >
                {modalData && modalData.is_last_step
                  ? "Final Approve"
                  : "Forward"}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                onClick={() => handleModalAction("RETURN")}
                disabled={modalProcessing}
              >
                Return
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => handleModalAction("REJECT")}
                disabled={modalProcessing}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
