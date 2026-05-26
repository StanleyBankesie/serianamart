import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Calendar, User, Layout, ChevronDown, Paperclip, Percent, AlertTriangle, AlignLeft } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

export default function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({
    project_id: "", task_title: "", description: "", priority: "MEDIUM", status: "PENDING",
    estimated_hours: 0, due_date: "", start_date: "", reason_for_delay: "",
    completion_percent: 0, assigned_to_id: "", assigned_to_name: ""
  });

  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
    if (isEdit) fetchTask();
  }, [id]);

  const fetchProjects = async () => {
    try { const res = await api.get("/projects/projects"); setProjects(res.data?.items || []); } catch {}
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users", { params: { active: 1 } });
      const items = (res?.data?.data?.items) || (res?.data?.items) || [];
      setUsers(items);
    } catch {}
  };

  const fetchTask = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/tasks/${id}`);
      if (res.data?.item) {
        const item = res.data.item;
        setForm({
          project_id: item.project_id || "", task_title: item.task_title || "",
          description: item.task_description || "", priority: item.priority || "MEDIUM",
          status: item.status || "PENDING", estimated_hours: item.estimated_hours || 0,
          due_date: item.end_date ? item.end_date.split('T')[0] : "",
          start_date: item.start_date ? item.start_date.split('T')[0] : "",
          reason_for_delay: item.reason_for_delay || "", completion_percent: item.completion_percent || 0,
          assigned_to_id: item.assigned_to_id || "", assigned_to_name: item.assigned_to_name || ""
        });
      }
    } catch { toast.error("Failed to load task details"); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form, task_description: form.description, end_date: form.due_date,
        completion_percent: form.status === "COMPLETED" ? 100 : form.completion_percent
      };
      delete payload.description; delete payload.due_date;

      if (isEdit) { await api.put(`/projects/tasks/${id}`, payload); toast.success("Task updated"); }
      else { await api.post("/projects/tasks", payload); toast.success("Task added to workboard"); }
      navigate("/project-management/tasks");
    } catch { toast.error("Failed to save task"); }
    finally { setSaving(false); }
  };

  const handleStatusChange = (newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === "COMPLETED") updates.completion_percent = 100;
    setForm({ ...form, ...updates });
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-slate-300 text-2xl uppercase tracking-widest italic">Loading Task...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/tasks" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">{isEdit ? "Refine Task" : "Add Task"}</h1>
            <p className="text-slate-500 text-sm">WBS Item Specification</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button type="button" onClick={() => setShowAttach(true)} className="btn btn-secondary flex items-center gap-2">
              <Paperclip size={18} />Attachments
            </button>
          )}
          <button onClick={handleSubmit} disabled={saving} className="btn-success flex items-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isEdit ? "Update Task" : "Add Task"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
                <Layout size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Task Definition</h2>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Target Project</label>
                <div className="relative">
                  <select required className="w-full input pr-10 appearance-none" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}>
                    <option value="">Select Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Task Summary</label>
                <input type="text" required className="input w-full" placeholder="What needs to be done?" value={form.task_title} onChange={e => setForm({...form, task_title: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block"><AlignLeft size={14} className="inline mr-1" />Execution Details</label>
              <textarea className="input w-full min-h-[100px]" placeholder="Specify task scope and deliverables..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block"><AlertTriangle size={14} className="inline mr-1" />Reason for Delay</label>
              <textarea className="input w-full min-h-[80px]" placeholder="If task is delayed, describe the reason..." value={form.reason_for_delay} onChange={e => setForm({...form, reason_for_delay: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <User size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Assignment</h2>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Assignee</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium text-sm appearance-none" value={form.assigned_to_id} onChange={e => {
                  const u = users.find(x => x.id == e.target.value);
                  setForm({...form, assigned_to_id: e.target.value, assigned_to_name: u?.username || ""});
                }}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <Layout size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Timeline</h2>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="date" className="input w-full pl-9" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Due Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="date" className="input w-full pl-9" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Estimated Hours</label>
              <input type="number" step="0.5" min="0" className="input w-full" placeholder="0" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <Percent size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Completion</h2>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Task Progress: {form.completion_percent}%</label>
              <div className="relative pt-2">
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${form.completion_percent >= 100 ? 'bg-emerald-500' : form.completion_percent >= 50 ? 'bg-blue-500' : form.completion_percent >= 25 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${form.completion_percent}%` }} />
                </div>
                <input type="range" min="0" max="100" step="1" value={form.completion_percent} onChange={e => setForm({...form, completion_percent: Number(e.target.value)})} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Task Priority</label>
              <div className="grid grid-cols-1 gap-1.5 mt-2">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                  <button key={p} type="button" onClick={() => setForm({...form, priority: p})}
                    className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all text-left ${form.priority === p ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Work Stage</label>
              <div className="grid grid-cols-1 gap-1.5 mt-2">
                {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].map(s => (
                  <button key={s} type="button" onClick={() => handleStatusChange(s)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all text-left ${form.status === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{s.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DocumentAttachmentsModal open={showAttach} onClose={() => setShowAttach(false)} docType="task" docId={id} />
    </div>
  );
}
