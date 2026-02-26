import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function ShiftList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, code: 'DAY', name: 'Day Shift', start: '08:00', end: '17:00', active: true },
    { id: 2, code: 'NIGHT', name: 'Night Shift', start: '20:00', end: '05:00', active: true },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Shift System Setup</h1>
            <p className="text-sm mt-1">Manage work shifts</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
            {canPerformAction('human-resources:shifts', 'create') && (
              <Link to="/human-resources/shifts/new" className="btn-success">+ New Shift</Link>
            )}
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
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.start}</td>
                    <td>{s.end}</td>
                    <td>{s.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                    <td>
                      {canPerformAction('human-resources:shifts', 'edit') && (
                        <Link to={`/human-resources/shifts/${s.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link>
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







