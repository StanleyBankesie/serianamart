import React, { useEffect, useState } from "react";
import { 
  Link, 
  useNavigate, 
  useParams 
} from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Calendar, 
  CheckCircle2, 
  Clock,
  User,
  Layout,
  ChevronDown
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  
  const [form, setForm] = useState({
    project_id: "",
    task_title: "",
    description: "",
    priority: "MEDIUM",
    status: "PENDING",
    estimated_hours: 0,
    due_date: ""
  });

  useEffect(() => {
    fetchProjects();
    if (isEdit) fetchTask();
  }, [id]);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects");
      setProjects(res.data?.items || []);
    } catch (e) {}
  };

  const fetchTask = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/tasks/${id}`);
      if (res.data?.item) {
        const item = res.data.item;
        setForm({
          ...item,
          due_date: item.due_date ? item.due_date.split('T')[0] : ""
        });
      }
    } catch (e) {
      toast.error("Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/projects/tasks/${id}`, form);
        toast.success("Task updated");
      } else {
        await api.post("/projects/tasks", form);
        toast.success("Task added to workboard");
      }
      navigate("/project-management/tasks");
    } catch (e) {
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 text-2xl uppercase tracking-widest italic">Loading Task...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/tasks" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              {isEdit ? "Refine Task" : "Add Task"}
            </h1>
            <p className="text-slate-500 text-sm">WBS Item Specification</p>
          </div>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={saving}
          className="btn-success flex items-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isEdit ? "Update Task" : "Add Task"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                <Layout size={18} />
                <h2 className="font-bold uppercase text-xs tracking-wider">Task Definition</h2>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target Project</label>
                <div className="relative">
                  <select 
                    required
                    className="w-full pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm appearance-none"
                    value={form.project_id}
                    onChange={e => setForm({...form, project_id: e.target.value})}
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Task Summary</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm"
                  placeholder="What needs to be done?"
                  value={form.task_title}
                  onChange={e => setForm({...form, task_title: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Execution Details</label>
              <textarea
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm min-h-[100px]"
                placeholder="Specify task scope and deliverables..."
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
            </div>
          </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <Clock size={18} />
              <h2 className="font-bold uppercase text-xs tracking-wider">Timeline</h2>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Due Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                value={form.due_date}
                onChange={e => setForm({...form, due_date: e.target.value})}
              />
            </div>
          </div>

          <div className="card p-6 space-y-4">
             <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Task Priority</label>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                   {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                     <button
                       key={p}
                       type="button"
                       onClick={() => setForm({...form, priority: p})}
                       className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all text-left ${form.priority === p ? 'bg-brand-600 text-white shadow-sm shadow-brand-200' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100'}`}
                     >
                       {p}
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Work Stage</label>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                   {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].map(s => (
                     <button
                       key={s}
                       type="button"
                       onClick={() => setForm({...form, status: s})}
                       className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all text-left ${form.status === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100'}`}
                     >
                       {s}
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
