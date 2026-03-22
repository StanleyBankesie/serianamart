import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function AttendanceList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from_date: new Date().toISOString().split("T")[0],
    to_date: new Date().toISOString().split("T")[0],
    q: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/attendance", { params: filters });
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.from_date, filters.to_date]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back
          </Link>
          <h2 className="text-lg font-semibold">Attendance Records</h2>
        </div>
        <Link to="/human-resources/attendance/new" className="btn-primary">
          + New Entry
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase block mb-1">From Date</label>
            <input
              type="date"
              className="input"
              value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase block mb-1">To Date</label>
            <input
              type="date"
              className="input"
              value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase block mb-1">Employee Name/Code</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Search..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
              <button className="btn-secondary" onClick={loadData}>Filter</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left bg-slate-50 dark:bg-slate-700">
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Clock In</th>
                <th className="px-4 py-2">Clock Out</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.first_name} {r.last_name}</div>
                    <div className="text-xs text-slate-500">{r.emp_code}</div>
                  </td>
                  <td className="px-4 py-2">{new Date(r.attendance_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${
                      r.status === 'PRESENT' ? 'badge-success' : 
                      r.status === 'ABSENT' ? 'badge-error' : 'badge-warning'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}</td>
                  <td className="px-4 py-2">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/human-resources/attendance/${r.id}`} className="text-brand hover:underline text-sm">Edit</Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">No records found for selected filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}







