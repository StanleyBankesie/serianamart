import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function ReportForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', module: 'Sales', query: '', active: true });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ name: 'Sales Summary', module: 'Sales', query: 'SELECT ...', active: true });
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
      navigate('/business-intelligence/reports');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/business-intelligence/reports" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to Reports</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{isEdit ? 'Edit Report' : 'New Report'}</h1>
      </div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
            <div><label className="label">Module</label><select className="input" value={form.module} onChange={(e) => update('module', e.target.value)}><option value="Sales">Sales</option><option value="Finance">Finance</option><option value="Inventory">Inventory</option></select></div>
            <div className="md:col-span-2"><label className="label">Query/Definition</label><input className="input" value={form.query} onChange={(e) => update('query', e.target.value)} placeholder="Placeholder" /></div>
            <div><label className="label">Status</label><select className="input" value={form.active ? '1' : '0'} onChange={(e) => update('active', e.target.value === '1')}><option value="1">Active</option><option value="0">Inactive</option></select></div>
          </div>
          <div className="flex justify-end gap-3"><Link to="/business-intelligence/reports" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







