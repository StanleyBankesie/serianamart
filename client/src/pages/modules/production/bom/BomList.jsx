import React from 'react';
import { Link } from 'react-router-dom';

export default function BomList() {
  const items = [
    { id: 1, code: 'BOM-001', product: 'Finished Good A', version: 'v1', active: true },
    { id: 2, code: 'BOM-002', product: 'Finished Good B', version: 'v1', active: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Bills of Materials (BOM)</h1>
          <p className="text-sm mt-1">Manage BOM definitions</p>
        </div>
        <div className="flex gap-2">
          <Link to="/production" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/production/bom/new" className="btn-success">+ New BOM</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Code</th><th>Product</th><th>Version</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.code}</td>
                <td>{b.product}</td>
                <td>{b.version}</td>
                <td>{b.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
                <td>
                  <Link
                    to={`/production/bom/${b.id}?mode=view`}
                    className="text-brand hover:text-brand-600 text-sm font-medium"
                  >
                    View
                  </Link>
                  <Link
                    to={`/production/bom/${b.id}?mode=edit`}
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







