import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function ReportList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, name: 'Sales Summary', module: 'Sales', active: true },
    { id: 2, name: 'Voucher Register', module: 'Finance', active: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Saved Reports</h1>
          <p className="text-sm mt-1">Report definitions and schedules</p>
        </div>
        <div className="flex gap-2">
          <Link to="/business-intelligence" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/business-intelligence/reports/new" className="btn-success">+ New Report</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Module</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{r.module}</td>
                <td>{r.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                <td>
                  {canPerformAction("business-intelligence:reports", "view") && (
                    <Link
                      to={`/business-intelligence/reports/${r.id}?mode=view`}
                      className="text-brand hover:text-brand-600 text-sm font-medium"
                    >
                      View
                    </Link>
                  )}
                  {canPerformAction("business-intelligence:reports", "edit") && (
                    <Link
                      to={`/business-intelligence/reports/${r.id}?mode=edit`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







