import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function PromotionList() {
  const { canPerformAction } = usePermission();
  const items = [{ id: 1, employee: 'John Doe', effectiveDate: '2025-01-01', from: 'Junior', to: 'Senior' }];

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Promotions</h1><p className="text-sm mt-1">Track employee promotions (placeholder)</p></div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
          {canPerformAction('human-resources:promotions', 'create') && (
            <Link to="/human-resources/promotions/new" className="btn-success">+ New</Link>
          )}
        </div>
      </div></div>
      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table"><thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50"><tr><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Effective Date</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To</th><th /></tr></thead>
          <tbody>{items.map((r) => (
            <tr key={r.id}><td className="font-medium">{r.employee}</td><td>{new Date(r.effectiveDate).toLocaleDateString()}</td><td>{r.from}</td><td>{r.to}</td>
              <td>
                {canPerformAction('human-resources:promotions', 'edit') && (
                  <Link to={`/human-resources/promotions/${r.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link>
                )}
              </td></tr>
          ))}</tbody>
        </table>
      </div></div>
    </div>
  );
}







