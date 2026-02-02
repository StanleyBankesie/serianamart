import React from 'react';
import { Link } from 'react-router-dom';

export default function SalaryConfigList() {
  const items = [
    { id: 1, name: 'Standard Monthly', currency: 'GHS', active: true },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Salary Configuration</h1>
            <p className="text-sm mt-1">Define salary structures and components</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
            <Link to="/human-resources/salary-config/new" className="btn-success">+ New Config</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td>{r.currency}</td>
                    <td>{r.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                    <td>
                      <Link to={`/human-resources/salary-config/${r.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link>
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







