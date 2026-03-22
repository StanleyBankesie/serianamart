import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function MedicalPolicyList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/medical-policies");
      setItems(res.data.items || []);
    } catch {
      toast.error("Failed to load medical policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Medical Policies</h1>
            <p className="text-sm text-slate-500">Manage employee medical insurance policies</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn-secondary">Back to Menu</Link>
            <Link to="/human-resources/medical-policies/new" className="btn-primary">+ New Policy</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Policy Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Provider</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Premium</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Renewal</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{r.policy_code}</td>
                  <td className="px-4 py-3 text-sm">{r.policy_name}</td>
                  <td className="px-4 py-3 text-sm">{r.provider}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">
                    {Number(r.premium_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.renewal_date ? new Date(r.renewal_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <Link to={`/human-resources/medical-policies/${r.id}`} className="text-brand hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No medical policies found. Click "+ New Policy" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}






