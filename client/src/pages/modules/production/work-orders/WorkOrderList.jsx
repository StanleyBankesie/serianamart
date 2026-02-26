import React from 'react';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function WorkOrderList() {
  const { canPerformAction } = usePermission();
  const items = [
    { id: 1, woNo: 'WO-0001', product: 'Finished Good A', qty: 10, status: 'PLANNED' },
    { id: 2, woNo: 'WO-0002', product: 'Finished Good B', qty: 5, status: 'RELEASED' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Work Orders</h1>
          <p className="text-sm mt-1">Production order tracking</p>
        </div>
        <div className="flex gap-2">
          <Link to="/production" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/production/work-orders/new" className="btn-success">+ New Work Order</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>WO No</th><th>Product</th><th className="text-right">Qty</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td className="font-medium">{w.woNo}</td>
                <td>{w.product}</td>
                <td className="text-right">{Number(w.qty).toFixed(2)}</td>
                <td>{w.status}</td>
                <td>
                  {canPerformAction('production:work-orders','view') && (
                    <Link
                      to={`/production/work-orders/${w.id}?mode=view`}
                      className="text-brand hover:text-brand-600 text-sm font-medium"
                    >
                      View
                    </Link>
                  )}
                  {canPerformAction('production:work-orders','edit') && (
                    <Link
                      to={`/production/work-orders/${w.id}?mode=edit`}
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







