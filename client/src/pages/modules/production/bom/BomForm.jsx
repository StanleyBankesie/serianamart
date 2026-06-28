/**
 * @fileoverview BomForm component.
 * Provides functionality for BomForm.
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Package, 
  Info,
  Layers,
  ChevronRight,
  Loader2
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BomForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    item_id: "",
    bom_name: "",
    output_qty: 1,
    is_active: true,
    components: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, bomRes] = await Promise.all([
          api.get("/inventory/items"),
          isEdit ? api.get(`/production/boms/${id}`) : Promise.resolve({ data: null })
        ]);
        
        setItems(itemsRes.data?.items || []);
        
        if (bomRes.data?.item) {
          const item = bomRes.data.item;
          setFormData({
            item_id: item.item_id,
            bom_name: item.bom_name,
            output_qty: item.output_qty,
            is_active: !!item.is_active,
            components: item.components.map(c => ({
              item_id: c.item_id,
              qty: c.qty,
              uom: c.uom
            }))
          });
        }
      } catch (error) {
        toast.error("Failed to load data");
      }
    };
    fetchData();
  }, [id, isEdit]);

  const addComponent = () => {
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { item_id: "", qty: 1, uom: "PCS" }]
    }));
  };

  const removeComponent = (index) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const updateComponent = (index, field, value) => {
    const newComponents = [...formData.components];
    newComponents[index][field] = value;
    
    // Auto-update UOM if item changes
    if (field === "item_id") {
      const selectedItem = items.find(i => String(i.id) === String(value));
      if (selectedItem) newComponents[index].uom = selectedItem.uom || "PCS";
    }
    
    setFormData(prev => ({ ...prev, components: newComponents }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_id || !formData.bom_name || formData.components.length === 0) {
      toast.warning("Please fill all required fields and add at least one component");
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/production/boms/${id}`, formData);
        toast.success("BOM updated successfully");
      } else {
        await api.post("/production/boms", formData);
        toast.success("BOM created successfully");
      }
      navigate("/production/boms");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save BOM");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/production/boms")}
            className="btn btn-secondary p-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">{isEdit ? 'Edit Product Recipe' : 'New Product Recipe'}</h1>
            <p className="text-slate-500 text-sm">Define structural bill of materials and output targets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Production</span>
          <ChevronRight size={12} />
          <span>BOM</span>
          <ChevronRight size={12} />
          <span className="text-brand-600">{isEdit ? 'Edit' : 'New'}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card p-0 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2 lg:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-tight">
                  <Package size={16} className="text-brand-600" />
                  Finished Product *
                </label>
                <select 
                  className="input py-3 w-full"
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  required
                >
                  <option value="">Select an item...</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 lg:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-tight">
                  <Info size={16} className="text-brand-600" />
                  BOM Name *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Standard Recipe v1"
                  className="input py-3 w-full"
                  value={formData.bom_name}
                  onChange={(e) => setFormData({ ...formData, bom_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 lg:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                  Target Output Qty
                </label>
                <input 
                  type="number" 
                  className="input py-3 w-full font-bold text-brand-600"
                  value={formData.output_qty}
                  onChange={(e) => setFormData({ ...formData, output_qty: e.target.value })}
                  min="0.001"
                  step="any"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-brand-900 dark:text-brand-300">Components & Materials</h2>
                <p className="text-slate-500 text-xs mt-1">Raw materials and sub-assemblies required for this output</p>
              </div>
              <button 
                type="button"
                onClick={addComponent}
                className="btn btn-secondary flex items-center gap-2 text-sm"
              >
                <Plus size={18} />
                Add Component
              </button>
            </div>

            <div className="space-y-4">
              {formData.components.map((comp, index) => (
                <div 
                  key={index} 
                  className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 group transition-all hover:shadow-sm"
                >
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Material</label>
                    <select 
                      className="input py-2.5 w-full bg-white dark:bg-slate-800"
                      value={comp.item_id}
                      onChange={(e) => updateComponent(index, "item_id", e.target.value)}
                      required
                    >
                      <option value="">Select Material...</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-36 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                    <input 
                      type="number" 
                      className="input py-2.5 w-full font-bold text-brand-700"
                      value={comp.qty}
                      onChange={(e) => updateComponent(index, "qty", e.target.value)}
                      min="0.001"
                      step="any"
                      required
                    />
                  </div>
                  <div className="w-full md:w-28 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UOM</label>
                    <div className="input py-2.5 w-full bg-slate-100/50 dark:bg-slate-800 text-slate-500 font-bold text-center">
                      {comp.uom}
                    </div>
                  </div>
                  <div className="md:pt-6">
                    <button 
                      type="button"
                      onClick={() => removeComponent(index)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}

              {formData.components.length === 0 && (
                <div className="py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-400">
                  <Layers size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium italic">No components defined yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-50 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  id="is_active"
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                  Recipe Active
                </label>
              </div>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                type="button"
                onClick={() => navigate("/production/boms")}
                className="btn btn-secondary flex-1 md:flex-none px-8"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="btn-success flex-1 md:flex-none flex items-center justify-center gap-2 px-10"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isEdit ? 'Update Recipe' : 'Commit Recipe'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
