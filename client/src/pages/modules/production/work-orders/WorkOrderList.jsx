/**
 * @fileoverview WorkOrderList component.
 * Provides functionality for WorkOrderList.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Filter
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

const StatusBadge = ({ status }) => {
  const styles = {
    DRAFT: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-rose-100 text-rose-700"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[status] || styles.DRAFT}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function WorkOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await api.get("/production/work-orders");
      setOrders(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to fetch work orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const searchFilteredOrders = orders.filter(o => 
    String(o.work_order_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(o.bom_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(o.item_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: filteredOrders, sortKey, sortDir, toggle } = useSort(searchFilteredOrders, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Orders</h1>
            <p className="text-slate-500 text-sm">Execution and tracking of manufacturing runs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search orders..."
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/production/work-orders/new" 
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            New Order
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Order No" sortKey="work_order_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Product / BOM" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Target Qty" sortKey="qty_to_produce" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <SortableHeader label="Date" sortKey="work_order_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Orders...</td>
                </tr>
              ) : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                <tr key={order.id} className="group">
                  <td className="px-6 py-4 font-bold text-brand-600 dark:text-brand-400">
                    {order.work_order_no}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-brand-700 dark:text-brand-300">{order.item_name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-0.5">
                      <ClipboardList size={10} />
                      {order.bom_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-bold text-slate-900 dark:text-white px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg inline-block">
                      {Number(order.qty_to_produce).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-500 font-medium">{new Date(order.work_order_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link 
                        to={`/production/work-orders/${order.id}`}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <ClipboardList size={48} className="opacity-20" />
                      <p className="font-medium">No production orders found</p>
                      <Link to="/production/work-orders/new" className="btn-success btn-sm">Issue first order</Link>
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
