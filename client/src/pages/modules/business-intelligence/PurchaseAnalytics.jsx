import React, { useState, useEffect, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, MiniBar, DataTable, StatusBar, ErrorAlert, fmtCurrency, fmtNum } from "./bi.shared.jsx";

export default function PurchaseAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(6);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/bi/purchase?months=${months}`);
      setData(res.data?.data || null);
    } catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, [months]);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const total = Number(s.total || 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Analytics" description="Supplier spend, order status, and procurement trends" onRefresh={load} loading={loading}>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
          className="text-xs px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none">
          <option value={3}>3 Months</option><option value={6}>6 Months</option><option value={12}>12 Months</option>
        </select>
      </PageHeader>
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Orders" value={loading ? "..." : fmtNum(s.total)} icon={ShoppingCart} color="brand" />
        <KpiCard label="Approved / Received" value={loading ? "..." : fmtNum(s.approved)} sub="Fulfilled" icon={ShoppingCart} color="success" />
        <KpiCard label="Pending Approval" value={loading ? "..." : fmtNum(s.pending)} icon={ShoppingCart} color="primary" />
        <KpiCard label="Total Spend" value={loading ? "..." : fmtCurrency(s.totalSpend)} sub="All time" icon={ShoppingCart} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Spend Trend">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.spendTrend || []} valueKey="spend" labelKey="month" color="#F57C00" height={110} />}
          </div>
        </SectionCard>

        <SectionCard title="Orders by Status">
          <div className="p-5 space-y-3">
            {loading ? Array.from({length:4}).map((_,i)=><div key={i} className="h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)
              : (data?.byStatus || []).map((s) => (
                <StatusBar key={s.status} label={s.status} value={s.count} total={total} color="#0E3646" />
              ))}
          </div>
        </SectionCard>

        <SectionCard title="Top Suppliers by Spend" className="lg:col-span-2">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div> :
          <DataTable
            columns={[
              { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
              { key: "supplier_name", label: "Supplier", className: "font-semibold text-slate-800 dark:text-slate-200" },
              { key: "orders", label: "Orders", className: "text-slate-600 dark:text-slate-300", render: v => fmtNum(v) },
              { key: "spend", label: "Total Spend", className: "text-primary font-bold", render: v => fmtCurrency(v) },
            ]}
            rows={(data?.topSuppliers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
            emptyMessage="No supplier data found."
          />}
        </SectionCard>
      </div>
    </div>
  );
}
