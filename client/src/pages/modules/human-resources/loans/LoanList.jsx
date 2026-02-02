import React from 'react';
import { Link } from 'react-router-dom';

export default function LoanList() {
  const items = [{ id: 1, employee: 'John Doe', amount: 1000, balance: 600, status: 'ACTIVE' }];

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-brand-300">Employee Loans</h1>
          <p className="text-sm mt-1">Loan setup and tracking (placeholder)</p>
        </div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/human-resources/loans/new" className="btn-success">+ New</Link>
        </div>
      </div></div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.employee}</td>
                <td className="text-right">{Number(r.amount).toFixed(2)}</td>
                <td className="text-right">{Number(r.balance).toFixed(2)}</td>
                <td>{r.status}</td>
                <td>
                  <Link to={`/human-resources/loans/${r.id}?mode=view`} className="text-brand hover:text-brand-600 text-sm font-medium">View</Link>
                  <Link to={`/human-resources/loans/${r.id}?mode=edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







