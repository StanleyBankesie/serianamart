import React, { useState, useEffect } from "react";
import { 
  Play, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  Cpu,
  Clock,
  ChevronRight,
  Filter,
  Zap
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function JobCardList() {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [jcRes, planRes] = await Promise.all([
        api.get("/production/execution/job-cards"),
        api.get("/production/planning/daily")
      ]);
      setItems(jcRes.data?.items || []);
      setPlans(planRes.data?.items || []);
    } catch (error) {
      toast.error("Failed to load job cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    if (!selectedPlanId) return toast.error("Select a plan first");
    setGenerating(true);
    try {
      await api.post("/production/execution/job-cards/generate", { plan_id: selectedPlanId });
      toast.success("Job cards generated successfully");
      setShowGenModal(false);
      fetchData();
    } catch (error) {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const filteredItems = items.filter(r => 
    String(r.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.process_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.machine_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: filtered, sortKey, sortDir, toggle } = useSort(filteredItems, "item_name", "asc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Job Cards & Execution</h1>
            <p className="text-slate-500 text-sm">Monitor and update real-time production tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search tasks..."
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowGenModal(true)}
            className="btn-success flex items-center gap-2"
          >
            <Zap size={20} />
            Generate from Plan
          </button>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Task / Item" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Resource" sortKey="machine_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Progress" sortKey="planned_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Syncing execution data...</td></tr>
              ) : filtered.length > 0 ? filtered.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{item.process_name}</span>
                      <span className="font-bold text-brand-700 dark:text-brand-300 text-sm">{item.item_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Cpu size={12} className="opacity-50" /> {item.machine_name || 'Unassigned'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <Clock size={10} /> {item.shift_name || 'No Shift'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.actual_qty} / {item.planned_qty}</span>
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full mt-2 overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-brand-600" 
                          style={{ width: `${Math.min(100, (item.actual_qty / item.planned_qty) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge 
                      ${item.status === 'COMPLETED' ? 'badge-success' : 
                        item.status === 'IN_PROGRESS' ? 'badge-info' : 
                        'badge-secondary'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => navigate(`/production/execution/job-cards/${item.id}`)}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Cpu size={48} className="opacity-20" />
                      <p className="font-medium">No execution tasks found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-slate-900 dark:text-white">
              <h2 className="text-xl font-bold">Generate Job Cards</h2>
              <button onClick={() => setShowGenModal(false)} className="text-2xl">&times;</button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Select Production Plan</label>
                <select 
                  className="input py-3 w-full font-bold"
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                >
                  <option value="">Choose a plan...</option>
                  {plans.filter(p => p.status !== 'CLOSED').map(p => (
                    <option key={p.id} value={p.id}>{p.plan_no} - {new Date(p.plan_date).toLocaleDateString()}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 px-1 italic">This will create execution units for all items in the plan based on their default routings.</p>
              </div>
              <div className="pt-2 flex gap-4">
                <button 
                  onClick={() => setShowGenModal(false)}
                  className="btn btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGenerate}
                  disabled={generating || !selectedPlanId}
                  className="btn-success flex-1 py-3"
                >
                  {generating && <Loader2 size={18} className="animate-spin" />}
                  Generate Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
