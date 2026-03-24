import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveBalances() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/hr/leave/balances");
        setItems(res.data?.items || []);
      } catch {
        toast.error("Failed to load balances");
      }
    };
    load();
  }, []);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/human-resources/leave" className="btn-secondary text-sm">
          Back
        </Link>
        <h1 className="text-xl font-semibold">Leave Balances</h1>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 text-xs uppercase">Employee</th>
              <th className="px-4 py-2 text-xs uppercase">Allocated</th>
              <th className="px-4 py-2 text-xs uppercase">Used</th>
              <th className="px-4 py-2 text-xs uppercase">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.employee_name || `${r.first_name} ${r.last_name}`}</td>
                <td className="px-4 py-2">{r.allocated_days}</td>
                <td className="px-4 py-2">{r.used_days}</td>
                <td className="px-4 py-2">{(Number(r.allocated_days || 0) - Number(r.used_days || 0)).toFixed(1)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No balances</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

