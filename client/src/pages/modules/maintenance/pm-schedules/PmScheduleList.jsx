import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';
import { Guard } from "../../../../hooks/usePermissions";

export default function PmScheduleList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, code: 'PM-001', asset: 'AST-001 Generator', frequency: 'MONTHLY', active: true },
  ];

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Preventive Maintenance Schedules</h1>
            <p className="text-sm text-slate-500">Define PM frequency and tasks</p>
          </div>
          <div className="flex gap-2">
            <Link to="/maintenance" className="btn-secondary">Back to Menu</Link>
            <Link to="/maintenance/pm-schedules/new" className="btn-primary">+ New Schedule</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asset</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Frequency</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{s.code}</td>
                  <td className="px-4 py-3 text-sm">{s.asset}</td>
                  <td className="px-4 py-3 text-sm">{s.frequency}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.active ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-medium rounded-full">Active</span> : <span className="bg-red-100 text-red-700 px-2 py-1 text-xs font-medium rounded-full">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {canPerformAction('maintenance:pm-schedules','view') && (
                      <Link
                        to={`/maintenance/pm-schedules/${s.id}?mode=view`}
                        className="text-brand hover:underline font-medium text-sm"
                      >
                        View
                      </Link>
                    )}
                    {canPerformAction('maintenance:pm-schedules','edit') && (
                      <Link
                        to={`/maintenance/pm-schedules/${s.id}?mode=edit`}
                        className="text-blue-600 hover:underline font-medium text-sm ml-3"
                      >
                        Edit
                      </Link>
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
