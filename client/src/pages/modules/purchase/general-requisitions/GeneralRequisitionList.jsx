import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const STATUS_COLORS = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  FULFILLED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

const PRIORITY_COLORS = {
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
  MEDIUM: "bg-blue-50 text-blue-600 border-blue-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  URGENT: "bg-red-50 text-red-700 border-red-200",
};

export default function GeneralRequisitionList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [departments, setDepartments] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDept) params.department = filterDept;
      const res = await api.get("/purchase/general-requisitions", { params });
      setItems(res?.data?.items || []);
    } catch (e) {
      toast.error("Failed to load requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/admin/departments").then((r) => {
      setDepartments(r?.data?.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [filterStatus, filterDept]);

  const updateStatus = async (id, status) => {
    if (!window.confirm(`Change status to ${status}?`)) return;
    try {
      await api.put(`/purchase/general-requisitions/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/purchase"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Purchase
          </Link>
          <h1 className="text-2xl font-bold mt-2">General Requisitions</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Request items for purchase or services to be rendered
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/purchase/general-requisitions/new")}
        >
          + New Requisition
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Status
              </label>
              <select
                className="input h-9 text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="FULFILLED">Fulfilled</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Department
              </label>
              <select
                className="input h-9 text-sm"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.dept_name}>
                    {d.dept_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadData}
                className="btn btn-secondary h-9 w-full"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
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
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="font-mono text-sm font-medium text-brand">
                        {r.requisition_no}
                      </td>
                      <td className="text-sm">
                        {String(r.requisition_date || "").slice(0, 10)}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.requisition_type === "SERVICE"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                        }`}>
                          {r.requisition_type}
                        </span>
                      </td>
                      <td className="text-sm">{r.department || "-"}</td>
                      <td className="text-sm">{r.requested_by || "-"}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.MEDIUM
                        }`}>
                          {r.priority}
                        </span>
                      </td>
                      <td className="text-center text-sm font-mono">
                        {r.item_count || 0}
                      </td>
                      <td className="text-right font-mono text-sm">
                        {fmt(r.total_estimated_cost)}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          STATUS_COLORS[r.status] || STATUS_COLORS.DRAFT
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-center gap-1 flex-wrap">
                          <button
                            className="btn-outline text-xs px-2 py-1"
                            onClick={() =>
                              navigate(`/purchase/general-requisitions/${r.id}`)
                            }
                          >
                            View
                          </button>
                          {["DRAFT", "REJECTED"].includes(r.status) && (
                            <button
                              className="btn-outline text-xs px-2 py-1"
                              onClick={() =>
                                navigate(
                                  `/purchase/general-requisitions/${r.id}/edit`,
                                )
                              }
                            >
                              Edit
                            </button>
                          )}
                          {r.status === "DRAFT" && (
                            <button
                              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                              onClick={() => updateStatus(r.id, "SUBMITTED")}
                            >
                              Submit
                            </button>
                          )}
                          {r.status === "SUBMITTED" && (
                            <>
                              <button
                                className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                onClick={() => updateStatus(r.id, "APPROVED")}
                              >
                                Approve
                              </button>
                              <button
                                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                                onClick={() => updateStatus(r.id, "REJECTED")}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {!["CANCELLED", "FULFILLED"].includes(r.status) && (
                            <button
                              className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold dark:bg-slate-600 dark:text-slate-200"
                              onClick={() => updateStatus(r.id, "CANCELLED")}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-12 text-slate-500 italic"
                      >
                        No requisitions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
