import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function AssetList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, assetNo: 'AST-001', name: 'Generator', location: 'Plant 1', status: 'ACTIVE' },
    { id: 2, assetNo: 'AST-002', name: 'Forklift', location: 'Warehouse', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Assets</h1>
          <p className="text-sm mt-1">Register and manage maintainable assets</p>
        </div>
        <div className="flex gap-2">
          <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/maintenance/assets/new" className="btn-success">+ New Asset</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Asset No</th><th>Name</th><th>Location</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.assetNo}</td>
                <td>{a.name}</td>
                <td>{a.location}</td>
                <td>{a.status}</td>
                <td>
                  {canPerformAction('maintenance:assets','view') && (
                    <Link
                      to={`/maintenance/assets/${a.id}?mode=view`}
                      className="text-brand hover:text-brand-600 text-sm font-medium"
                    >
                      View
                    </Link>
                  )}
                  {canPerformAction('maintenance:assets','edit') && (
                    <Link
                      to={`/maintenance/assets/${a.id}?mode=edit`}
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







