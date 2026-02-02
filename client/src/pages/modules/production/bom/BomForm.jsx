import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';

export default function BomForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get('mode');
  const readOnly = mode === 'view';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', product: '', version: 'v1', active: true, lines: [{ component: '', qty: 1 }] });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ code: 'BOM-001', product: 'Finished Good A', version: 'v1', active: true, lines: [{ component: 'Raw Material X', qty: 2 }] });
      setLoading(false);
    }, 150);
  }, [isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  function updateLine(idx, name, value) {
    setForm((p) => {
      const next = [...p.lines];
      next[idx] = { ...next[idx], [name]: value };
      return { ...p, lines: next };
    });
  }

  function addLine() {
    setForm((p) => ({ ...p, lines: [...p.lines, { component: '', qty: 1 }] }));
  }

  function removeLine(idx) {
    setForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate('/production/bom');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/production/bom" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to BOM</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{readOnly ? 'View BOM' : isEdit ? 'Edit BOM' : 'New BOM'}</h1>
      </div>

      <form onSubmit={submit}>
        <div className="card"><div className="card-body space-y-4">
          <fieldset disabled={readOnly}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="Auto" /></div>
              <div><label className="label">Product *</label><input className="input" value={form.product} onChange={(e) => update('product', e.target.value)} required /></div>
              <div><label className="label">Version</label><input className="input" value={form.version} onChange={(e) => update('version', e.target.value)} /></div>
              <div><label className="label">Status</label><select className="input" value={form.active ? '1' : '0'} onChange={(e) => update('active', e.target.value === '1')}><option value="1">Active</option><option value="0">Inactive</option></select></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Components</div>
                <button type="button" className="btn-success" onClick={addLine} disabled={readOnly}>+ Add</button>
              </div>
              <div className="space-y-2">
                {form.lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-8"><input className="input" placeholder="Component" value={l.component} onChange={(e) => updateLine(idx, 'component', e.target.value)} /></div>
                    <div className="md:col-span-3"><input className="input" type="number" min="0" step="0.01" placeholder="Qty" value={l.qty} onChange={(e) => updateLine(idx, 'qty', Number(e.target.value))} /></div>
                    <div className="md:col-span-1 flex md:justify-end"><button type="button" className="btn-success" onClick={() => removeLine(idx)} disabled={readOnly || form.lines.length <= 1}>×</button></div>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3">
            <Link to="/production/bom" className="btn-success">Cancel</Link>
            <button className="btn-success" disabled={loading || readOnly}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </div></div>
      </form>
    </div>
  );
}







