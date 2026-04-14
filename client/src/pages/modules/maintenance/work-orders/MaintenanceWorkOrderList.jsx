import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';
import { Guard } from "../../../../hooks/usePermissions";

export default function MaintenanceWorkOrderList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, woNo: 'MWO-0001', asset: 'AST-001 Generator', priority: 'HIGH', status: 'OPEN' },
    { id: 2, woNo: 'MWO-0002', asset: 'AST-002 Forklift', priority: 'MEDIUM', status: 'IN_PROGRESS' },
  ];

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Maintenance Work Orders</h1>
            <p className="text-sm text-slate-500">Corrective and preventive maintenance execution</p>
          </div>
          <div className="flex gap-2">
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/work-orders/new" className="btn-primary">+ New Work Order</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">WO No</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asset</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{w.woNo}</td>
                  <td className="px-4 py-3 text-sm">{w.asset}</td>
                  <td className="px-4 py-3 text-sm">{w.priority}</td>
                  <td className="px-4 py-3 text-sm">{w.status}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {canPerformAction('maintenance:work-orders','view') && (
                      <Link to={`/maintenance/work-orders/${w.id}?mode=view`} className="text-brand hover:underline font-medium text-sm">View</Link>
                    )}
                    {canPerformAction('maintenance:work-orders','edit') && (
                      <Link to={`/maintenance/work-orders/${w.id}?mode=edit`} className="text-blue-600 hover:underline font-medium text-sm ml-3">Edit</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}
