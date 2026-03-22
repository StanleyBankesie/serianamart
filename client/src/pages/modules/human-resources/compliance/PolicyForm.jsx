import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

export default function PolicyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    code: '', 
    title: '', 
    content: '', 
    is_active: true 
  });

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/policies");
        const item = res.data.items.find(i => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            is_active: !!item.is_active
          });
        }
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
      await api.post('/hr/policies', form);
      toast.success(isEdit ? "Policy updated" : "Policy created");
      navigate('/human-resources/policies');
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
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Policy' : 'New Policy'}</h1>
          <Link to="/human-resources/policies" className="btn-secondary">Back</Link>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Policy Code *</label>
              <input 
                className="input" 
                value={form.code} 
                onChange={(e) => update('code', e.target.value)} 
                required 
                placeholder="e.g. HR-001"
              />
            </div>
            <div>
              <label className="label">Title *</label>
              <input 
                className="input" 
                value={form.title} 
                onChange={(e) => update('title', e.target.value)} 
                required 
                placeholder="e.g. Leave Policy"
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
            <label className="label">Policy Content *</label>
            <textarea 
              className="input h-96 font-sans" 
              value={form.content || ''} 
              onChange={(e) => update('content', e.target.value)}
              required
              placeholder="Enter full policy text here..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link to="/human-resources/policies" className="btn-secondary">Cancel</Link>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </form>
      </div>
    </Guard>
  );
}
