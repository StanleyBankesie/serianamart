import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function PromotionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    promotion_date: new Date().toISOString().split("T")[0],
    previous_pos_id: "",
    new_pos_id: "",
    previous_salary: 0,
    new_salary: 0,
    remarks: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [empRes, posRes] = await Promise.all([
          api.get("/hr/employees"),
          api.get("/hr/positions"),
        ]);
        setEmployees(empRes?.data?.items || []);
        setPositions(posRes?.data?.items || []);
      } catch {}
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/promotions/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          promotion_date: item.promotion_date ? item.promotion_date.slice(0, 10) : "",
        });
      } catch {
        toast.error("Failed to fetch promotion details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  const onEmployeeChange = (empId) => {
    const emp = employees.find((e) => String(e.id) === String(empId));
    if (emp) {
      setForm((s) => ({
        ...s,
        employee_id: empId,
        previous_pos_id: emp.pos_id || "",
        previous_salary: emp.base_salary || 0,
      }));
    } else {
      setForm((s) => ({ ...s, employee_id: empId }));
    }
  };

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Select employee");
    if (!form.new_pos_id && !form.new_salary) return toast.error("Enter new position or salary");

    setLoading(true);
    try {
      await api.post("/hr/promotions", form);
      toast.success("Promotion saved successfully");
      navigate("/human-resources/promotions");
    } catch {
      toast.error("Failed to save promotion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit ? "Edit Promotion" : "New Promotion"}
            </h1>
          </div>
          <Link to="/human-resources/promotions" className="btn-secondary">
            Back
          </Link>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card shadow-sm">
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6">
              <div className="md:col-span-2 text-lg font-semibold text-brand">Employee Details</div>
              <div>
                <label className="label">Employee *</label>
                <select
                  className="input"
                  value={form.employee_id}
                  onChange={(e) => onEmployeeChange(e.target.value)}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emp_code} - {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Promotion/Effective Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.promotion_date}
                  onChange={(e) => update("promotion_date", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
              <div className="text-lg font-semibold text-slate-700">Current Assignment</div>
              <div className="text-lg font-semibold text-brand">New Assignment</div>
              
              <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded">
                <label className="text-xs font-medium uppercase text-slate-500 mb-2 block">Current Position</label>
                <div className="font-medium">
                  {positions.find(p => String(p.id) === String(form.previous_pos_id))?.pos_name || "None"}
                </div>
                <label className="text-xs font-medium uppercase text-slate-500 mt-4 mb-2 block">Current Salary</label>
                <div className="font-medium">{Number(form.previous_salary).toLocaleString()}</div>
              </div>

              <div className="bg-brand/5 dark:bg-brand/10 p-4 rounded border border-brand/10">
                <div>
                  <label className="label">New Position</label>
                  <select
                    className="input"
                    value={form.new_pos_id}
                    onChange={(e) => update("new_pos_id", e.target.value)}
                  >
                    <option value="">No Change</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pos_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <label className="label">New Salary</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.new_salary}
                    onChange={(e) => update("new_salary", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Remarks/Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.remarks}
                onChange={(e) => update("remarks", e.target.value)}
                placeholder="Reason for promotion, changes, etc."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link to="/human-resources/promotions" className="btn-secondary">
                Cancel
              </Link>
              <button className="btn-primary px-8" disabled={loading}>
                {loading ? "Saving..." : "Save Promotion"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







