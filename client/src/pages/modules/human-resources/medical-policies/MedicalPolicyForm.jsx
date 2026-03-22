import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function MedicalPolicyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    policy_code: '',
    policy_name: '',
    provider: '',
    description: '',
    coverage_details: '',
    premium_amount: 0,
    renewal_date: '',
    is_active: true
  });

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hr/medical-policies/${id}`);
        const item = res.data.item;
        setForm({
          ...item,
          renewal_date: item.renewal_date ? item.renewal_date.slice(0, 10) : '',
          is_active: !!item.is_active
        });
      } catch {
        toast.error("Failed to load policy");
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
      await api.post('/hr/medical-policies', form);
      toast.success(isEdit ? "Policy updated" : "Policy created");
      navigate('/human-resources/medical-policies');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Medical Policy' : 'New Medical Policy'}</h1>
        <Link to="/human-resources/medical-policies" className="btn-secondary">Back</Link>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Policy Code *</label>
            <input 
              className="input" 
              value={form.policy_code} 
              onChange={(e) => update('policy_code', e.target.value)} 
              required 
              placeholder="e.g. MP-001"
            />
          </div>
          <div>
            <label className="label">Policy Name *</label>
            <input 
              className="input" 
              value={form.policy_name} 
              onChange={(e) => update('policy_name', e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Provider *</label>
            <input 
              className="input" 
              value={form.provider} 
              onChange={(e) => update('provider', e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="label">Renewal Date</label>
            <input 
              className="input" 
              type="date" 
              value={form.renewal_date} 
              onChange={(e) => update('renewal_date', e.target.value)} 
            />
          </div>
          <div>
            <label className="label">Premium Amount</label>
            <input 
              className="input" 
              type="number" 
              step="0.01"
              value={form.premium_amount} 
              onChange={(e) => update('premium_amount', e.target.value)} 
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

        <div>
          <label className="label">Description</label>
          <textarea 
            className="input h-24" 
            value={form.description || ''} 
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Coverage Details</label>
          <textarea 
            className="input h-32" 
            value={form.coverage_details || ''} 
            onChange={(e) => update('coverage_details', e.target.value)}
            placeholder="List covered services, limits, etc."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/human-resources/medical-policies" className="btn-secondary">Cancel</Link>
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}







