/**
 * @fileoverview MaterialRequisitionList component.
 * Provides functionality for MaterialRequisitionList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  FileSearch,
  ChevronRight,
  ClipboardList,
  AlertCircle
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
export default function MaterialRequisitionList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const res = await api.get("/production/execution/material-requisition");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Material Requisitions</h1>
            <p className="text-slate-500 text-sm">Request raw materials from the main warehouse</p>
          </div>
        </div>
        <Link 
          to="/production/execution/material-requisition/new"
          className="btn-success flex items-center gap-2"
        >
          <Plus size={20} />
          New Requisition
        </Link>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Req No" sortKey="requisition_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Plan Association" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Date" sortKey="requisition_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Syncing requisitions...</td>
                </tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <FileSearch size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300">{item.requisition_no}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-brand-600">
                      <ClipboardList size={14} className="opacity-50" />
                      {item.plan_no || <span className="text-slate-400 italic font-medium">Direct Request</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      <Calendar size={14} className="opacity-50" />
                      {new Date(item.requisition_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge 
                      ${item.status === 'APPROVED' ? 'badge-success' : 
                        item.status === 'PENDING' ? 'badge-info' : 
                        item.status === 'FULFILLED' ? 'badge-success' :
                        'badge-secondary'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => navigate(`/production/execution/material-requisition/${item.id}`)}
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
                      <FileSearch size={48} className="opacity-20" />
                      <p className="font-medium">No material requisitions found</p>
                      <Link to="/production/execution/material-requisition/new" className="btn-success btn-sm">New requisition</Link>
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
