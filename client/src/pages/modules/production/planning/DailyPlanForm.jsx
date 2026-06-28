/**
 * @fileoverview DailyPlanForm component.
 * Provides functionality for DailyPlanForm.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar,
  ClipboardList,
  ChevronDown
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DailyPlanForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  
  const [formData, setFormData] = useState({
    plan_date: new Date().toISOString().split('T')[0],
    remarks: "",
    status: "DRAFT",
    items: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, bomsRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/production/boms")
        ]);
        setItems(itemsRes.data?.items || []);
        setBoms(bomsRes.data?.items || []);

        if (id) {
          const res = await api.get(`/production/planning/daily/${id}`);
          const plan = res.data;
          plan.plan_date = new Date(plan.plan_date).toISOString().split('T')[0];
          setFormData(plan);
          setLoading(false);
        }
      } catch (error) {
        toast.error("Failed to load dependency data");
      }
    };
    fetchData();
  }, [id]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: "", bom_id: "", qty_to_produce: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Auto-select BOM if item changed
    if (field === 'item_id') {
      const itemBoms = boms.filter(b => b.item_id == value);
      if (itemBoms.length > 0) {
        newItems[index].bom_id = itemBoms[0].id;
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return toast.error("Add at least one item to the plan");
    
    setSaving(true);
    try {
      if (id) {
        await api.put(`/production/planning/daily/${id}`, formData);
        toast.success("Plan updated");
      } else {
        await api.post("/production/planning/daily", formData);
        toast.success("Plan created");
      }
      navigate("/production/planning/daily");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Plan...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/planning/daily" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {id ? `Edit Plan: ${formData.plan_no}` : 'New Daily Production Plan'}
          </h1>
        </div>
        <div className="flex gap-3">
          {id && (
            <select 
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="RELEASED">RELEASED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          )}
          <button 
            form="plan-form"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Save Plan
          </button>
        </div>
      </div>

      <form id="plan-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-500" /> Plan Date
            </label>
            <input 
              type="date" 
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              value={formData.plan_date}
              onChange={e => setFormData({...formData, plan_date: e.target.value})}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Remarks / Instructions</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.remarks}
              onChange={e => setFormData({...formData, remarks: e.target.value})}
              placeholder="Internal notes for this production run..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList size={20} className="text-indigo-500" />
              Scheduled Items
            </h2>
            <button 
              type="button" 
              onClick={addItem}
              className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div 
                key={index} 
                className="group grid grid-cols-1 md:grid-cols-12 gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 transition-all"
              >
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Select Item</label>
                  <div className="relative">
                    <select 
                      required
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-sm font-bold"
                      value={item.item_id}
                      onChange={e => updateItem(index, 'item_id', e.target.value)}
                    >
                      <option value="">Select Item...</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.item_name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill of Materials (BOM)</label>
                  <div className="relative">
                    <select 
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-sm font-bold"
                      value={item.bom_id}
                      onChange={e => updateItem(index, 'bom_id', e.target.value)}
                    >
                      <option value="">No BOM</option>
                      {boms.filter(b => b.item_id == item.item_id).map(b => (
                        <option key={b.id} value={b.id}>{b.bom_name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Target Qty</label>
                  <input 
                    type="number" 
                    step="0.001"
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                    value={item.qty_to_produce}
                    onChange={e => updateItem(index, 'qty_to_produce', e.target.value)}
                  />
                </div>

                <div className="md:col-span-1 flex items-end justify-end pb-2">
                  <button 
                    type="button" 
                    onClick={() => removeItem(index)}
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {formData.items.length === 0 && (
              <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400">
                <p>No items scheduled for this date. Click "Add Item" to plan production.</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
