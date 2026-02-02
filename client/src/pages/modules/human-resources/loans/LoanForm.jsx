import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function LoanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ employee: '', amount: 0, status: 'ACTIVE' });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ employee: 'John Doe', amount: 1000, status: 'ACTIVE' });
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
      navigate('/human-resources/loans');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">{isEdit ? 'Edit Loan' : 'New Loan'}</h1></div>
        <Link to="/human-resources/loans" className="btn-success">Back</Link>
      </div></div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Employee *</label><input className="input" value={form.employee} onChange={(e) => update('employee', e.target.value)} required /></div>
            <div><label className="label">Amount</label><input className="input" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update('amount', Number(e.target.value))} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option></select></div>
          </div>
          <div className="flex justify-end gap-3"><Link to="/human-resources/loans" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







