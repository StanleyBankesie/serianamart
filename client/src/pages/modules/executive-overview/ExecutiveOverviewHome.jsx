import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ERP Professional Color Scheme
const MODULE_CARDS = [
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

  // ERP Professional KPI Card Design
  const KPI_CARDS = [
    {
      label: "Outstanding Receivables",
      kpiKey: "outstandingReceivables",
      iconName: "receivables",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      path: "/executive-overview/outstanding-receivables",
      desc: "Customer payments due",
    },
    {
      label: "Outstanding Payables",
      kpiKey: "outstandingPayables",
      iconName: "payables",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      path: "/executive-overview/outstanding-payables",
      desc: "Supplier payments owed",
    },
    {
      label: "Today's Sales",
      kpiKey: "todaySales",
      iconName: "sales",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      path: "/executive-overview/sales-today",
      desc: "Revenue generated today",
    },
    {
      label: "Current Month Revenue",
      kpiKey: "monthSales",
      iconName: "revenue",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-700",
      path: "/executive-overview/sales-this-month",
      desc: "Month-to-date revenue",
    },
    {
      label: "Current Week Revenue",
      kpiKey: "weekSales",
      iconName: "week",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      path: "/executive-overview/sales-this-week",
      desc: "Week-to-date revenue",
    },
    {
      label: "Supplier Outstanding",
      kpiKey: "supplierOutstanding",
      iconName: "supplier",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-700",
      path: "/executive-overview/supplier-outstanding",
      desc: "Total owed to suppliers",
    },
    {
      label: "Fast Moving Items",
      kpiKey: null,
      iconName: "fast",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-700",
      path: "/executive-overview/fast-moving-items",
      desc: "High turnover stock",
    },
    {
      label: "Slow Moving Items",
      kpiKey: null,
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
              return (
                <button
                  key={i}
                  onClick={() => navigate(card.path)}
                  className="group bg-white border border-gray-200 rounded-lg p-5 text-left transition-all duration-200 hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 ${card.iconBg} ${card.iconColor} rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
                      <KpiIcon name={card.iconName} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{card.desc}</p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{card.label}</p>
                      {hasValue ? (
                        <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">₵{fmt(val)}</p>
                      ) : (
                        <p className="text-sm text-blue-600 font-medium mt-1 group-hover:text-blue-700">View Report →</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Module Dashboard Grid Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-emerald-700 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Module Dashboards</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded font-medium">Click to open module</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {MODULE_CARDS.map((mod) => (
              <Link
                key={mod.key}
                to={mod.path}
                state={{ fromExecutiveOverview: true }}
                className={`group ${mod.color} text-white p-5 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                    <ModuleIcon name={mod.key} className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{mod.label}</p>
                    <p className="text-xs text-white/70 mt-0.5 font-medium">{mod.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

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
