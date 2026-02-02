import React from 'react';
import { Link } from 'react-router-dom';

export default function MedicalPolicyList() {
  const items = [{ id: 1, provider: 'Omni Health', policyName: 'Standard Plan', active: true }];

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Medical Policies</h1><p className="text-sm mt-1">Employee medical policy setup (placeholder)</p></div>
        <div className="flex gap-2">
          <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/human-resources/medical-policies/new" className="btn-success">+ New</Link>
        </div>
      </div></div>
      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table"><thead><tr><th>Provider</th><th>Policy</th><th>Status</th><th /></tr></thead>
          <tbody>{items.map((r) => (
            <tr key={r.id}><td className="font-medium">{r.provider}</td><td>{r.policyName}</td>
              <td>{r.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-error">Inactive</span>}</td>
              <td>
                <Link to={`/human-resources/medical-policies/${r.id}?mode=view`} className="text-brand hover:text-brand-600 text-sm font-medium">View</Link>
                <Link to={`/human-resources/medical-policies/${r.id}?mode=edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">Edit</Link>
              </td></tr>
          ))}</tbody>
        </table>
      </div></div>
    </div>
  );
}







