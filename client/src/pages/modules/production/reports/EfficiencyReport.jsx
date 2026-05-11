import React, { useState, useEffect } from "react";
import { 
  BarChart3, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  Download,
  Filter,
  RefreshCcw,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function EfficiencyReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/efficiency", { params: filters });
      setData(res.data?.data || []);
    } catch (error) {
      toast.error("Failed to load efficiency data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateEfficiency = (planned, actual) => {
    if (!planned || planned == 0) return 0;
    return Math.min(Math.round((actual / planned) * 100), 100);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production/reports" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Efficiency Report</h1>
            <p className="text-slate-500 text-sm">Planned vs Actual Output Analysis</p>
          </div>
        </div>
        <button className="btn btn-secondary flex items-center gap-2">
          <Download size={18} />
          Export PDF
        </button>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <input 
            type="date" 
            className="input py-2 text-sm"
            value={filters.start_date}
            onChange={e => setFilters({...filters, start_date: e.target.value})}
          />
          <span className="text-slate-400 font-medium">to</span>
          <input 
            type="date" 
            className="input py-2 text-sm"
            value={filters.end_date}
            onChange={e => setFilters({...filters, end_date: e.target.value})}
          />
        </div>
        <button 
          onClick={fetchData}
          className="btn btn-primary flex items-center gap-2"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 space-y-2 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg. Factory Efficiency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-brand-600 dark:text-brand-400">84%</span>
            <span className="text-emerald-500 text-sm font-bold">+2.4%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-brand-600 h-full" style={{ width: '84%' }}></div>
          </div>
        </div>
        {/* Placeholder cards for visual context */}
        <div className="card p-6 space-y-2 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items Tracked</p>
          <span className="text-4xl font-black text-slate-900 dark:text-white">{data.length}</span>
        </div>
        <div className="card p-6 space-y-2 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Performer</p>
          <span className="text-lg font-bold text-emerald-600 truncate block mt-2">Aluminum Extrusion #4</span>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Item Details</th>
                <th className="text-center">Planned Qty</th>
                <th className="text-center">Actual Output</th>
                <th>Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Analyzing performance...</td>
                </tr>
              ) : data.length > 0 ? data.map((item, idx) => {
                const efficiency = calculateEfficiency(item.planned_qty, item.actual_qty);
                return (
                  <tr key={idx} className="group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-brand-700 dark:text-brand-300">{item.item_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.item_code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">{Number(item.planned_qty).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center font-bold text-brand-600 dark:text-brand-400">{Number(item.actual_qty).toLocaleString()}</td>
                    <td className="px-6 py-4 w-64">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${efficiency > 80 ? 'bg-emerald-500' : efficiency > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${efficiency}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-black w-10 text-right">{efficiency}%</span>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <AlertCircle size={48} className="opacity-20" />
                      <p className="font-medium">No production data found for the selected period.</p>
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
