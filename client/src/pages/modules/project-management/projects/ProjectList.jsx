import React from 'react';
import { Link } from 'react-router-dom';

export default function ProjectList() {
  const items = [
    { id: 1, code: 'PRJ-001', name: 'ERP Rollout', status: 'IN_PROGRESS', budget: 50000 },
    { id: 2, code: 'PRJ-002', name: 'Warehouse Upgrade', status: 'PLANNED', budget: 20000 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Projects</h1>
          <p className="text-sm mt-1">Project portfolio</p>
        </div>
        <div className="flex gap-2">
          <Link to="/project-management" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/project-management/projects/new" className="btn-success">+ New Project</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Status</th><th className="text-right">Budget</th><th /></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.code}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td className="text-right">{Number(p.budget).toFixed(2)}</td>
                <td><Link to={`/project-management/projects/${p.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







