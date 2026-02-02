import React from 'react';
import { Link } from 'react-router-dom';

export default function MaintenanceWorkOrderList() {
  const items = [
    { id: 1, woNo: 'MWO-0001', asset: 'AST-001 Generator', priority: 'HIGH', status: 'OPEN' },
    { id: 2, woNo: 'MWO-0002', asset: 'AST-002 Forklift', priority: 'MEDIUM', status: 'IN_PROGRESS' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/maintenance" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to Maintenance</Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Maintenance Work Orders</h1>
          <p className="text-sm mt-1">Corrective and preventive maintenance execution</p>
        </div>
        <Link to="/maintenance/work-orders/new" className="btn-success">+ New Work Order</Link>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>WO No</th><th>Asset</th><th>Priority</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td className="font-medium">{w.woNo}</td>
                <td>{w.asset}</td>
                <td>{w.priority}</td>
                <td>{w.status}</td>
                <td>
                  <Link to={`/maintenance/work-orders/${w.id}?mode=view`} className="text-brand hover:text-brand-600 text-sm font-medium">View</Link>
                  <Link to={`/maintenance/work-orders/${w.id}?mode=edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







