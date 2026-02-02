import React from 'react';
import { Link } from 'react-router-dom';

export default function ReportsPage() {
  const reports = [
    { title: 'User Login Activity', description: 'Recent logins per user (placeholder)' },
    { title: 'Permission Changes', description: 'Audit report of permission updates (placeholder)' },
    { title: 'Workflow Queue', description: 'Documents pending approvals (placeholder)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/administration"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Administration
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Administration Reports</h1>
        <p className="text-sm mt-1">System monitoring and audit reporting</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</div>
                <div className="text-sm mt-1">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}







