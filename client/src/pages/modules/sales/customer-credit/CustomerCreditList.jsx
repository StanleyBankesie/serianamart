import React from 'react';
import { Link } from 'react-router-dom';

export default function CustomerCreditList() {
  const items = [{ id: 1, customer: 'ABC Corporation', creditLimit: 50000, currency: 'GHS' }];

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Customer Credit Limits</h1><p className="text-sm mt-1">Credit limit setup (placeholder)</p></div>
        <Link to="/sales" className="btn btn-secondary">Return to Menu</Link>
      </div></div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table"><thead><tr><th>Customer</th><th className="text-right">Credit Limit</th><th>Currency</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.customer}</td>
                <td className="text-right">{Number(r.creditLimit).toFixed(2)}</td>
                <td>{r.currency}</td>
                <td><Link to={`/sales/customer-credit/${r.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







