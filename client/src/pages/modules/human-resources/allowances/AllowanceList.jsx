import React from 'react';
import { Link } from 'react-router-dom';

export default function AllowanceList() {
  const items = [{ id: 1, name: 'Transport Allowance', amount: 200, active: true }];
  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Employee Allowances</h1><p className="text-sm mt-1">Allowance setup (placeholder)</p></div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/human-resources/allowances/new" className="btn-success">+ New</Link>
        </div>
      </div></div>
      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table"><thead><tr><th>Name</th><th className="text-right">Amount</th><th>Status</th><th /></tr></thead>
          <tbody>{items.map((r)=>(
            <tr key={r.id}><td className="font-medium">{r.name}</td><td className="text-right">{Number(r.amount).toFixed(2)}</td>
              <td>{r.active?<span className="badge badge-success">Active</span>:<span className="badge badge-error">Inactive</span>}</td>
              <td>
                <Link className="text-brand hover:text-brand-600 text-sm font-medium" to={`/human-resources/allowances/${r.id}?mode=view`}>View</Link>
                <Link className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2" to={`/human-resources/allowances/${r.id}?mode=edit`}>Edit</Link>
              </td></tr>
          ))}</tbody>
        </table>
      </div></div>
    </div>
  );
}







