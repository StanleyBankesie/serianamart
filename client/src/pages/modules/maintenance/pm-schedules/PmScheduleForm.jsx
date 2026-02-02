import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';

export default function PmScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get('mode');
  const readOnly = mode === 'view';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', assetNo: 'AST-001', frequency: 'MONTHLY', active: true });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ code: 'PM-001', assetNo: 'AST-001', frequency: 'MONTHLY', active: true });
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
      navigate('/maintenance/pm-schedules');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/maintenance/pm-schedules" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to PM Schedules</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{readOnly ? 'View Schedule' : isEdit ? 'Edit Schedule' : 'New Schedule'}</h1>
      </div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <fieldset disabled={readOnly}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="Auto" /></div>
              <div><label className="label">Asset No</label><input className="input" value={form.assetNo} onChange={(e) => update('assetNo', e.target.value)} /></div>
              <div><label className="label">Frequency</label><select className="input" value={form.frequency} onChange={(e) => update('frequency', e.target.value)}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option></select></div>
              <div><label className="label">Status</label><select className="input" value={form.active ? '1' : '0'} onChange={(e) => update('active', e.target.value === '1')}><option value="1">Active</option><option value="0">Inactive</option></select></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3"><Link to="/maintenance/pm-schedules" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading || readOnly}>{loading ? 'Saving...' : 'Save'}</button></div>
        </div></div>
      </form>
    </div>
  );
}







