import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MODULE_CARDS = [
  { key: "finance", label: "Finance", icon: "💳", path: "/finance/dashboard", color: "from-blue-600 to-blue-700", desc: "Accounting & Reporting" },
  { key: "sales", label: "Sales", icon: "🧾", path: "/sales/dashboard", color: "from-emerald-600 to-emerald-700", desc: "Revenue & Customers" },
  { key: "inventory", label: "Inventory", icon: "📦", path: "/inventory/dashboard", color: "from-amber-500 to-amber-600", desc: "Stock & Movements" },
  { key: "purchase", label: "Purchase", icon: "🛒", path: "/purchase/dashboard", color: "from-indigo-600 to-indigo-700", desc: "Procurement & Vendors" },
  { key: "human-resources", label: "Human Resources", icon: "👥", path: "/human-resources/dashboard", color: "from-purple-600 to-purple-700", desc: "People & Payroll" },
  { key: "maintenance", label: "Maintenance", icon: "🛠", path: "/maintenance/dashboard", color: "from-orange-600 to-orange-700", desc: "Assets & Upkeep" },
  { key: "production", label: "Production", icon: "🏭", path: "/production/dashboard", color: "from-teal-600 to-teal-700", desc: "Manufacturing" },
  { key: "pos", label: "POS", icon: "🧮", path: "/pos/dashboard", color: "from-pink-600 to-pink-700", desc: "Point of Sale" },
  { key: "project-management", label: "Projects", icon: "📋", path: "/project-management/dashboard", color: "from-cyan-600 to-cyan-700", desc: "Project Tracking" },
  { key: "service-management", label: "Service Mgmt", icon: "🛎️", path: "/service-management/dashboard", color: "from-rose-600 to-rose-700", desc: "Service & Support" },
  { key: "business-intelligence", label: "Business Intelligence", icon: "📈", path: "/business-intelligence", color: "from-violet-600 to-violet-700", desc: "Analytics & Insights" },
  { key: "administration", label: "Administration", icon: "⚙", path: "/administration", color: "from-slate-600 to-slate-700", desc: "System Settings" },
];

export default function ExecutiveOverviewHome() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState({
    outstandingReceivables: null,
    outstandingPayables: null,
    fastMovingCount: null,
    slowMovingCount: null,
    todaySales: null,
    weekSales: null,
    monthSales: null,
    supplierOutstanding: null,
  });

  useEffect(() => {
    let mounted = true;
    async function loadKpis() {
      try {
        // Outstanding Receivables
        const [recRes, payRes, salesRes, suppRes] = await Promise.allSettled([
          api.get("/finance/reports/outstanding-receivable", { params: { from: null, to: null } }),
          api.get("/finance/reports/payment-due", { params: { from: null, to: null } }),
          api.get("/sales/dashboard/metrics", { params: { topProducts: 1, topCustomers: 1 } }),
          api.get("/finance/reports/supplier-outstanding"),
        ]);

        if (!mounted) return;

        const rec = recRes.status === "fulfilled" ? (recRes.value.data?.items || []) : [];
        const pay = payRes.status === "fulfilled" ? (payRes.value.data?.items || []) : [];
        const salesCards = salesRes.status === "fulfilled" ? (salesRes.value.data?.cards || {}) : {};
        const suppTotals = suppRes.status === "fulfilled" ? (suppRes.value.data?.totals || {}) : {};

        const totalRec = rec.reduce((s, r) => s + Number(r.outstanding || 0), 0);
        const totalPay = pay.reduce((s, r) => s + Number(r.outstanding || 0), 0);

        setKpis({
          outstandingReceivables: totalRec,
          outstandingPayables: totalPay,
          todaySales: Number(salesCards.today_sales || 0),
          weekSales: Number(salesCards.wtd_sales || 0),
          monthSales: Number(salesCards.mtd_sales || 0),
          supplierOutstanding: Number(suppTotals.total || 0),
          fastMovingCount: null,
          slowMovingCount: null,
        });
      } catch {}
    }
    loadKpis();
    return () => { mounted = false; };
  }, []);

  const KPI_CARDS = [
    {
      label: "Outstanding Receivables",
      kpiKey: "outstandingReceivables",
      icon: "📥",
      color: "from-emerald-500 to-emerald-600",
      path: "/executive-overview/outstanding-receivables",
      desc: "Customer payments due",
    },
    {
      label: "Outstanding Payables",
      kpiKey: "outstandingPayables",
      icon: "📤",
      color: "from-orange-500 to-orange-600",
      path: "/executive-overview/outstanding-payables",
      desc: "Supplier payments owed",
    },
    {
      label: "Today's Sales",
      kpiKey: "todaySales",
      icon: "📅",
      color: "from-blue-500 to-blue-600",
      path: "/executive-overview/sales-today",
      desc: "Revenue generated today",
    },
    {
      label: "Current Month Revenue",
      kpiKey: "monthSales",
      icon: "📊",
      color: "from-violet-500 to-violet-600",
      path: "/executive-overview/sales-this-month",
      desc: "Month-to-date revenue",
    },
    {
      label: "Current Week Revenue",
      kpiKey: "weekSales",
      icon: "📈",
      color: "from-indigo-500 to-indigo-600",
      path: "/executive-overview/sales-this-week", // Note: The route might not exist, but we define the path to keep it consistent
      desc: "Week-to-date revenue",
    },
    {
      label: "Supplier Outstanding",
      kpiKey: "supplierOutstanding",
      icon: "🏭",
      color: "from-rose-500 to-rose-600",
      path: "/executive-overview/supplier-outstanding",
      desc: "Total owed to suppliers",
    },
    {
      label: "Fast Moving Items",
      kpiKey: null,
      icon: "🚀",
      color: "from-cyan-500 to-cyan-600",
      path: "/executive-overview/fast-moving-items",
      desc: "High turnover stock",
    },
    {
      label: "Slow Moving Items",
      kpiKey: null,
      icon: "🐢",
      color: "from-amber-500 to-amber-600",
      path: "/executive-overview/slow-moving-items",
      desc: "Low turnover stock",
    },
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-10 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-4xl">🎯</span>
            <div>
              <h1 className="text-4xl font-black tracking-tight">Executive Overview</h1>
              <p className="text-slate-400 mt-1 text-sm font-medium">Command center for all modules and key performance indicators</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-3">{new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-12 space-y-12">

        {/* KPI Report Cards */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-violet-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Key Performance Indicators</h2>
            <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full font-medium">Click to view reports</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {KPI_CARDS.map((card, i) => {
              const val = card.kpiKey ? kpis[card.kpiKey] : null;
              const hasValue = val !== null && val !== undefined;
              return (
                <button
                  key={i}
                  onClick={() => navigate(card.path)}
                  className={`group relative overflow-hidden bg-gradient-to-br ${card.color} text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-left w-full`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500"></div>
                  <div className="relative">
                    <div className="text-3xl mb-3">{card.icon}</div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">{card.desc}</div>
                    <div className="text-lg font-black truncate">{card.label}</div>
                    {hasValue ? (
                      <div className="text-2xl font-black mt-2 tabular-nums">₵{fmt(val)}</div>
                    ) : (
                      <div className="text-sm mt-2 opacity-70 font-medium">View Report →</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

        </section>

        {/* Module Dashboard Grid */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Module Dashboards</h2>
            <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full font-medium">Click to open module</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {MODULE_CARDS.map((mod) => (
              <Link
                key={mod.key}
                to={mod.path}
                className={`group bg-gradient-to-br ${mod.color} text-white p-5 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center gap-2`}
              >
                <div className="text-4xl group-hover:scale-110 transition-transform duration-300">{mod.icon}</div>
                <div className="font-black text-sm leading-tight">{mod.label}</div>
                <div className="text-[10px] opacity-75 font-medium">{mod.desc}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
