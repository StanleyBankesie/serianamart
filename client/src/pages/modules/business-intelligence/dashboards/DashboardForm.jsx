import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from 'api/client';

export default function DashboardForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get('mode');
  const readOnly = mode === 'view';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', active: true });
  const [summary, setSummary] = useState(null);
  const [salesSeries, setSalesSeries] = useState([]);
  const [purchaseSeries, setPurchaseSeries] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({ name: 'Executive Overview', description: 'High-level KPIs across modules', active: true });
      setLoading(false);
    }, 150);
  }, [isEdit]);

  useEffect(() => {
    if (!readOnly) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/bi/dashboards').catch(() => ({ data: {} })),
      api.get('/bi/sales-report').catch(() => ({ data: { items: [] } })),
      api.get('/bi/purchase-report').catch(() => ({ data: { items: [] } })),
      api.get('/bi/inventory-report').catch(() => ({ data: { items: [] } })),
    ])
      .then(([dashRes, salesRes, purchaseRes, invRes]) => {
        if (cancelled) return;
        const d = dashRes.data || {};
        setSummary(d.summary || null);
        setSalesSeries(Array.isArray(salesRes.data?.items) ? salesRes.data.items : []);
        setPurchaseSeries(Array.isArray(purchaseRes.data?.items) ? purchaseRes.data.items : []);
        setLowStock(Array.isArray(invRes.data?.items) ? invRes.data.items : []);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate('/business-intelligence/dashboards');
    } finally {
      setLoading(false);
    }
  }

  function fmtCurrency(n) {
    const num = Number(n || 0);
    return `₵${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function MiniBarChart({ data }) {
    const max = Math.max(1, ...data.map((d) => Number(d.total || d.count || 0)));
    return (
      <div className="flex items-end gap-1 h-24">
        {data.slice().reverse().map((d, idx) => {
          const value = Number(d.total || d.count || 0);
          const h = Math.max(4, Math.round((value / max) * 96));
          return (
            <div
              key={idx}
              className="w-3 bg-brand-500/70 rounded-t"
              style={{ height: `${h}px` }}
              title={`${d.date || ''} • ${fmtCurrency(d.total || 0)} • ${d.count || 0}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/business-intelligence/dashboards" className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">← Back to Dashboards</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{readOnly ? 'Executive Overview' : isEdit ? 'Edit Dashboard' : 'New Dashboard'}</h1>
      </div>

      {readOnly ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-500">Sales (30 days)</div>
              <div className="text-2xl font-bold mt-2">{fmtCurrency(summary?.sales?.total || 0)}</div>
              <div className="text-xs mt-1">{summary?.sales?.documents || 0} documents</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-500">Purchases (30 days)</div>
              <div className="text-2xl font-bold mt-2">{fmtCurrency(summary?.purchase?.total || 0)}</div>
              <div className="text-xs mt-1">{summary?.purchase?.documents || 0} orders</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-500">Inventory Items</div>
              <div className="text-2xl font-bold mt-2">{Number(summary?.inventory?.items || 0).toLocaleString()}</div>
              <div className="text-xs mt-1">{Number(summary?.inventory?.quantity || 0).toLocaleString()} units</div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-500">Active Employees</div>
              <div className="text-2xl font-bold mt-2">{Number(summary?.hr?.employees || 0).toLocaleString()}</div>
              <div className="text-xs mt-1">HR status</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card"><div className="card-header bg-slate-50 rounded-t-lg"><div>
              <div className="text-lg font-semibold">Sales Trend</div>
              <div className="text-xs text-slate-500">Last 30 days</div>
            </div></div><div className="card-body">
              <MiniBarChart data={salesSeries} />
              <div className="mt-3 text-xs text-slate-500">Bars show totals by day</div>
            </div></div>

            <div className="card"><div className="card-header bg-slate-50 rounded-t-lg"><div>
              <div className="text-lg font-semibold">Purchase Trend</div>
              <div className="text-xs text-slate-500">Last 30 days</div>
            </div></div><div className="card-body">
              <MiniBarChart data={purchaseSeries} />
              <div className="mt-3 text-xs text-slate-500">Bars show totals by day</div>
            </div></div>
          </div>

          <div className="card">
            <div className="card-header bg-slate-50 rounded-t-lg">
              <div className="text-lg font-semibold">Low Stock Watchlist</div>
              <div className="text-xs text-slate-500">Least available items</div>
            </div>
            <div className="card-body overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Name</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Reorder</th>
                    <th className="text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((r, idx) => (
                    <tr key={idx}>
                      <td className="font-medium">{r.item_code}</td>
                      <td>{r.item_name}</td>
                      <td className="text-right">{Number(r.qty || 0).toLocaleString()}</td>
                      <td className="text-right">{Number(r.reorder_level || 0).toLocaleString()}</td>
                      <td className="text-right">{Number(r.max_stock_level || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {lowStock.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-slate-500 text-sm">No low stock items</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="card"><div className="card-body space-y-4">
            <fieldset disabled={readOnly}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
                <div><label className="label">Status</label><select className="input" value={form.active ? '1' : '0'} onChange={(e) => update('active', e.target.value === '1')}><option value="1">Active</option><option value="0">Inactive</option></select></div>
                <div className="md:col-span-2"><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} /></div>
              </div>
            </fieldset>
            <div className="flex justify-end gap-3"><Link to="/business-intelligence/dashboards" className="btn-success">Cancel</Link><button className="btn-success" disabled={loading || readOnly}>{loading ? 'Saving...' : 'Save'}</button></div>
          </div></div>
        </form>
      )}
    </div>
  );
}







