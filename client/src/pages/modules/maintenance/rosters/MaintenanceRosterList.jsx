/**
 * @fileoverview MaintenanceRosterList — Standard ERP list using app CSS classes.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye, Clock, RefreshCw } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { Guard } from "../../../../hooks/usePermissions";

const STATUS_CONFIG = {
  ACTIVE : { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  DRAFT  : { cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  CLOSED : { cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" },
};

export default function MaintenanceRosterList() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("ALL");
  const [showAttach,  setShowAttach]  = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  function loadData() {
    setLoading(true);
    api.get("/maintenance/rosters")
      .then(r => setItems(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }
  useEffect(loadData, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(r => {
      const matchSearch = !q ||
        String(r.roster_name    || "").toLowerCase().includes(q) ||
        String(r.employee_name  || "").toLowerCase().includes(q) ||
        String(r.shift          || "").toLowerCase().includes(q) ||
        String(r.assigned_area  || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  // Summary KPIs
  const totalHours = items.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0).toFixed(1);

  return (
    <Guard moduleKey="maintenance">
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Maintenance Roster</h1>
            <p className="text-sm text-slate-500">Track and manage technician schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="btn-secondary p-2"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/rosters/new" className="btn-primary">+ New Roster</Link>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total",  value: items.length,                                   cls: "bg-slate-600"   },
            { label: "Active", value: items.filter(r => r.status === "ACTIVE").length, cls: "bg-emerald-600" },
            { label: "Draft",  value: items.filter(r => r.status === "DRAFT").length,  cls: "bg-amber-500"   },
            { label: "Scheduled Hours", value: `${totalHours}h`,                       cls: "bg-brand"       },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <span className={`w-2 h-8 rounded-full ${cls} flex-shrink-0`} />
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + filter bar ── */}
        <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search name, employee, shift, area…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5 text-sm flex-wrap">
            <span className="text-slate-500 font-medium">Status:</span>
            {["ALL", "ACTIVE", "DRAFT", "CLOSED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-brand text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Table ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {["Roster Name","Employee","Date","Shift","Start","End","Hours","Location / Area","Linked Schedule","Status","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && (
                  <tr><td colSpan="11" className="px-4 py-10 text-center text-slate-400 text-sm">
                    <RefreshCw size={16} className="inline animate-spin mr-2" />Loading…
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan="11" className="px-4 py-10 text-center text-slate-400 text-sm">No rosters found</td></tr>
                )}
                {!loading && filtered.map(r => {
                  const sConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 max-w-[180px]">
                        <span className="block truncate" title={r.roster_name}>{r.roster_name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {r.employee_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand/10 text-brand-700 dark:text-brand-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {r.employee_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[110px]" title={r.employee_name}>{r.employee_name}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.roster_date ? new Date(r.roster_date).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.shift
                          ? <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md font-medium">{r.shift}</span>
                          : <span className="text-slate-400 text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">{r.start_time || "—"}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">{r.end_time   || "—"}</td>
                      <td className="px-4 py-3">
                        {r.total_hours
                          ? <span className="flex items-center gap-1 text-brand-700 dark:text-brand-300 font-semibold text-sm"><Clock size={12}/>{parseFloat(r.total_hours).toFixed(1)}h</span>
                          : <span className="text-slate-400 text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[120px]">
                        <span className="truncate block" title={r.assigned_area}>{r.assigned_area || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {r.schedule_id
                          ? <Link to={`/maintenance/schedules/${r.schedule_id}`} className="text-brand-600 hover:underline text-xs font-medium">Schedule #{r.schedule_id}</Link>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full font-semibold ${sConfig.cls}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors"
                            title="View"
                            onClick={() => navigate(`/maintenance/rosters/${r.id}?mode=view`)}
                          >
                            <Eye size={14} />
                          </button>
                          <ListPrintIconButton onClick={() => toast.info("Print coming soon")} />
                          <ListPdfIconButton   onClick={() => toast.info("PDF coming soon")} />
                          <ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} />
                          <Link to={`/maintenance/rosters/${r.id}`} className="text-brand hover:underline font-medium text-sm px-1">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          module="maintenance"
        />
      )}
    </Guard>
  );
}
