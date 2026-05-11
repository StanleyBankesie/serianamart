import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  DollarSign, 
  ArrowLeft,
  ChevronRight,
  User,
  Briefcase,
  AlertCircle,
  Tag,
  Filter,
  ArrowUpRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function ExpenseList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState([]);
  
  const [form, setForm] = useState({
    project_id: "",
    expense_date: new Date().toISOString().split('T')[0],
    category: "MATERIALS",
    amount: "",
    description: ""
  });

  const fetchExpenses = async () => {
    try {
      const res = await api.get("/projects/timesheets"); // Placeholder
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  const fetchAuxiliary = async () => {
    try {
      const res = await api.get("/projects/projects");
      setProjects(res.data?.items || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchExpenses();
    fetchAuxiliary();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.success("Expense record submitted for approval");
    setShowModal(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Project Expenses</h1>
            <p className="text-slate-500 text-sm">Tracking disbursements and material costs</p>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-success flex items-center gap-2"
        >
          <Plus size={20} />
          + Record Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
           <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 w-fit">
              <DollarSign size={20} />
           </div>
           <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses (MTD)</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">GHS 12,450.00</p>
           </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
           <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 w-fit">
              <AlertCircle size={20} />
           </div>
           <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approval</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">GHS 3,120.00</p>
           </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
           <div className="flex items-center gap-2 text-emerald-600">
              <ArrowUpRight size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Budget Utilization</span>
           </div>
           <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-indigo-600 w-[64%] rounded-full" />
           </div>
           <p className="text-[10px] font-semibold text-slate-400 mt-2">64% of allocated budget spent</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
           <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Expense Ledger</h2>
           <div className="flex gap-2">
              <button className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Filter size={16} /></button>
              <button className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Search size={16} /></button>
           </div>
        </div>
        <div className="px-6 py-20 text-center text-slate-400 font-medium italic opacity-50">
           Project expense tracking ledger is coming soon.
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
             <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-600 rounded-lg text-white">
                      <DollarSign size={18} />
                   </div>
                   <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Expense</h2>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Project Reference</label>
                      <select 
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                        value={form.project_id}
                        onChange={e => setForm({...form, project_id: e.target.value})}
                      >
                         <option value="">Select Project...</option>
                         {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                        <input 
                          type="date" 
                          required
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          value={form.expense_date}
                          onChange={e => setForm({...form, expense_date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Amount</label>
                        <input 
                          type="number" 
                          required
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          placeholder="0.00"
                          value={form.amount}
                          onChange={e => setForm({...form, amount: e.target.value})}
                        />
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                        value={form.category}
                        onChange={e => setForm({...form, category: e.target.value})}
                      >
                         <option value="MATERIALS">Materials & Supply</option>
                         <option value="LABOR">External Labor</option>
                         <option value="TRAVEL">Travel & Logistics</option>
                         <option value="EQUIPMENT">Equipment Rental</option>
                         <option value="OTHER">Other Expenses</option>
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Memo</label>
                      <textarea 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        rows="2"
                        placeholder="Purpose..."
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                      />
                   </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-sm uppercase tracking-wider shadow-sm"
                >
                  Submit for Approval
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
