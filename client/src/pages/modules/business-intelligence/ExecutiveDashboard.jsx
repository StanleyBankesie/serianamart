/**
 * @fileoverview Executive Dashboard for the BI module.
 * Cross-module KPIs and trend charts using app brand colors.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign, ShoppingCart, Package, Users, Truck, Wrench,
  CheckSquare, Zap, TrendingUp, TrendingDown, Target, RefreshCw, ArrowRight
} from "lucide-react";
import { api } from "../../../api/client.js";
import { PageHeader, MiniBar, SectionCard, fmtCurrency, fmtNum, ErrorAlert } from "./bi.shared.jsx";

function KpiTile({ label, value, sub, growth, icon: Icon, color = "brand" }) {
  const colors = {
    brand:   "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300",
    primary: "bg-primary-50 dark:bg-orange-900/20 text-primary dark:text-orange-400",
    success: "bg-secondary-50 dark:bg-green-900/20 text-secondary dark:text-green-400",
    danger:  "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    slate:   "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  };
  const isPositive = growth == null || Number(growth) >= 0;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-erp-sm hover:shadow-erp transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-2">{value}</p>
      <div className="flex items-center gap-2">
        {growth != null && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isPositive ? "text-secondary" : "text-red-500"}`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? "+" : ""}{Number(growth || 0).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function StatusPie({ data = [] }) {
  const total = data.reduce((s, d) => s + Number(d.count || 0), 0);
  const barColors = ["#0E3646", "#F57C00", "#2E8B1F", "#ef4444", "#3b86a8", "#5fa2c4"];
  return (
    <div className="space-y-3 mt-1">
      {data.map((d, i) => {
        const count = Number(d.count || 0);
        const w = total > 0 ? (count / total * 100).toFixed(0) : 0;
        return (
          <div key={d.status}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">{d.status}</span>
              <span className="text-slate-500">{fmtNum(count)} ({w}%)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: barColors[i % barColors.length] }} />
            </div>
          </div>
        );
      })}
      {!data.length && <div className="text-xs text-slate-400 text-center py-4">No data</div>}
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get("/bi/executive-dashboard");
      setData(res.data?.data || null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load dashboard data.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  const skeleton = (n = 1) => Array.from({ length: n }, (_, i) => (
    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 animate-pulse">
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded mb-4 w-2/3" />
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded mb-2 w-1/2" />
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
    </div>
  ));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="Cross-module KPI overview — Revenue, Inventory, Projects, Fleet, HR & POS"
        onRefresh={load}
        loading={loading}
      >
        {lastUpdated && (
          <span className="text-xs text-white/60 hidden md:block">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </PageHeader>

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading ? skeleton(10) : <>
          <KpiTile label="Revenue (This Month)" value={fmtCurrency(kpis.revenue?.thisMonth)} sub="vs last month" growth={kpis.revenue?.growth} icon={DollarSign} color="success" />
          <KpiTile label="Purchase Spend" value={fmtCurrency(kpis.expenses?.thisMonth)} sub="This month" icon={ShoppingCart} color="primary" />
          <KpiTile label="Gross Profit" value={fmtCurrency(kpis.grossProfit?.thisMonth)} sub="This month" icon={TrendingUp} color="brand" />
          <KpiTile label="Inventory Items" value={fmtNum(kpis.inventory?.itemCount)} sub={`${fmtNum(kpis.inventory?.belowReorder)} below reorder`} icon={Package} color="brand" />
          <KpiTile label="Active Projects" value={fmtNum(kpis.projects?.active)} sub={`${fmtNum(kpis.projects?.total)} total`} icon={CheckSquare} color="brand" />
          <KpiTile label="Active Employees" value={fmtNum(kpis.hr?.active)} sub={`${fmtNum(kpis.hr?.total)} headcount`} icon={Users} color="brand" />
          <KpiTile label="POS Sales Today" value={fmtCurrency(kpis.pos?.todaySales)} sub={`${fmtNum(kpis.pos?.todayTxns)} transactions`} icon={Zap} color="primary" />
          <KpiTile label="Fleet Available" value={`${fmtNum(kpis.fleet?.available)} / ${fmtNum(kpis.fleet?.total)}`} sub={`${fmtNum(kpis.fleet?.inUse)} in use`} icon={Truck} color="brand" />
          <KpiTile label="Open Maintenance" value={fmtNum(kpis.maintenance?.openJobs)} sub="Jobs pending" icon={Wrench} color="danger" />
          <KpiTile label="All-Time Revenue" value={fmtCurrency(kpis.revenue?.allTime)} sub="Cumulative" icon={Target} color="slate" />
        </>}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Revenue Trend (6 Months)">
          <div className="p-5">
            {loading
              ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={charts.revenueTrend || []} valueKey="revenue" labelKey="month" color="#0E3646" height={100} />}
            <div className="mt-3 flex justify-end">
              <Link to="/business-intelligence/financial" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                Financial Analytics <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Purchase Spend Trend (6 Months)">
          <div className="p-5">
            {loading
              ? <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              : <MiniBar data={charts.purchaseTrend || []} valueKey="spend" labelKey="month" color="#F57C00" height={100} />}
            <div className="mt-3 flex justify-end">
              <Link to="/business-intelligence/purchase" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                Purchase Analytics <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Project Status Distribution">
          <div className="p-5">
            {loading
              ? <div className="space-y-2">{Array.from({length:3}).map((_,i) => <div key={i} className="h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
              : <StatusPie data={charts.projectsByStatus || []} />}
            <div className="mt-3 flex justify-end">
              <Link to="/business-intelligence/projects" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                Project Analytics <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* POS Trend */}
      <SectionCard title="POS Daily Sales (Last 7 Days)">
        <div className="p-5">
          {loading
            ? <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            : <MiniBar data={charts.posDailyTrend || []} valueKey="sales" labelKey="day" color="#F57C00" height={80} />}
          <div className="mt-3 flex justify-end">
            <Link to="/business-intelligence/pos" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              POS Analytics <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
