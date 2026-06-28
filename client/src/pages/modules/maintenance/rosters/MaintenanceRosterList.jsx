/**
 * @fileoverview MaintenanceRosterList component.
 * Provides functionality for MaintenanceRosterList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { Guard } from "../../../../hooks/usePermissions";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceRosterList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/rosters").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); if (!q) return items; return items.filter(r => String(r.roster_name || "").toLowerCase().includes(q)); }, [items, search]);

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Maintenance Roster</h1>
            <p className="text-sm text-slate-500">Track and manage maintenance team rosters</p>
          </div>
          <div className="flex gap-2">
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/rosters/new" className="btn-primary">+ New Roster</Link>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <input className="input max-w-md" placeholder="Search roster..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Roster Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Period Start</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Period End</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Team Members</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No rosters found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{r.roster_name}</td>
                    <td className="px-4 py-3 text-sm">{r.period_start}</td>
                    <td className="px-4 py-3 text-sm">{r.period_end}</td>
                    <td className="px-4 py-3 text-sm max-w-xs">{r.team_members}</td>
                    <td className="px-4 py-3 text-sm"><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-sm">{r.created_by_name || "-"}</td>
                    <td className="px-4 py-3 text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap"><div className="flex items-center gap-1"><button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/rosters/${r.id}?mode=view`)}><Eye size={15} /></button><ListPrintIconButton onClick={() => toast.info("Print coming soon")} /><ListPdfIconButton onClick={() => toast.info("PDF coming soon")} /><ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} /><Link to={`/maintenance/rosters/${r.id}`} className="text-brand hover:underline font-medium text-sm">Edit</Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => { setShowAttach(false); setActiveDocId(null); }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
    </Guard>
  );
}
