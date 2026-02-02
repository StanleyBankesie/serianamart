import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function PromotionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ employee: '', effectiveDate: new Date().toISOString().split('T')[0], from: '', to: '' });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ employee: 'John Doe', effectiveDate: '2025-01-01', from: 'Junior', to: 'Senior' });
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
      navigate('/human-resources/promotions');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">{isEdit ? 'Edit Promotion' : 'New Promotion'}</h1></div>
        <Link to="/human-resources/promotions" className="btn-success">Back</Link>
      </div></div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Employee *</label><input className="input" value={form.employee} onChange={(e) => update('employee', e.target.value)} required /></div>
            <div><label className="label">Effective Date</label><input className="input" type="date" value={form.effectiveDate} onChange={(e) => update('effectiveDate', e.target.value)} /></div>
            <div><label className="label">From</label><input className="input" value={form.from} onChange={(e) => update('from', e.target.value)} /></div>
            <div><label className="label">To</label><input className="input" value={form.to} onChange={(e) => update('to', e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-3"><Link to="/human-resources/promotions" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







