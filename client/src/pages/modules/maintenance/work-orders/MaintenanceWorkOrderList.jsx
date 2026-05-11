import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react';
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
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/maintenance" className="btn btn-secondary p-2">
               <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Maintenance Work Orders</h1>
              <p className="text-slate-500 text-sm">Corrective and preventive maintenance execution</p>
            </div>
          </div>
          <Link to="/maintenance/work-orders/new" className="btn-success flex items-center gap-2">
             <Plus size={20} />
             + New Work Order
          </Link>
        </div>

        <div className="card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>WO No</th>
                  <th>Asset</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {items.map((w) => (
                  <tr key={w.id} className="group">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">{w.woNo}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-300">{w.asset}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-medium">{w.priority}</td>
                    <td className="px-4 py-3 text-sm">
                       <span className="badge badge-info">{w.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link 
                          to={`/maintenance/work-orders/${w.id}?mode=view`} 
                          className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Guard>
  );
}
