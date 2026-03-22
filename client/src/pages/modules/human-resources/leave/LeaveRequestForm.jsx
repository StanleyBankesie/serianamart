import React from "react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function LeaveRequestForm() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    total_days: 1,
    reason: "",
  });
  const [types, setTypes] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [tRes, eRes] = await Promise.all([
          api.get("/hr/leave/types"),
          api.get("/hr/employees"),
        ]);
        if (mounted) {
          setTypes(tRes?.data?.items || []);
          setEmployees(eRes?.data?.items || []);
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/leave/apply", { ...form });
      toast.success("Leave requested");
      navigate("/human-resources/attendance");
    } catch {
      toast.error("Failed to request leave");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Leave Request</h2>
      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-800 p-4 rounded"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Employee</label>
            <select
              className="input"
              value={form.employee_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, employee_id: e.target.value }))
              }
            >
              <option value="">Select</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name || `${e.first_name} ${e.last_name}`} (
                  {e.emp_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Leave Type</label>
            <select
              className="input"
              value={form.leave_type_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, leave_type_id: e.target.value }))
              }
            >
              <option value="">Select</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.type_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) =>
                setForm((s) => ({ ...s, start_date: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">End Date</label>
            <input
              type="date"
              className="input"
              value={form.end_date}
              onChange={(e) =>
                setForm((s) => ({ ...s, end_date: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Total Days</label>
            <input
              type="number"
              className="input"
              value={form.total_days}
              onChange={(e) =>
                setForm((s) => ({ ...s, total_days: Number(e.target.value) }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Reason</label>
            <textarea
              className="input"
              rows={3}
              value={form.reason}
              onChange={(e) =>
                setForm((s) => ({ ...s, reason: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
