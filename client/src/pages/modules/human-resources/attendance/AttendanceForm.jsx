import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function AttendanceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ empNo: '', date: new Date().toISOString().split('T')[0], status: 'PRESENT' });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ empNo: 'EMP-001', date: '2025-01-02', status: 'PRESENT' });
      setLoading(false);
    }, 150);
  }, [isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate('/human-resources/attendance');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">{isEdit ? 'Edit Attendance' : 'New Attendance'}</h1>
            <p className="text-sm mt-1">Attendance entry</p>
          </div>
          <Link to="/human-resources/attendance" className="btn-success">Back</Link>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Employee No *</label>
                <input className="input" value={form.empNo} onChange={(e) => update('empNo', e.target.value)} required />
              </div>
              <div>
                <label className="label">Date *</label>
                <input className="input" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LEAVE">Leave</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to="/human-resources/attendance" className="btn-success">Cancel</Link>
              <button className="btn-success" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







