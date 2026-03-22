import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function AppraisalForm() {
  const [employees, setEmployees] = React.useState([]);
  const [form, setForm] = React.useState({
    employee_id: "",
    period_name: "",
    reviewer_user_id: "",
    overall_rating: "",
    comments: "",
  });

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const e = await api.get("/hr/employees");
        if (mounted) setEmployees(e?.data?.items || []);
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hr/performance/reviews", {
        ...form,
        reviewer_user_id: form.reviewer_user_id || 1,
      });
      toast.success("Appraisal saved");
      setForm({
        employee_id: "",
        period_name: "",
        reviewer_user_id: "",
        overall_rating: "",
        comments: "",
      });
    } catch {
      toast.error("Failed to save appraisal");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/human-resources" className="btn-secondary text-sm">
          Back to Menu
        </Link>
        <h2 className="text-lg font-semibold">Appraisal Form</h2>
      </div>
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
                  {e.full_name || `${e.first_name} ${e.last_name}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Period</label>
            <input
              className="input"
              value={form.period_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, period_name: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Overall Rating</label>
            <input
              className="input"
              value={form.overall_rating}
              onChange={(e) =>
                setForm((s) => ({ ...s, overall_rating: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Comments</label>
            <textarea
              className="input"
              rows={3}
              value={form.comments}
              onChange={(e) =>
                setForm((s) => ({ ...s, comments: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
