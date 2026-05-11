import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  ClipboardList, 
  Layers,
  ChevronRight,
  Loader2,
  Calendar,
  Warehouse,
  Play,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [formData, setFormData] = useState({
    work_order_no: "",
    work_order_date: new Date().toISOString().split('T')[0],
    bom_id: "",
    qty_to_produce: 1,
    warehouse_id: "",
    remarks: "",
    items: [] // For components
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bomsRes, whRes, woRes] = await Promise.all([
          api.get("/production/boms"),
          api.get("/inventory/warehouses"),
          isEdit ? api.get(`/production/work-orders/${id}`) : Promise.resolve({ data: null })
        ]);
        
        setBoms(bomsRes.data?.items || []);
        setWarehouses(whRes.data?.items || []);
        
        if (woRes.data?.item) {
          const item = woRes.data.item;
          setFormData({
            work_order_no: item.work_order_no,
            work_order_date: item.work_order_date.split('T')[0],
            bom_id: item.bom_id,
            qty_to_produce: item.qty_to_produce,
            warehouse_id: item.warehouse_id || "",
            remarks: item.remarks || "",
            status: item.status,
            items: item.items || []
          });
        }
      } catch (error) {
        toast.error("Failed to load data");
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleBomChange = async (bomId) => {
    if (!bomId) {
      setFormData(prev => ({ ...prev, bom_id: "", items: [] }));
      return;
    }
    
    try {
      const res = await api.get(`/production/boms/${bomId}`);
      const bom = res.data?.item;
      if (bom) {
        const ratio = formData.qty_to_produce / (bom.output_qty || 1);
        setFormData(prev => ({
          ...prev,
          bom_id: bomId,
          items: bom.components.map(c => ({
            item_id: c.item_id,
            item_name: c.item_name,
            item_code: c.item_code,
            planned_qty: c.qty * ratio,
            actual_qty: c.qty * ratio,
            uom: c.uom
          }))
        }));
      }
    } catch (error) {
      toast.error("Failed to load BOM components");
    }
  };

  const updateActualQty = (index, val) => {
    const nextItems = [...formData.items];
    nextItems[index].actual_qty = Number(val);
    setFormData(prev => ({ ...prev, items: nextItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        // Status updates are handled by a separate button for production flow
        toast.info("Use the status action buttons to update the work order");
      } else {
        await api.post("/production/work-orders", formData);
        toast.success("Work Order created successfully");
        navigate("/production/work-orders");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save Work Order");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'COMPLETED' && !window.confirm("Completing this order will deduct materials from stock and add finished goods. Proceed?")) return;
    
    setLoading(true);
    try {
      await api.put(`/production/work-orders/${id}/status`, { 
        status: newStatus,
        actual_items: formData.items 
      });
      toast.success(`Work Order marked as ${newStatus}`);
      navigate("/production/work-orders");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/production/work-orders")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Work Orders</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>Production</span>
          <ChevronRight size={14} />
          <span>Work Order</span>
          <ChevronRight size={14} />
          <span className="text-slate-900 dark:text-slate-200">{isEdit ? 'Details' : 'New'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none">
                  <ClipboardList className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {isEdit ? `Order: ${formData.work_order_no}` : 'New Production Order'}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      formData.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      formData.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {formData.status || 'DRAFT'}
                    </span>
                    {isEdit && <span className="text-slate-400 text-xs font-medium">• {formData.work_order_date}</span>}
                  </div>
                </div>
              </div>

              {isEdit && formData.status !== 'COMPLETED' && (
                <div className="flex gap-2 w-full md:w-auto">
                  {formData.status === 'DRAFT' && (
                    <button 
                      type="button"
                      onClick={() => handleStatusChange('IN_PROGRESS')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all"
                    >
                      <Play size={18} />
                      Start Production
                    </button>
                  )}
                  {formData.status === 'IN_PROGRESS' && (
                    <button 
                      type="button"
                      onClick={() => handleStatusChange('COMPLETED')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                    >
                      <CheckCircle2 size={18} />
                      Complete & Update Stock
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-500" />
                  Order Number
                </label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                  value={formData.work_order_no}
                  onChange={(e) => setFormData({ ...formData, work_order_no: e.target.value })}
                  disabled={isEdit}
                  placeholder="AUTO-GENERATED"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Layers size={16} className="text-emerald-500" />
                  Select BOM
                </label>
                <select 
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={formData.bom_id}
                  onChange={(e) => handleBomChange(e.target.value)}
                  disabled={isEdit}
                  required
                >
                  <option value="">Select a recipe...</option>
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.bom_name} ({b.item_name})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target Qty</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                  value={formData.qty_to_produce}
                  onChange={(e) => setFormData({ ...formData, qty_to_produce: e.target.value })}
                  disabled={isEdit}
                  min="0.001"
                  step="any"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Warehouse size={16} className="text-emerald-500" />
                  Source Warehouse
                </label>
                <select 
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  disabled={isEdit}
                  required
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              Material Requirements
              {formData.status === 'IN_PROGRESS' && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Adjust actual usage before completion
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{item.item_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.item_code}</div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Planned</div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {Number(item.planned_qty).toLocaleString()} {item.uom}
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="text-[10px] font-bold text-slate-400 uppercase ml-1">Actual Usage</div>
                      <input 
                        type="number" 
                        className={`w-full px-3 py-1.5 rounded-lg border focus:ring-2 outline-none text-sm font-bold transition-all ${
                          formData.status === 'IN_PROGRESS' 
                            ? 'bg-white dark:bg-slate-800 border-amber-200 focus:ring-amber-500' 
                            : 'bg-slate-100 dark:bg-slate-800 border-transparent cursor-not-allowed text-slate-500'
                        }`}
                        value={item.actual_qty}
                        onChange={(e) => updateActualQty(index, e.target.value)}
                        disabled={formData.status !== 'IN_PROGRESS'}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {formData.items.length === 0 && (
                <div className="py-12 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                  Select a BOM to see material requirements
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
            {!isEdit && (
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => navigate("/production/work-orders")}
                  className="px-6 py-3 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Create Work Order
                </button>
              </div>
            )}
            {isEdit && (
              <div className="text-center text-xs text-slate-400 font-medium italic">
                {formData.status === 'COMPLETED' 
                  ? "This order is finalized and inventory has been updated." 
                  : "Update actual usage above before completing the order."}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
