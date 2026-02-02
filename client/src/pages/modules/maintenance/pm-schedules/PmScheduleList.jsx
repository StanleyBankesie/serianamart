import React from 'react';
import { Link } from 'react-router-dom';

export default function PmScheduleList() {
  const items = [
    { id: 1, code: 'PM-001', asset: 'AST-001 Generator', frequency: 'MONTHLY', active: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Preventive Maintenance Schedules</h1>
          <p className="text-sm mt-1">Define PM frequency and tasks</p>
        </div>
        <div className="flex gap-2">
          <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/maintenance/pm-schedules/new" className="btn-success">+ New Schedule</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Code</th><th>Asset</th><th>Frequency</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.code}</td>
                <td>{s.asset}</td>
                <td>{s.frequency}</td>
                <td>{s.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                <td>
                  <Link
                    to={`/maintenance/pm-schedules/${s.id}?mode=view`}
                    className="text-brand hover:text-brand-600 text-sm font-medium"
                  >
                    View
                  </Link>
                  <Link
                    to={`/maintenance/pm-schedules/${s.id}?mode=edit`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







