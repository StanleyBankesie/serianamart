/**
 * @fileoverview RoutingList component.
 * Provides functionality for RoutingList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Search, 
  Loader2,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  FileText
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RoutingList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const fetchRoutings = async () => {
    try {
      const res = await api.get("/production/routings");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load routings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutings();
  }, []);

  const searchFilteredItems = items.filter(item => 
    item.routing_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: filteredItems, sortKey, sortDir, toggle } = useSort(searchFilteredItems, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Routing Setups</h1>
            <p className="text-slate-500 text-sm">Define process sequences for manufactured items</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchRoutings}
            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
            title="Refresh"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <Link 
            to="/production/routings/new"
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            Create Routing
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-md">
        <Search size={20} className="text-slate-400" />
        <input 
          type="text" 
          placeholder="Search routings, items..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 font-medium py-2"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Routing Name" sortKey="routing_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Target Item" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="is_default" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Routings...</td>
                </tr>
              ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <FileText size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300">{item.routing_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-brand-600">{item.item_name}</div>
                    <div className="text-xs text-slate-400 font-mono font-bold tracking-tight">{item.item_code}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.is_default ? (
                      <span className="badge badge-success">Default</span>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => navigate(`/production/routings/edit/${item.id}`)}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileText size={48} className="opacity-20" />
                      <p className="font-medium">No routings found</p>
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
