import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ShiftList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/shifts");
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back
          </Link>
          <h2 className="text-lg font-semibold">Shift Management</h2>
        </div>
        <Link to="/human-resources/shifts/new" className="btn-primary">
          + New Shift
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left bg-slate-50 dark:bg-slate-700">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Start Time</th>
                <th className="px-4 py-2">End Time</th>
                <th className="px-4 py-2">Break (min)</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2 font-mono text-sm">{s.code}</td>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">{s.start_time}</td>
                  <td className="px-4 py-2">{s.end_time}</td>
                  <td className="px-4 py-2">{s.break_minutes}</td>
                  <td className="px-4 py-2">
                    {s.is_active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-error">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/human-resources/shifts/${s.id}`} className="text-brand hover:underline text-sm">Edit</Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">No shifts defined</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}







