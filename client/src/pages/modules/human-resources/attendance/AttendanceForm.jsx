import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { filterAndSort } from "../../../../utils/searchUtils.js";

export default function AttendanceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empQuery, setEmpQuery] = useState("");
  const [form, setForm] = useState({ employee_id: '', attendance_date: new Date().toISOString().split('T')[0], status: 'PRESENT' });

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await api.get("/hr/employees");
        setEmployees(res.data?.items || []);
      } catch {}
    }
    loadEmployees();

    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hr/attendance/${id}`);
        const item = res.data?.item;
        if (item) {
          setForm({
            ...item,
            attendance_date: item.attendance_date ? item.attendance_date.slice(0, 10) : ''
          });
          setEmpQuery(item.full_name || item.emp_code || "");
        }
      } catch {
        toast.error("Failed to load attendance");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const empSearchResults = useMemo(() => {
    const q = String(empQuery || "").trim();
    if (!q || form.employee_id) return [];
    return filterAndSort(employees, {
      query: q,
      getKeys: (e) => [e.emp_code, e.full_name],
    }).slice(0, 10);
  }, [empQuery, employees, form.employee_id]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    setLoading(true);
    try {
      await api.post('/hr/attendance', form);
      toast.success(isEdit ? "Attendance updated" : "Attendance marked");
      navigate('/human-resources/attendance');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Attendance' : 'New Attendance Entry'}</h1>
        <Link to="/human-resources/attendance" className="btn-secondary">Back</Link>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="relative">
            <label className="label font-semibold">Employee (Code or Name) *</label>
            <input 
              className="input" 
              placeholder="Search employee..."
              value={empQuery} 
              onChange={(e) => {
                setEmpQuery(e.target.value);
                if (form.employee_id) update('employee_id', '');
              }}
              required 
            />
            {empSearchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl max-h-60 overflow-auto">
                {empSearchResults.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-600 border-b last:border-0 border-slate-100 dark:border-slate-600"
                    onClick={() => {
                      update('employee_id', e.id);
                      setEmpQuery(`${e.emp_code} - ${e.full_name}`);
                    }}
                  >
                    <div className="font-bold text-brand">{e.emp_code}</div>
                    <div className="text-sm">{e.full_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label font-semibold">Date *</label>
              <input className="input" type="date" value={form.attendance_date} onChange={(e) => update('attendance_date', e.target.value)} required />
            </div>
            <div>
              <label className="label font-semibold">Status</label>
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link to="/human-resources/attendance" className="btn-secondary">Cancel</Link>
          <button className="btn-primary px-8" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  );
}







