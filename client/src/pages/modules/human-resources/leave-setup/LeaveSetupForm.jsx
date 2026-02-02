import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function LeaveSetupForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', daysPerYear: 0, active: true });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ code: 'ANNUAL', name: 'Annual Leave', daysPerYear: 21, active: true });
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
      navigate('/human-resources/leave-setup');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">{isEdit ? 'Edit Leave Type' : 'New Leave Type'}</h1>
            <p className="text-sm mt-1">Leave configuration</p>
          </div>
          <Link to="/human-resources/leave-setup" className="btn-success">Back</Link>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Code *</label>
                <input className="input" value={form.code} onChange={(e) => update('code', e.target.value)} required />
              </div>
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div>
                <label className="label">Days per Year</label>
                <input className="input" type="number" min="0" value={form.daysPerYear} onChange={(e) => update('daysPerYear', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.active ? '1' : '0'} onChange={(e) => update('active', e.target.value === '1')}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to="/human-resources/leave-setup" className="btn-success">Cancel</Link>
              <button className="btn-success" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







