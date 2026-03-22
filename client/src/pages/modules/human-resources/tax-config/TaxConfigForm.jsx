import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function TaxConfigForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    tax_name: '', 
    tax_type: 'INCOME_TAX', 
    min_amount: 0, 
    max_amount: '', 
    tax_rate: 0, 
    fixed_amount: 0, 
    is_active: true 
  });

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/tax-configs");
        const item = res.data.items.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            max_amount: item.max_amount || '',
            is_active: !!item.is_active
          });
        }
      } catch {
        toast.error("Failed to load tax config");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/hr/tax-configs', form);
      toast.success(isEdit ? "Updated successfully" : "Created successfully");
      navigate('/human-resources/tax-config');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Tax Config' : 'New Tax Config'}</h1>
          <Link to="/human-resources/tax-config" className="btn-secondary">Back</Link>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Tax Name *</label>
              <input 
                className="input" 
                value={form.tax_name} 
                onChange={(e) => update('tax_name', e.target.value)} 
                required 
                placeholder="e.g. Income Tax Bracket 1"
              />
            </div>
            <div>
              <label className="label">Tax Type *</label>
              <select 
                className="input" 
                value={form.tax_type} 
                onChange={(e) => update('tax_type', e.target.value)}
                required
              >
                <option value="INCOME_TAX">Income Tax</option>
                <option value="SOCIAL_SECURITY">Social Security</option>
                <option value="OTHER">Other Deduction</option>
              </select>
            </div>
            <div>
              <label className="label">Min Amount *</label>
              <input 
                className="input" 
                type="number"
                step="0.01"
                value={form.min_amount} 
                onChange={(e) => update('min_amount', e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="label">Max Amount (Optional)</label>
              <input 
                className="input" 
                type="number"
                step="0.01"
                value={form.max_amount} 
                onChange={(e) => update('max_amount', e.target.value)} 
                placeholder="Leave blank for no upper limit"
              />
            </div>
            <div>
              <label className="label">Tax Rate (%) *</label>
              <input 
                className="input" 
                type="number"
                step="0.01"
                value={form.tax_rate} 
                onChange={(e) => update('tax_rate', e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="label">Fixed Amount</label>
              <input 
                className="input" 
                type="number"
                step="0.01"
                value={form.fixed_amount} 
                onChange={(e) => update('fixed_amount', e.target.value)} 
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select 
                className="input" 
                value={form.is_active ? '1' : '0'} 
                onChange={(e) => update('is_active', e.target.value === '1')}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link to="/human-resources/tax-config" className="btn-secondary">Cancel</Link>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}







