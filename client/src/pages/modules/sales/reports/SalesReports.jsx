import React from 'react';

export default function SalesReports() {
  const reports = [
    { title: 'Sales by Customer', description: 'Sales totals grouped by customer (placeholder)' },
    { title: 'Invoice Aging', description: 'Outstanding invoices aging buckets (placeholder)' },
    { title: 'Discount Analysis', description: 'Discount usage summary (placeholder)' },
  ];

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg">
        <h1 className="text-2xl font-bold dark:text-brand-300">Sales Reports</h1>
        <p className="text-sm mt-1">Analytics and reports</p>
      </div></div>
      <div className="card"><div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</div>
              <div className="text-sm mt-1">{r.description}</div>
            </div>
          ))}
        </div>
      </div></div>
    </div>
  );
}







