import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Search, ChevronRight, Paperclip } from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

export default function PMMaterialRequisitionList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/projects/material-requisitions")
      .then(res => { if (mounted) setItems(Array.isArray(res.data?.items) ? res.data.items : []); })
      .catch(e => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const getStatusBadge = (status) => {
    const b = { DRAFT: "badge-info", PENDING_APPROVAL: "badge-warning", APPROVED: "badge-success", REJECTED: "badge-error", CANCELLED: "badge-error" };
    return b[status] || "badge-info";
  };

  const handleSubmit = async (id) => {
    setForwarding(true);
    try {
      await api.post(`/projects/material-requisitions/${id}/submit`);
      toast.success("Submitted for approval");
      const res = await api.get("/projects/material-requisitions");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Submit failed");
    } finally { setForwarding(false); }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, { query: searchTerm, getKeys: (r) => [r.requisition_no, r.project_name, r.requested_by] });
  }, [items, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Material Requisitions</h1>
            <p className="text-slate-500 text-sm">Project material requests with approval workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/project-management/material-requisitions/new" className="btn-success flex items-center gap-2">
            <Plus size={20} /> + New Requisition
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search requisitions..." className="input pl-10 pr-4 py-2 w-full"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                <SortableHeader label="Requisition No" sortKey="requisition_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <SortableHeader label="Date" sortKey="requisition_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Warehouse</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priority</th>
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" />
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 dark:text-slate-500 font-semibold">Loading...</td></tr>
              ) : sorted.length > 0 ? sorted.map(r => (
                <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <td className="px-6 py-4 font-medium text-sm text-slate-900 dark:text-white">{r.requisition_no}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.requisition_date ? new Date(r.requisition_date).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.project_name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.warehouse_name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{r.department_name || "—"}</td>
                  <td className="px-6 py-4"><span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">{r.priority}</span></td>
                  <td className="px-6 py-4"><span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => { setActiveDocId(r.id); setShowAttach(true); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors" title="Attachments">
                        <Paperclip size={15} />
                      </button>
                      {r.status === "DRAFT" && (
                        <button type="button" onClick={() => handleSubmit(r.id)} disabled={forwarding}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">Submit</button>
                      )}
                      {r.status === "DRAFT" && (
                        <Link to={`/project-management/material-requisitions/${r.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors">
                          <ChevronRight size={18} />
                        </Link>
                      )}
                      {(r.status === "PENDING_APPROVAL" || r.status === "APPROVED") && (
                        <Link to={`/project-management/material-requisitions/${r.id}?view=1`}
                          className="text-xs font-semibold text-brand hover:text-brand-600 dark:text-brand-400">View</Link>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">No requisitions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DocumentAttachmentsModal open={showAttach} onClose={() => { setShowAttach(false); setActiveDocId(null); }}
        docType="pm-material-requisition" docId={activeDocId} />
    </div>
  );
}
