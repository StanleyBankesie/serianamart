import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function LeaveSetupList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, code: 'ANNUAL', name: 'Annual Leave', daysPerYear: 21, active: true },
    { id: 2, code: 'SICK', name: 'Sick Leave', daysPerYear: 10, active: true },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Leave Setup</h1>
            <p className="text-sm mt-1">Configure leave types and balances</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
            <Link to="/human-resources/leave-setup/new" className="btn-success">+ New Leave Type</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Days/Year</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.daysPerYear}</td>
                    <td>{r.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                    <td>
                      {canPerformAction('human-resources:leave-setup','view') && (
                        <Link to={`/human-resources/leave-setup/${r.id}?mode=view`} className="text-brand hover:text-brand-600 text-sm font-medium">View</Link>
                      )}
                      {canPerformAction('human-resources:leave-setup','edit') && (
                        <Link to={`/human-resources/leave-setup/${r.id}?mode=edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">Edit</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}







