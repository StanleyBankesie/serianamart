import React, { useState, useEffect, useCallback } from "react";
import { Factory } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, MiniBar, StatusBar, DataTable, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function ProductionAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/production"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const total = Number(s.total || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Production Analytics" description="Work orders, output volumes, and production status" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Work Orders" value={loading ? "..." : fmtNum(s.total)} icon={Factory} color="brand" />
        <KpiCard label="Completed" value={loading ? "..." : fmtNum(s.completed)} icon={Factory} color="success" />
        <KpiCard label="In Progress" value={loading ? "..." : fmtNum(s.inProgress)} icon={Factory} color="primary" />
        <KpiCard label="Total Units Produced" value={loading ? "..." : fmtNum(s.totalProduced)} sub="Completed orders" icon={Factory} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Monthly Output Trend">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.outputTrend || []} valueKey="produced" labelKey="month" color="#0E3646" height={110} />}
          </div>
        </SectionCard>

        <SectionCard title="Work Orders by Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : (data?.byStatus || []).map((s) => (
                <StatusBar key={s.status} label={s.status} value={s.count} total={total} color="#0E3646" />
              ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
