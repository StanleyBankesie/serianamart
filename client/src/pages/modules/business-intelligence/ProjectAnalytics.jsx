import React, { useState, useEffect, useCallback } from "react";
import { FolderKanban } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, DataTable, StatusBar, ErrorAlert, fmtCurrency, fmtNum } from "./bi.shared.jsx";

const STAT_COLORS = { COMPLETED:"#2E8B1F", IN_PROGRESS:"#0E3646", active:"#0E3646", PENDING:"#F57C00", CANCELLED:"#ef4444", ON_HOLD:"#94a3b8" };

function StatusBadge({ status }) {
  const color = STAT_COLORS[status] || "#94a3b8";
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: color + "20", color }}>{status}</span>;
}

export default function ProjectAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/projects"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const total = Number(s.total || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Project Analytics" description="Budget utilization, project status, and active project overview" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Projects" value={loading ? "..." : fmtNum(s.total)} icon={FolderKanban} color="brand" />
        <KpiCard label="Active" value={loading ? "..." : fmtNum(s.active)} icon={FolderKanban} color="brand" />
        <KpiCard label="Completed" value={loading ? "..." : fmtNum(s.completed)} icon={FolderKanban} color="success" />
        <KpiCard label="Total Budget" value={loading ? "..." : fmtCurrency(s.totalBudget)} icon={FolderKanban} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Projects by Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:4}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : (data?.byStatus || []).map((s) => (
                  <StatusBar key={s.status} label={s.status} value={s.count} total={total} color={STAT_COLORS[s.status] || "#94a3b8"} />
                ))}
          </div>
        </SectionCard>

        <SectionCard title="Budget Utilization (Active Projects)">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.budgetAnalysis || []).map((p, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[60%]">{p.project_name}</span>
                      <span className={`text-xs font-bold ${Number(p.budgetUsedPct)>90?"text-red-600":Number(p.budgetUsedPct)>70?"text-primary":"text-secondary"}`}>{p.budgetUsedPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100,p.budgetUsedPct)}%`, backgroundColor: Number(p.budgetUsedPct)>90?"#ef4444":Number(p.budgetUsedPct)>70?"#F57C00":"#2E8B1F" }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                      <span>Spent: {fmtCurrency(p.spent)}</span><span>Budget: {fmtCurrency(p.budget)}</span>
                    </div>
                  </div>
                ))}
                {!data?.budgetAnalysis?.length && <div className="p-6 text-center text-slate-400 text-sm">No active projects with budget data.</div>}
              </div>}
        </SectionCard>

        <SectionCard title="Recent Projects" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "project_name", label: "Project", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "status", label: "Status", render: v => <StatusBadge status={v} /> },
                  { key: "budget", label: "Budget", render: v => fmtCurrency(v) },
                  { key: "spent", label: "Spent", render: v => fmtCurrency(v) },
                  { key: "start_date", label: "Start", render: v => String(v||"").split("T")[0] || "—" },
                  { key: "end_date", label: "End", render: v => String(v||"").split("T")[0] || "—" },
                ]}
                rows={data?.recentProjects || []}
                emptyMessage="No projects found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
