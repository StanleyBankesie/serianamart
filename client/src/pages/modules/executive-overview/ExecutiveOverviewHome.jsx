/**
 * @fileoverview ExecutiveOverviewHome component.
 * Provides functionality for ExecutiveOverviewHome.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";
import { usePermission } from "../../../auth/PermissionContext.jsx";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toDateStr = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const sumOutstanding = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, row) => sum + Number(row?.outstanding || 0),
    0,
  );

const countOverdue = (items) =>
  (Array.isArray(items) ? items : []).filter(
    (row) => String(row?.status || "").toUpperCase() === "OVERDUE",
  ).length;

const buildDeltaBadge = (current, previous, suffix) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return "";
  if (prev === 0) {
    return cur > 0 ? `↑ NEW ${suffix}` : `— ${suffix}`;
  }
  const delta = ((cur - prev) * 100) / prev;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  if (rounded === 0) return `— ${suffix}`;
  return `${delta > 0 ? "↑" : "↓"} ${rounded}% ${suffix}`;
};

// ERP Standard Module Icons (using Lucide-style SVG icons)
const ModuleIcon = ({ name, className = "w-6 h-6" }) => {
  const icons = {
    finance: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M7 15h.01" />
        <path d="M12 15h.01" />
        <path d="M17 15h.01" />
      </svg>
    ),
    sales: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
      </svg>
    ),
    inventory: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
    purchase: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    "human-resources": (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    maintenance: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    production: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 22h20" />
        <path d="M3 22v-9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9" />
        <path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
        <path d="M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
      </svg>
    ),
    pos: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <path d="M7 8h.01" />
        <path d="M12 8h.01" />
        <path d="M17 8h.01" />
      </svg>
    ),
    "project-management": (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    "service-management": (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        <path d="M2 8c0-2.2.7-4.3 2-6" />
        <path d="M22 8a10 10 0 0 0-2-6" />
      </svg>
    ),
    "business-intelligence": (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        <circle cx="18" cy="6" r="3" />
      </svg>
    ),
    administration: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  };
  return icons[name] || null;
};

// KPI Icons
const KpiIcon = ({ name, className = "w-5 h-5" }) => {
  const icons = {
    receivables: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    payables: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        <path d="M6 12h12" />
      </svg>
    ),
    sales: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
      </svg>
    ),
    revenue: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    week: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    supplier: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    fast: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    slow: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  };
  return icons[name] || null;
};

const ALL_MODULE_DASHBOARDS = [
  { key: "finance", label: "Finance", path: "/finance/dashboard", color: "bg-slate-700 hover:bg-slate-600", borderColor: "border-slate-500", desc: "Accounting & Reporting" },
  { key: "sales", label: "Sales", path: "/sales/dashboard", color: "bg-blue-700 hover:bg-blue-600", borderColor: "border-blue-500", desc: "Revenue & Customers" },
  { key: "inventory", label: "Inventory", path: "/inventory/dashboard", color: "bg-emerald-700 hover:bg-emerald-600", borderColor: "border-emerald-500", desc: "Stock & Movements" },
  { key: "purchase", label: "Purchase", path: "/purchase/dashboard", color: "bg-indigo-700 hover:bg-indigo-600", borderColor: "border-indigo-500", desc: "Procurement & Vendors" },
  { key: "human-resources", label: "Human Resources", path: "/human-resources/dashboard", color: "bg-violet-700 hover:bg-violet-600", borderColor: "border-violet-500", desc: "People & Payroll" },
  { key: "maintenance", label: "Maintenance", path: "/maintenance/dashboard", color: "bg-amber-700 hover:bg-amber-600", borderColor: "border-amber-500", desc: "Assets & Upkeep" },
  { key: "production", label: "Production", path: "/production/dashboard", color: "bg-teal-700 hover:bg-teal-600", borderColor: "border-teal-500", desc: "Manufacturing" },
  { key: "pos", label: "POS", path: "/pos/dashboard", color: "bg-cyan-700 hover:bg-cyan-600", borderColor: "border-cyan-500", desc: "Point of Sale" },
  { key: "project-management", label: "Projects", path: "/project-management/dashboard", color: "bg-rose-700 hover:bg-rose-600", borderColor: "border-rose-500", desc: "Project Tracking" },
  { key: "service-management", label: "Service Management", path: "/service-management/dashboard", color: "bg-orange-700 hover:bg-orange-600", borderColor: "border-orange-500", desc: "Service & Support" },
  { key: "business-intelligence", label: "Business Intelligence", path: "/business-intelligence", color: "bg-fuchsia-700 hover:bg-fuchsia-600", borderColor: "border-fuchsia-500", desc: "Analytics & Insights" },
  { key: "administration", label: "Administration", path: "/administration", color: "bg-gray-700 hover:bg-gray-600", borderColor: "border-gray-500", desc: "System Settings" },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExecutiveOverviewHome() {
  const navigate = useNavigate();
  const { isModuleEnabled } = usePermission();
  const moduleCards = useMemo(
    () => ALL_MODULE_DASHBOARDS.filter((m) => isModuleEnabled(m.key)),
    [isModuleEnabled],
  );
  const [kpis, setKpis] = useState({
    outstandingReceivables: null,
    outstandingPayables: null,
    fastMovingCount: null,
    slowMovingCount: null,
    todaySales: null,
    weekSales: null,
    monthSales: null,
    supplierOutstanding: null,
    badges: {},
  });

  useEffect(() => {
    let mounted = true;
    async function loadKpis() {
      try {
        const today = new Date();
        const currentMonthStart = startOfMonth(today);
        const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const previousMonthStart = startOfMonth(previousMonthDate);
        const previousMonthEnd = endOfMonth(previousMonthDate);
        const currentWeekStart = startOfWeek(today);
        const previousWeekEnd = new Date(currentWeekStart);
        previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

        const [homeRes, weekRes, prevWeekRes, recRes, payRes, suppRes, fastRes, prevFastRes, slowRes, prevSlowRes] =
          await Promise.allSettled([
            api.get("/bi/home-overview"),
            api.get("/sales/dashboard/metrics", {
              params: { topProducts: 1, topCustomers: 1, from: toDateStr(currentWeekStart), to: toDateStr(today) },
            }),
            api.get("/sales/dashboard/metrics", {
              params: { topProducts: 1, topCustomers: 1, from: toDateStr(startOfWeek(previousWeekEnd)), to: toDateStr(previousWeekEnd) },
            }),
            api.get("/finance/reports/outstanding-receivable", {
              params: { from: null, to: null },
            }),
            api.get("/finance/reports/payment-due", {
              params: { from: null, to: null },
            }),
            api.get("/finance/reports/supplier-outstanding"),
            api.get("/inventory/reports/fast-moving", {
              params: {
                from: toDateStr(currentMonthStart),
                to: toDateStr(today),
              },
            }),
            api.get("/inventory/reports/fast-moving", {
              params: {
                from: toDateStr(previousMonthStart),
                to: toDateStr(previousMonthEnd),
              },
            }),
            api.get("/inventory/reports/slow-moving", {
              params: {
                from: toDateStr(currentMonthStart),
                to: toDateStr(today),
              },
            }),
            api.get("/inventory/reports/slow-moving", {
              params: {
                from: toDateStr(previousMonthStart),
                to: toDateStr(previousMonthEnd),
              },
            }),
        ]);

        if (!mounted) return;

        const home = homeRes.status === "fulfilled" ? (homeRes.value.data || {}) : {};
        const weekCards = weekRes.status === "fulfilled" ? (weekRes.value.data?.cards || {}) : {};
        const prevWeekCards =
          prevWeekRes.status === "fulfilled"
            ? (prevWeekRes.value.data?.cards || {})
            : {};
        const rec = recRes.status === "fulfilled" ? (recRes.value.data?.items || []) : [];
        const pay = payRes.status === "fulfilled" ? (payRes.value.data?.items || []) : [];
        const suppTotals =
          suppRes.status === "fulfilled" ? (suppRes.value.data?.totals || {}) : {};
        const suppItems =
          suppRes.status === "fulfilled" ? (suppRes.value.data?.items || []) : [];
        const fastItems =
          fastRes.status === "fulfilled" ? (fastRes.value.data?.items || []) : [];
        const prevFastItems =
          prevFastRes.status === "fulfilled"
            ? (prevFastRes.value.data?.items || [])
            : [];
        const slowItems =
          slowRes.status === "fulfilled" ? (slowRes.value.data?.items || []) : [];
        const prevSlowItems =
          prevSlowRes.status === "fulfilled"
            ? (prevSlowRes.value.data?.items || [])
            : [];

        const totalRec = sumOutstanding(rec);
        const totalPay = sumOutstanding(pay);
        const overdueReceivables = countOverdue(rec);
        const overduePayables = countOverdue(pay);
        const currentWeekSales = Number(weekCards.wtd_sales || 0);
        const previousWeekSales = Number(prevWeekCards.wtd_sales || 0);

        setKpis({
          outstandingReceivables: totalRec,
          outstandingPayables: totalPay,
          todaySales: Number(home.todaySales || 0),
          weekSales: currentWeekSales,
          monthSales: Number(home.monthlyRevenue || 0),
          supplierOutstanding: Number(suppTotals.total || 0),
          fastMovingCount: fastItems.length,
          slowMovingCount: slowItems.length,
          badges: {
            outstandingReceivables:
              overdueReceivables > 0
                ? `${overdueReceivables} OVERDUE`
                : "— CURRENT",
            outstandingPayables:
              overduePayables > 0 ? `${overduePayables} OVERDUE` : "— CURRENT",
            todaySales: home?.badges?.["today-sales"]?.text || "",
            weekSales: buildDeltaBadge(
              currentWeekSales,
              previousWeekSales,
              "VS LAST WEEK",
            ),
            monthSales: home?.badges?.["monthly-revenue"]?.text || "",
            supplierOutstanding:
              suppItems.length > 0
                ? `${suppItems.length} SUPPLIERS`
                : "— NO SUPPLIERS",
            fastMovingCount: buildDeltaBadge(
              fastItems.length,
              prevFastItems.length,
              "VS LAST MONTH",
            ),
            slowMovingCount: buildDeltaBadge(
              slowItems.length,
              prevSlowItems.length,
              "VS LAST MONTH",
            ),
          },
        });
      } catch {}
    }
    loadKpis();
    return () => { mounted = false; };
  }, []);

  // ERP Professional KPI Card Design
  const KPI_CARDS = [
    {
      label: "Outstanding Receivables",
      kpiKey: "outstandingReceivables",
      badgeKey: "outstandingReceivables",
      format: "currency",
      iconName: "receivables",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/executive-overview/outstanding-receivables",
      desc: "Customer payments due",
    },
    {
      label: "Outstanding Payables",
      kpiKey: "outstandingPayables",
      badgeKey: "outstandingPayables",
      format: "currency",
      iconName: "payables",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/executive-overview/outstanding-payables",
      desc: "Supplier payments owed",
    },
    {
      label: "Today's Sales",
      kpiKey: "todaySales",
      badgeKey: "todaySales",
      format: "currency",
      iconName: "sales",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/executive-overview/sales-today",
      desc: "Revenue generated today",
    },
    {
      label: "Current Month Revenue",
      kpiKey: "monthSales",
      badgeKey: "monthSales",
      format: "currency",
      iconName: "revenue",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-700",
      path: "/executive-overview/sales-this-month",
      desc: "Month-to-date revenue",
    },
    {
      label: "Current Week Revenue",
      kpiKey: "weekSales",
      badgeKey: "weekSales",
      format: "currency",
      iconName: "week",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      path: "/executive-overview/sales-this-week",
      desc: "Week-to-date revenue",
    },
    {
      label: "Supplier Outstanding",
      kpiKey: "supplierOutstanding",
      badgeKey: "supplierOutstanding",
      format: "currency",
      iconName: "supplier",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-700",
      path: "/executive-overview/supplier-outstanding",
      desc: "Total owed to suppliers",
    },
    {
      label: "Fast Moving Items",
      kpiKey: "fastMovingCount",
      badgeKey: "fastMovingCount",
      format: "count",
      iconName: "fast",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-700",
      path: "/executive-overview/fast-moving-items",
      desc: "High turnover stock",
    },
    {
      label: "Slow Moving Items",
      kpiKey: "slowMovingCount",
      badgeKey: "slowMovingCount",
      format: "count",
      iconName: "slow",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-700",
      path: "/executive-overview/slow-moving-items",
      desc: "Low turnover stock",
    },
  ];


  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Professional ERP Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Executive Overview</h1>
                <p className="text-sm text-gray-500">Enterprise Resource Planning Dashboard</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">System Status: <span className="text-emerald-600 font-medium">Operational</span></p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Report Cards Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-blue-900 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Key Performance Indicators</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded font-medium">Click to view reports</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CARDS.map((card, i) => {
              const val = card.kpiKey ? kpis[card.kpiKey] : null;
              const hasValue = val !== null && val !== undefined;
              const badgeText = card.badgeKey ? kpis.badges?.[card.badgeKey] : "";
              const cardType = i % 4;
              const formattedVal = hasValue
                ? card.format === "count"
                  ? Number(val || 0).toLocaleString()
                  : `₵${fmt(val)}`
                : "—";

              if (cardType === 0) {
                // Card 1: Amber Gold
                return (
                  <button
                    key={i}
                    onClick={() => navigate(card.path)}
                    className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(178,110,23,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(178,110,23,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-amber-500 bg-[#b26e17] text-white"
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5">
                        <div 
                          className="text-2xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
                          style={{ textShadow: "0 0 12px rgba(255, 255, 255, 0.45)" }}
                        >
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                  </button>
                );
              } else if (cardType === 1) {
                // Card 2: Steel Blue
                return (
                  <button
                    key={i}
                    onClick={() => navigate(card.path)}
                    className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(36,82,109,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(36,82,109,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[#24526d] text-white"
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-200 border border-amber-400/20 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none flex items-center">
                          <span>{card.label}</span>
                          <svg className="w-8 h-4 text-white/20 ml-2 group-hover:text-white/40 transition-colors" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M0 15 L10 12 L20 18 L30 8 L40 10 L50 2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                  </button>
                );
              } else if (cardType === 2) {
                // Card 3: Teal Green
                return (
                  <button
                    key={i}
                    onClick={() => navigate(card.path)}
                    className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(24,117,92,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(24,117,92,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-[#18755c] text-white"
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5">
                        <div className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                          <span>{formattedVal}</span>
                          {hasValue && (
                            <svg className="w-5 h-5 text-white/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                            </svg>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                  </button>
                );
              } else {
                // Carbon Black
                return (
                  <button
                    key={i}
                    onClick={() => navigate(card.path)}
                    className="group relative overflow-hidden rounded-[24px] p-5 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/15 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all duration-300 ease-out text-left focus:outline-none focus:ring-2 focus:ring-slate-500 bg-[#1d1f22] bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:8px_8px] text-white"
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start min-h-[22px]">
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold leading-none">{card.desc}</p>
                        {badgeText ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-sm leading-none flex items-center">
                            {badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                          {formattedVal}
                        </div>
                        <div className="mt-2 text-xs font-bold text-white/80 uppercase tracking-wider leading-none">
                          {card.label}
                        </div>
                      </div>
                    </div>
                    <svg className="w-4.5 h-4.5 text-white/20 absolute right-5 bottom-5 group-hover:scale-110 group-hover:text-white/40 transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                  </button>
                );
              }
            })}
          </div>
        </section>

        {/* Module Dashboard Grid Section */}
        {moduleCards.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-emerald-700 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Module Dashboards</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded font-medium">Click to open module</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {moduleCards.map((mod) => (
              <Link
                key={mod.key}
                to={mod.path}
                state={{ fromExecutiveOverview: true }}
                className={`group ${mod.color} text-white p-6 rounded-xl shadow-sm border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] active:scale-[0.98] transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 relative overflow-hidden`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-white/25 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <ModuleIcon name={mod.key} className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight tracking-wide">{mod.label}</p>
                    <p className="text-[10px] text-white/80 uppercase tracking-widest mt-1 font-semibold">{mod.desc}</p>
                  </div>
                </div>
                {/* Shimmer overlay */}
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
              </Link>
            ))}
          </div>
        </section>
        )}

        {/* Quick Actions Footer */}
        <section className="border-t border-gray-200 pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500 font-medium">Quick Actions:</span>
            <Link to="/sales/dashboard" className="text-blue-700 hover:text-blue-900 font-medium transition-colors">Sales Dashboard</Link>
            <span className="text-gray-300">|</span>
            <Link to="/finance/dashboard" className="text-blue-700 hover:text-blue-900 font-medium transition-colors">Finance Dashboard</Link>
            <span className="text-gray-300">|</span>
            <Link to="/inventory/dashboard" className="text-blue-700 hover:text-blue-900 font-medium transition-colors">Inventory Dashboard</Link>
            <span className="text-gray-300">|</span>
            <Link to="/reports" className="text-blue-700 hover:text-blue-900 font-medium transition-colors">All Reports</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
