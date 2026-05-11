import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical,
  Clock,
  Settings2,
  ChevronDown,
  Loader2
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function RoutingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState([]);
  const [processes, setProcesses] = useState([]);
  
  const [formData, setFormData] = useState({
    item_id: "",
    routing_name: "",
    is_default: false,
    steps: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, procRes] = await Promise.all([
          api.get("/inventory/items"),
          api.get("/production/setup/processes")
        ]);
        setItems(itemsRes.data?.items || []);
        setProcesses(procRes.data?.items || []);

        if (id) {
          const res = await api.get(`/production/routings/${id}`);
          setFormData(res.data);
          setLoading(false);
        }
      } catch (error) {
        toast.error("Failed to load dependency data");
      }
    };
    fetchData();
  }, [id]);

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { process_id: "", setup_time_mins: 0, cycle_time_mins: 0 }]
    });
  };

  const removeStep = (index) => {
    const newSteps = [...formData.steps];
    newSteps.splice(index, 1);
    setFormData({ ...formData, steps: newSteps });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index][field] = value;
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.steps.length === 0) return toast.error("Add at least one process step");
    if (formData.steps.some(s => !s.process_id)) return toast.error("All steps must have a process selected");

    setSaving(true);
    try {
      if (id) {
        await api.put(`/production/routings/${id}`, formData);
        toast.success("Routing updated");
      } else {
        await api.post("/production/routings", formData);
        toast.success("Routing created");
      }
      navigate("/production/routings");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save routing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400">Loading Routing Details...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/routings" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {id ? 'Edit Routing' : 'New Routing Setup'}
          </h1>
        </div>
        <button 
          form="routing-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {id ? 'Update Routing' : 'Create Routing'}
        </button>
      </div>

      <form id="routing-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Product / Item</label>
              <div className="relative">
                <select 
                  required
                  disabled={!!id}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none font-medium disabled:opacity-60"
                  value={formData.item_id}
                  onChange={e => setFormData({...formData, item_id: e.target.value})}
                >
                  <option value="">Select Item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.item_name} ({item.item_code})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="is_default"
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={formData.is_default}
                onChange={e => setFormData({...formData, is_default: e.target.checked})}
              />
              <label htmlFor="is_default" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Set as Default Routing for this item</label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Routing Name / Version</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-medium"
              value={formData.routing_name}
              onChange={e => setFormData({...formData, routing_name: e.target.value})}
              placeholder="e.g. Standard Assembly V1"
            />
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Use names that differentiate between variations</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 size={20} className="text-indigo-500" />
              Process Sequence
            </h2>
            <button 
              type="button" 
              onClick={addStep}
              className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus size={16} />
              Add Step
            </button>
          </div>

          <div className="space-y-3">
            {formData.steps.map((step, index) => (
              <div 
                key={index} 
                className="group flex flex-col md:flex-row items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 transition-all"
              >
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="relative flex-1 md:w-64">
                    <select 
                      required
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-sm font-bold"
                      value={step.process_id}
                      onChange={e => updateStep(index, 'process_id', e.target.value)}
                    >
                      <option value="">Select Process...</option>
                      {processes.map(p => (
                        <option key={p.id} value={p.id}>{p.process_name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1 w-full md:w-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                      <Clock size={10} /> Setup Time (Mins)
                    </label>
                    <input 
                      type="number" 
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                      value={step.setup_time_mins}
                      onChange={e => updateStep(index, 'setup_time_mins', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                      <Activity size={10} /> Cycle Time (Mins)
                    </label>
                    <input 
                      type="number" 
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                      value={step.cycle_time_mins}
                      onChange={e => updateStep(index, 'cycle_time_mins', e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => removeStep(index)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {formData.steps.length === 0 && (
              <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400">
                <p>No steps added. Build your production sequence by clicking "Add Step".</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
