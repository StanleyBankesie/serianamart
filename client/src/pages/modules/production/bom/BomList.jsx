import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  FileText,
  Filter,
  Package,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function BomList() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchBoms = async () => {
    try {
      const res = await api.get("/production/boms");
      setBoms(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to fetch BOMs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoms();
  }, []);

  const searchFilteredBoms = boms.filter(b => 
    String(b.bom_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(b.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(b.item_code || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: sortedBoms, sortKey, sortDir, toggle } = useSort(searchFilteredBoms, "bom_name", "asc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Bill of Materials</h1>
            <p className="text-slate-500 text-sm">Product recipes and structural definitions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search recipes..."
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/production/boms/new" 
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            Create BOM
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Product Information" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="BOM Name" sortKey="bom_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Output Qty" sortKey="output_qty" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <SortableHeader label="Status" sortKey="is_active" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Fetching Recipes...</td>
                </tr>
              ) : sortedBoms.length > 0 ? sortedBoms.map((bom) => (
                <tr key={bom.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <Package size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-brand-700 dark:text-brand-300">{bom.item_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{bom.item_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{bom.bom_name}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-slate-900 dark:text-white px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      {Number(bom.output_qty).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${bom.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {bom.is_active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link 
                        to={`/production/boms/edit/${bom.id}`}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileText size={48} className="opacity-20" />
                      <p className="font-medium">No recipes found</p>
                      <Link to="/production/boms/new" className="btn-success btn-sm">Initialize first recipe</Link>
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
