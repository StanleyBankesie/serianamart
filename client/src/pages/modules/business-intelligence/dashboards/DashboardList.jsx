import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function DashboardList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, name: 'Executive Overview', description: 'Enterprise KPIs across all modules', active: true, icon: '📊', color: 'from-emerald-600 to-emerald-800' },
    { id: 2, name: 'Sales KPIs', description: 'Revenue, average order, customer growth, profitability', active: true, icon: '🧾', color: 'from-blue-600 to-blue-800' },
    { id: 3, name: 'Purchase KPIs', description: 'Spend, supplier performance, order cycle times', active: true, icon: '🛒', color: 'from-indigo-600 to-indigo-800' },
    { id: 4, name: 'Inventory KPIs', description: 'Stock valuation, turns, low-stock, aging', active: true, icon: '📦', color: 'from-purple-600 to-purple-800' },
    { id: 5, name: 'Finance KPIs', description: 'P&L highlights, cash flow, ratios, ledger health', active: true, icon: '💳', color: 'from-rose-600 to-rose-800' },
    { id: 6, name: 'Human Resources KPIs', description: 'Headcount, attendance, payroll, attrition', active: true, icon: '👥', color: 'from-teal-600 to-teal-800' },
    { id: 7, name: 'POS KPIs', description: 'Terminal sales, peak hours, basket size, payment mix', active: true, icon: '🧮', color: 'from-orange-600 to-orange-800' },
    { id: 8, name: 'Production KPIs', description: 'WO throughput, yield, downtime, OEE', active: true, icon: '🏭', color: 'from-yellow-600 to-yellow-700' },
    { id: 9, name: 'Project Management KPIs', description: 'Progress, burn-down, cycle time, blockers', active: true, icon: '📋', color: 'from-cyan-600 to-cyan-800' },
    { id: 10, name: 'Maintenance KPIs', description: 'Work orders, MTTR, compliance, asset health', active: true, icon: '🛠', color: 'from-lime-600 to-lime-700' },
    { id: 11, name: 'Administration KPIs', description: 'User activity, permissions, audit status', active: true, icon: '⚙', color: 'from-slate-600 to-slate-800' },
    { id: 12, name: 'Custom Analytics', description: 'Cross-module insights and ad-hoc dashboards', active: true, icon: '✨', color: 'from-fuchsia-600 to-fuchsia-800' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Dashboards</h1>
          <p className="text-sm mt-1">Saved KPI dashboards covering all modules</p>
        </div>
        <div className="flex gap-2">
          <Link to="/business-intelligence" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/business-intelligence/dashboards/new" className="btn-success">+ New Dashboard</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((d) => (
          <div
            key={d.id}
            className={`rounded-xl shadow-erp border border-slate-200 dark:border-slate-700 overflow-hidden bg-gradient-to-br ${d.color} text-white`}
          >
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-2xl">{d.icon}</div>
                <span className={d.active ? "badge badge-success" : "badge badge-error"}>
                  {d.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 font-bold text-lg">{d.name}</div>
              <div className="mt-1 text-sm opacity-90">{d.description}</div>
              <div className="mt-4 flex gap-2">
                {canPerformAction("business-intelligence:dashboards", "view") && (
                  <Link
                    to={`/business-intelligence/dashboards/${d.id}?mode=view`}
                    className="btn btn-sm btn-secondary"
                  >
                    View
                  </Link>
                )}
                {canPerformAction("business-intelligence:dashboards", "edit") && (
                  <Link
                    to={`/business-intelligence/dashboards/${d.id}?mode=edit`}
                    className="btn btn-sm btn-secondary"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}






