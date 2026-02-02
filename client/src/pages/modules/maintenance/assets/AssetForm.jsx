import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';

export default function AssetForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get('mode');
  const readOnly = mode === 'view';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ assetNo: '', name: '', location: '', status: 'ACTIVE' });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ assetNo: 'AST-001', name: 'Generator', location: 'Plant 1', status: 'ACTIVE' });
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
      navigate('/maintenance/assets');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/maintenance/assets" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to Assets</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{readOnly ? 'View Asset' : isEdit ? 'Edit Asset' : 'New Asset'}</h1>
      </div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <fieldset disabled={readOnly}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Asset No</label><input className="input" value={form.assetNo} onChange={(e) => update('assetNo', e.target.value)} placeholder="Auto" /></div>
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
              <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => update('location', e.target.value)} /></div>
              <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3"><Link to="/maintenance/assets" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading || readOnly}>{loading ? 'Saving...' : 'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







