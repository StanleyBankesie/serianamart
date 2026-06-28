/**
 * @fileoverview JobCardExecution component.
 * Provides functionality for JobCardExecution.
 */

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  Cpu,
  Clock,
  Activity,
  CheckCircle2,
  Timer
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function JobCardExecution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  const [formData, setFormData] = useState({
    machine_id: "",
    shift_id: "",
    actual_qty: 0,
    status: "PENDING",
    start_time: null,
    end_time: null
  });

  const [jobDetails, setJobDetails] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [macRes, shiftRes, jcRes] = await Promise.all([
          api.get("/production/setup/machines"),
          api.get("/production/setup/shifts"),
          api.get(`/production/execution/job-cards/${id}`)
        ]);
        
        setMachines(macRes.data?.items || []);
        setShifts(shiftRes.data?.items || []);
        
        const jc = jcRes.data;
        setJobDetails(jc);
        setFormData({
          machine_id: jc.machine_id || "",
          shift_id: jc.shift_id || "",
          actual_qty: jc.actual_qty || 0,
          status: jc.status,
          start_time: jc.start_time,
          end_time: jc.end_time
        });
        
        setLoading(false);
      } catch (error) {
        toast.error("Failed to load job details");
      }
    };
    fetchData();
  }, [id]);

  const handleStatusChange = (newStatus) => {
    const update = { status: newStatus };
    if (newStatus === 'IN_PROGRESS' && !formData.start_time) {
      update.start_time = new Date().toISOString();
    }
    if (newStatus === 'COMPLETED') {
      update.end_time = new Date().toISOString();
      update.actual_qty = jobDetails.planned_qty;
    }
    setFormData({...formData, ...update});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/production/execution/job-cards/${id}`, formData);
      toast.success("Task updated");
      navigate("/production/execution/job-cards");
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-400 text-xl">Loading Execution Environment...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/production/execution/job-cards" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job Card Execution</h1>
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{jobDetails.process_name}</p>
          </div>
        </div>
        <button 
          form="execution-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-xl font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          Update Progress
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{jobDetails.item_name}</h2>
                <p className="text-sm font-mono text-slate-500">{jobDetails.item_code}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Target Qty</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{jobDetails.planned_qty}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button 
                type="button" 
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all 
                  ${formData.status === 'IN_PROGRESS' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}
              >
                <Timer size={24} />
                <span className="font-bold">Start / Resume</span>
              </button>
              <button 
                type="button" 
                onClick={() => handleStatusChange('COMPLETED')}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all 
                  ${formData.status === 'COMPLETED' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50'}`}
              >
                <CheckCircle2 size={24} />
                <span className="font-bold">Complete</span>
              </button>
            </div>
          </div>

          <form id="execution-form" onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Cpu size={16} /> Assign Machine
                </label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none"
                  value={formData.machine_id}
                  onChange={e => setFormData({...formData, machine_id: e.target.value})}
                >
                  <option value="">No Machine</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.machine_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Clock size={16} /> Active Shift
                </label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none"
                  value={formData.shift_id}
                  onChange={e => setFormData({...formData, shift_id: e.target.value})}
                >
                  <option value="">No Shift</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.shift_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <div className="flex justify-between items-end">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Actual Produced Quantity</label>
                <span className="text-xs font-bold text-indigo-600">{formData.actual_qty} Finished</span>
              </div>
              <input 
                type="number" 
                step="0.001"
                className="w-full px-6 py-4 bg-slate-900 text-white border-none rounded-2xl text-2xl font-black focus:ring-4 focus:ring-indigo-500/20 outline-none text-center"
                value={formData.actual_qty}
                onChange={e => setFormData({...formData, actual_qty: e.target.value})}
              />
              <div className="flex gap-2 justify-center">
                {[0.25, 0.5, 1].map(mult => (
                  <button 
                    key={mult}
                    type="button" 
                    onClick={() => setFormData({...formData, actual_qty: Number(jobDetails.planned_qty * mult)})}
                    className="text-[10px] font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {mult * 100}%
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-100 dark:shadow-none space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Activity size={18} /> Performance
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-200">Start Time</p>
                <p className="font-mono text-sm">{formData.start_time ? new Date(formData.start_time).toLocaleTimeString() : 'Not started'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-200">End Time</p>
                <p className="font-mono text-sm">{formData.end_time ? new Date(formData.end_time).toLocaleTimeString() : 'In progress'}</p>
              </div>
              <div className="pt-2 border-t border-indigo-500">
                <p className="text-[10px] uppercase font-bold text-indigo-200">Execution Status</p>
                <p className="text-lg font-black tracking-wider">{formData.status}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4 text-xs">
            <h4 className="font-bold text-slate-400 uppercase tracking-widest">Routing Context</h4>
            <div className="space-y-2">
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border-l-4 border-indigo-500">
                <p className="font-bold text-slate-700 dark:text-slate-300">{jobDetails.process_name}</p>
                <p className="text-[10px] text-slate-500">Current Step</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
