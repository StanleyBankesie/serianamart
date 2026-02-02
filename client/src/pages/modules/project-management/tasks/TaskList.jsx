import React from 'react';
import { Link } from 'react-router-dom';

export default function TaskList() {
  const items = [
    { id: 1, project: 'PRJ-001', title: 'Define chart of accounts', assignee: 'Finance Team', due: '2025-02-15', status: 'IN_PROGRESS' },
    { id: 2, project: 'PRJ-001', title: 'Migrate opening balances', assignee: 'Finance Team', due: '2025-02-28', status: 'PLANNED' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Tasks</h1>
          <p className="text-sm mt-1">Task tracking across projects</p>
        </div>
        <div className="flex gap-2">
          <Link to="/project-management" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/project-management/tasks/new" className="btn-success">+ New Task</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Project</th><th>Title</th><th>Assignee</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.project}</td>
                <td className="font-medium">{t.title}</td>
                <td>{t.assignee}</td>
                <td>{new Date(t.due).toLocaleDateString()}</td>
                <td>{t.status}</td>
                <td><Link to={`/project-management/tasks/${t.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







