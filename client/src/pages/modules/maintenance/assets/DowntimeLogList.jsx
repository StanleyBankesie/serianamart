import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Filter,
  Activity,
  Zap,
  ZapOff
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

const StatusBadge = ({ level }) => {
  const colors = {
    LOW: "bg-blue-50 text-blue-600 dark:bg-blue-900/30",
    MEDIUM: "bg-amber-50 text-amber-600 dark:bg-amber-900/30",
    HIGH: "bg-orange-50 text-orange-600 dark:bg-orange-900/30",
    CRITICAL: "bg-rose-50 text-rose-600 dark:bg-rose-900/30"
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors[level] || colors.MEDIUM}`}>
      {level} Impact
    </span>
  );
};

export default function DowntimeLogList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await api.get("/maintenance/assets/downtime");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load downtime logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const calculateDuration = (start, end) => {
    if (!end) return "Ongoing";
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/maintenance" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Downtime Tracking</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Monitor asset reliability and MTBF analytics</p>
          </div>
        </div>
        <Link 
          to="/maintenance/assets/downtime/new"
          className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all shadow-lg shadow-rose-200 dark:shadow-none font-bold"
        >
          <Plus size={20} />
          Log Incident
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-5 group">
          <div className="p-4 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
            <ZapOff size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Downtime</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{items.filter(i => !i.end_time).length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-5 group">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Repair Time</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">4.2 Hrs</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-5 group">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reliability Score</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">92%</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset & Reason</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeframe</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duration</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-20 text-center animate-pulse font-bold text-slate-400 uppercase">Analyzing downtime cycles...</td></tr>
              ) : items.length > 0 ? items.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${item.category === 'PLANNED' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'} dark:bg-opacity-10`}>
                        {item.category === 'PLANNED' ? <Calendar size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 dark:text-white">{item.asset_name}</div>
                        <div className="text-xs font-medium text-slate-500">{item.reason || "Unspecified cause"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Zap size={12} className="text-emerald-500" />
                        {new Date(item.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {item.end_time && (
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                          <ZapOff size={12} className="text-rose-400" />
                          {new Date(item.end_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="font-black text-slate-900 dark:text-white text-sm bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl">
                      {calculateDuration(item.start_time, item.end_time)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge level={item.impact_level} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center text-slate-400 font-medium">
                    Excellent! No downtime incidents recorded recently.
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
