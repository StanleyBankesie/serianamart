import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar,
  Layers,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function StockJournalForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  
  const [formData, setFormData] = useState({
    plan_id: "",
    journal_date: new Date().toISOString().split('T')[0],
    remarks: "",
    items: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, plansRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/production/planning/daily")
        ]);
        setItems(itemsRes.data?.items || []);
        setPlans(plansRes.data?.items || []);
        setLoading(false);
      } catch (error) {
        toast.error("Failed to load dependency data");
      }
    };
    fetchData();
  }, []);

  const addItem = (type) => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_id: "", qty: 0, uom: "", type }]
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
    
    if (field === 'item_id') {
      const selected = items.find(i => i.id == value);
      if (selected) newItems[index].uom = selected.unit_name || "";
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return toast.error("Add at least one entry");
    
    setSaving(true);
    try {
      await api.post("/production/inventory/stock-journal", formData);
      toast.success("Stock journal posted");
      navigate("/production/inventory/journal");
    } catch (error) {
      toast.error("Failed to post journal");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Opening Journal...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/inventory/journal" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Stock Journal</h1>
        </div>
        <button 
          form="journal-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          Post Journal
        </button>
      </div>

      <form id="journal-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Associated Plan</label>
            <div className="relative">
              <select 
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold"
                value={formData.plan_id}
                onChange={e => setFormData({...formData, plan_id: e.target.value})}
              >
                <option value="">Manual / Adjustment</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.plan_no} ({new Date(p.plan_date).toLocaleDateString()})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-500" /> Posting Date
            </label>
            <input 
              type="date" 
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              value={formData.journal_date}
              onChange={e => setFormData({...formData, journal_date: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Journal Remarks</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.remarks}
              onChange={e => setFormData({...formData, remarks: e.target.value})}
              placeholder="e.g. Daily consumption log..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={20} className="text-indigo-500" />
              Journal Entries
            </h2>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => addItem('CONSUMPTION')}
                className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg transition-all"
              >
                <ArrowUpRight size={14} /> Add Consumption
              </button>
              <button 
                type="button" 
                onClick={() => addItem('PRODUCTION')}
                className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg transition-all"
              >
                <ArrowDownLeft size={14} /> Add Output
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div 
                key={index} 
                className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-5 rounded-2xl border transition-all 
                  ${item.type === 'CONSUMPTION' ? 'bg-rose-50/30 border-rose-100 dark:border-rose-900/20' : 'bg-emerald-50/30 border-emerald-100 dark:border-emerald-900/20'}`}
              >
                <div className="md:col-span-2 flex items-center">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider 
                    ${item.type === 'CONSUMPTION' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {item.type}
                  </span>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Item</label>
                  <div className="relative">
                    <select 
                      required
                      className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-sm font-bold shadow-sm"
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

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Quantity</label>
                  <input 
                    type="number" 
                    step="0.001"
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-sm"
                    value={item.qty}
                    onChange={e => updateItem(index, 'qty', e.target.value)}
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">UOM</label>
                  <input 
                    type="text" 
                    disabled
                    className="w-full px-3 py-2.5 bg-slate-100/50 dark:bg-slate-900/50 border-none rounded-xl text-sm font-medium text-slate-500"
                    value={item.uom}
                  />
                </div>

                <div className="md:col-span-1 flex items-end justify-end pb-2">
                  <button 
                    type="button" 
                    onClick={() => removeItem(index)}
                    className="p-2 text-slate-300 hover:text-rose-600 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {formData.items.length === 0 && (
              <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 font-medium">
                No entries in this journal. Use the buttons above to add Consumption or Production Output.
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
