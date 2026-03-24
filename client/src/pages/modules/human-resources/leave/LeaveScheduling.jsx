import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveScheduling() {
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    employee_ids: [],
    leave_type_id: "",
    start_date: "",
    end_date: "",
    remarks: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [e, t] = await Promise.all([
          api.get("/hr/employees?status=ACTIVE"),
          api.get("/hr/leave/types"),
        ]);
        setEmployees(e.data?.items || []);
        setTypes(t.data?.items || []);
      } catch {
        toast.error("Failed to load data");
      }
    };
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_ids.length) return toast.error("Select employees");
    if (!form.leave_type_id || !form.start_date || !form.end_date)
      return toast.error("Fill all fields");
    setLoading(true);
    try {
      const res = await api.post("/hr/leave/schedule", form);
      toast.success(`Scheduled ${res.data?.scheduled || 0} leave record(s)`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to schedule leave");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/human-resources/leave" className="btn-secondary text-sm">
          Back
        </Link>
        <h1 className="text-xl font-semibold">Leave Scheduling</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Employees</label>
            <select
              multiple
              className="input h-40"
              value={form.employee_ids.map(String)}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                setForm({ ...form, employee_ids: opts.map(Number) });
              }}
            >
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
              onChange={(e) =>
                setForm({ ...form, leave_type_id: e.target.value })
              }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input
                className="input"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                className="input"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea
              className="input"
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Scheduling..." : "Schedule Leave"}
          </button>
        </form>
      </div>
    </div>
  );
}

