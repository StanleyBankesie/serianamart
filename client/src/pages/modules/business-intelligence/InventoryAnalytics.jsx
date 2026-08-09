import React, { useState, useEffect, useCallback } from "react";
import { Package, AlertTriangle } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, SectionCard, DataTable, ErrorAlert, fmtNum } from "./bi.shared.jsx";

export default function InventoryAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api.get("/bi/inventory"); setData(res.data?.data || null); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Analytics" description="Stock by category, low-stock alerts, and top moving items" onRefresh={load} loading={loading} />
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Stock by Category">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.byCategory || []).map((c, i) => {
                  const max = Math.max(...(data?.byCategory || []).map((d) => Number(d.totalQty || 0)), 1);
                  const w = (Number(c.totalQty || 0) / max * 100).toFixed(0);
                  return (
                    <div key={i} className="px-5 py-3">
                      <div className="flex justify-between mb-1 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{c.category_name}</span>
                        <span className="text-slate-400">{fmtNum(c.totalQty)} units · {fmtNum(c.itemCount)} items</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!data?.byCategory?.length && <div className="p-8 text-center text-slate-400 text-sm">No category data.</div>}
              </div>}
        </SectionCard>

        <SectionCard title="Low Stock Alerts">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <AlertTriangle size={14} className="text-primary" />
            <span className="text-xs font-semibold text-slate-500">{loading ? "—" : (data?.lowStock?.length || 0)} items below reorder level</span>
          </div>
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {(data?.lowStock || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.item_name}</div>
                      <div className="text-[10px] text-slate-400">{item.item_code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-red-600">{fmtNum(item.qty)}</div>
                      <div className="text-[10px] text-slate-400">Min: {fmtNum(item.reorderLevel)}</div>
                    </div>
                  </div>
                ))}
                {!data?.lowStock?.length && <div className="p-6 text-center text-secondary text-xs font-semibold">✓ All items above reorder level</div>}
              </div>}
        </SectionCard>

        <SectionCard title="Top Moving Items (Last 30 Days)" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div>
            : <DataTable
                columns={[
                  { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
                  { key: "item_name", label: "Item", className: "font-semibold text-slate-800 dark:text-slate-200" },
                  { key: "item_code", label: "Code", className: "text-slate-400 font-mono text-[10px]" },
                  { key: "moved", label: "Units Moved", className: "text-brand-600 dark:text-brand-400 font-bold", render: v => fmtNum(v) },
                ]}
                rows={(data?.topMovingItems || []).map((r, i) => ({ ...r, idx: i + 1 }))}
                emptyMessage="No movement data found."
              />}
        </SectionCard>
      </div>
    </div>
  );
}
