import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function TimesheetView() {
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(1)).toISOString().slice(0, 10)); // Start of month
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // New entry form
  const [form, setForm] = useState({
    employee_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    hours_worked: 8,
    overtime_hours: 0,
    remarks: ''
  });

  useEffect(() => {
    loadEmployees();
    loadTimesheets();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/hr/employees");
      setEmployees(res.data.items || []);
    } catch {}
  };

  const loadTimesheets = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (employeeId) params.employee_id = employeeId;
      const res = await api.get("/hr/timesheets", { params });
      setItems(res.data.items || []);
    } catch {
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Please select an employee");
    try {
      await api.post("/hr/timesheets", form);
      toast.success("Timesheet entry saved");
      loadTimesheets();
      // Keep employee selected but reset date/hours if needed
      setForm(prev => ({ ...prev, remarks: '' }));
    } catch {
      toast.error("Failed to save timesheet");
    }
  };

  const totalHours = items.reduce((sum, it) => sum + Number(it.hours_worked || 0), 0);
  const totalOT = items.reduce((sum, it) => sum + Number(it.overtime_hours || 0), 0);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Timesheet Management</h1>
            <p className="text-sm text-slate-500">Record and track daily work hours and overtime</p>
          </div>
          <Link to="/human-resources" className="btn-secondary">Back to Menu</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add New Entry Form */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 h-fit">
            <h2 className="font-semibold mb-4 border-b pb-2">New Timesheet Entry</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="label">Employee *</label>
                <select 
                  className="input" 
                  value={form.employee_id} 
                  onChange={(e) => setForm({...form, employee_id: e.target.value})}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.emp_code} - {e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Work Date *</label>
                <input 
                  type="date" 
                  className="input" 
                  value={form.work_date}
                  onChange={(e) => setForm({...form, work_date: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Regular Hours</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="input" 
                    value={form.hours_worked}
                    onChange={(e) => setForm({...form, hours_worked: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">OT Hours</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="input" 
                    value={form.overtime_hours}
                    onChange={(e) => setForm({...form, overtime_hours: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea 
                  className="input h-20" 
                  placeholder="Task details..."
                  value={form.remarks}
                  onChange={(e) => setForm({...form, remarks: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2 mt-2">
                Save Entry
              </button>
            </form>
          </div>

          {/* Timesheet List and Filter */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Filter Employee</label>
                <select 
                  className="input" 
                  value={employeeId} 
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">From</label>
                <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <button className="btn-secondary px-4 py-2" onClick={loadTimesheets}>Search</button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h2 className="font-semibold">Timesheet Logs</h2>
                <div className="flex gap-4 text-sm">
                  <span>Total Regular: <strong className="text-brand">{totalHours}h</strong></span>
                  <span>Total OT: <strong className="text-amber-600">{totalOT}h</strong></span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Regular</th>
                      <th className="px-4 py-3 text-right">OT</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((r) => (
                      <tr key={r.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 font-medium">{r.first_name} {r.last_name}</td>
                        <td className="px-4 py-3 text-slate-500">{new Date(r.work_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{r.hours_worked}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-600">{r.overtime_hours}</td>
                        <td className="px-4 py-3 text-slate-500 italic truncate max-w-[200px]" title={r.remarks}>
                          {r.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                          No timesheet records found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}