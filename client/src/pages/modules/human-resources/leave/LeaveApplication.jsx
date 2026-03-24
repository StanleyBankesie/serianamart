import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveApplication() {
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    total_days: "",
    reason: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [t, e, r] = await Promise.all([
          api.get("/hr/leave/types"),
          api.get("/hr/employees?status=ACTIVE"),
          api.get("/hr/leave/requests"),
        ]);
        setTypes(t.data?.items || []);
        setEmployees(e.data?.items || []);
        setItems(r.data?.items || []);
      } catch {
        toast.error("Failed to load leave data");
      }
    };
    load();
  }, []);

  function calcDays(start, end) {
    if (!start || !end) return "";
    const s = new Date(start);
    const e = new Date(end);
    const diff = (e - s) / (1000 * 3600 * 24) + 1;
    return diff > 0 ? diff.toFixed(1) : "";
  }

  useEffect(() => {
    const days = calcDays(form.start_date, form.end_date);
    setForm((p) => ({ ...p, total_days: days }));
  }, [form.start_date, form.end_date]);

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await api.post("/hr/leave/apply", form);
      toast.success("Leave request submitted");
      const r = await api.get("/hr/leave/requests");
      setItems(r.data?.items || []);
      setForm({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        total_days: "",
        reason: "",
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit leave");
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/human-resources/leave" className="btn-secondary text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Leave Application</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Employee</label>
              <select
                className="input"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.emp_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Leave Type</label>
              <select
                className="input"
                value={form.leave_type_id}
                onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.type_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Total Days</label>
              <input className="input bg-slate-50" value={form.total_days} readOnly />
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea
                className="input"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <button className="btn-primary w-full" type="submit">
              Submit
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Employee
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Period
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Days
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.first_name} {r.last_name}</div>
                  </td>
                  <td className="px-4 py-2">{r.type_name || "-"}</td>
                  <td className="px-4 py-2">{r.start_date} → {r.end_date}</td>
                  <td className="px-4 py-2">{r.total_days}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${r.status === 'APPROVED' ? 'badge-success' : r.status === 'REJECTED' ? 'badge-error' : 'badge-warning'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

