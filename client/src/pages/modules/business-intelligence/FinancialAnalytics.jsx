import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, KpiCard, SectionCard, MiniBar, DataTable, ErrorAlert, fmtCurrency, fmtNum } from "./bi.shared.jsx";

export default function FinancialAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(6);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/bi/financial?months=${months}`);
      setData(res.data?.data || null);
    } catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, [months]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Analytics" description="Revenue trends, purchase spend, top customers & suppliers" onRefresh={load} loading={loading}>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
          className="text-xs px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none">
          <option value={3}>3 Months</option><option value={6}>6 Months</option><option value={12}>12 Months</option>
        </select>
      </PageHeader>
      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Revenue Trend">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.revenueTrend || []} valueKey="revenue" labelKey="month" color="#2E8B1F" height={110} />}
          </div>
        </SectionCard>
        <SectionCard title="Purchase Spend Trend">
          <div className="p-5">
            {loading ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={data?.purchaseTrend || []} valueKey="spend" labelKey="month" color="#F57C00" height={110} />}
          </div>
        </SectionCard>

        <SectionCard title="Top Customers by Revenue">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div> :
          <DataTable
            columns={[
              { key: "idx", label: "#", className: "text-slate-400 font-bold w-8", render: (_, __, i) => i + 1 },
              { key: "customer_name", label: "Customer", className: "font-semibold text-slate-800 dark:text-slate-200" },
              { key: "revenue", label: "Revenue", className: "text-secondary font-bold", render: v => fmtCurrency(v) },
              { key: "invoices", label: "Invoices", className: "text-slate-500", render: v => fmtNum(v) },
            ]}
            rows={(data?.topCustomers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
            emptyMessage="No customer data found."
          />}
        </SectionCard>

        <SectionCard title="Top Suppliers by Spend">
          {loading ? <div className="p-5 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>)}</div> :
          <DataTable
            columns={[
              { key: "idx", label: "#", className: "text-slate-400 font-bold w-8" },
              { key: "supplier_name", label: "Supplier", className: "font-semibold text-slate-800 dark:text-slate-200" },
              { key: "spend", label: "Spend", className: "text-primary font-bold", render: v => fmtCurrency(v) },
              { key: "orders", label: "Orders", className: "text-slate-500", render: v => fmtNum(v) },
            ]}
            rows={(data?.topSuppliers || []).map((r, i) => ({ ...r, idx: i + 1 }))}
            emptyMessage="No supplier data found."
          />}
        </SectionCard>
      </div>
    </div>
  );
}
