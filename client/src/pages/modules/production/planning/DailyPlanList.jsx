import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  FileSpreadsheet,
  ChevronRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function DailyPlanList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPlans = async () => {
    try {
      const res = await api.get("/production/planning/daily");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load daily plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Daily Production Plans</h1>
            <p className="text-slate-500 text-sm">Schedule and track daily manufacturing targets</p>
          </div>
        </div>
        <Link 
          to="/production/planning/daily/new"
          className="btn-success flex items-center gap-2"
        >
          <Plus size={20} />
          New Daily Plan
        </Link>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Plan No" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Plan Date" sortKey="plan_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Plans...</td>
                </tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <FileSpreadsheet size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300">{item.plan_no}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Calendar size={14} className="opacity-50" />
                      {new Date(item.plan_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
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
                        onClick={() => navigate(`/production/planning/daily/edit/${item.id}`)}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileSpreadsheet size={48} className="opacity-20" />
                      <p className="font-medium">No plans found</p>
                      <Link to="/production/planning/daily/new" className="btn-success btn-sm">Create first plan</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
