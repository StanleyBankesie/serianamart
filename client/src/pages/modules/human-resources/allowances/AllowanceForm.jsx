import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function AllowanceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', amount: 0, active: true });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ name: 'Transport Allowance', amount: 200, active: true });
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
      navigate('/human-resources/allowances');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">{isEdit ? 'Edit Allowance' : 'New Allowance'}</h1></div>
        <Link to="/human-resources/allowances" className="btn-success">Back</Link>
      </div></div>
      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e)=>update('name',e.target.value)} required /></div>
            <div><label className="label">Amount</label><input className="input" type="number" step="0.01" min="0" value={form.amount} onChange={(e)=>update('amount',Number(e.target.value))} /></div>
            <div><label className="label">Status</label><select className="input" value={form.active?'1':'0'} onChange={(e)=>update('active',e.target.value==='1')}><option value="1">Active</option><option value="0">Inactive</option></select></div>
          </div>
          <div className="flex justify-end gap-3"><Link className="btn-success" to="/human-resources/allowances">Cancel</Link><button className="btn-success" disabled={loading}>{loading?'Saving...':'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







