import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

export default function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    projectId: "",
    taskTitle: "",
    description: "",
    priority: "MEDIUM",
    status: "PENDING",
    estimatedHours: 0,
    dueDate: "",
    startDate: "",
    reasonForDelay: "",
    completionPercent: 0,
    assignedToId: "",
    assignedToName: "",
  });

  const [showAttach, setShowAttach] = useState(false);

  const statusColors = {
    PENDING: "bg-gray-500 text-white",
    IN_PROGRESS: "bg-blue-500 text-white",
    COMPLETED: "bg-green-500 text-white",
    BLOCKED: "bg-red-500 text-white",
  };

  useEffect(() => {
    let mounted = true;
    api.get("/projects/projects").then(res => {
      if (!mounted) return;
      setProjects(Array.isArray(res.data?.items) ? res.data.items : []);
    }).catch(() => {});
    api.get("/admin/users", { params: { active: 1 } }).then(res => {
      if (!mounted) return;
      const items = (res?.data?.data?.items) || (res?.data?.items) || [];
      setUsers(items);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api.get(`/projects/tasks/${id}`).then(res => {
      if (!mounted) return;
      const item = res.data?.item;
      if (!item) return;
      setFormData({
        projectId: item.project_id || "",
        taskTitle: item.task_title || "",
        description: item.task_description || "",
        priority: item.priority || "MEDIUM",
        status: item.status || "PENDING",
        estimatedHours: item.estimated_hours || 0,
        dueDate: item.end_date ? item.end_date.split("T")[0] : "",
        startDate: item.start_date ? item.start_date.split("T")[0] : "",
        reasonForDelay: item.reason_for_delay || "",
        completionPercent: item.completion_percent || 0,
        assignedToId: item.assigned_to_id || "",
        assignedToName: item.assigned_to_name || "",
      });
    }).catch(e => {
      if (!mounted) return;
      setError(e?.response?.data?.message || "Failed to load task");
    }).finally(() => {
      if (!mounted) return;
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        project_id: formData.projectId || null,
        task_title: formData.taskTitle,
        task_description: formData.description,
        priority: formData.priority,
        status: formData.status,
        estimated_hours: formData.estimatedHours || 0,
        end_date: formData.dueDate || null,
        start_date: formData.startDate || null,
        reason_for_delay: formData.reasonForDelay || null,
        completion_percent: formData.status === "COMPLETED" ? 100 : (formData.completionPercent || 0),
        assigned_to_id: formData.assignedToId || null,
        assigned_to_name: formData.assignedToName || null,
      };

      if (isNew) {
        await api.post("/projects/tasks", payload);
      } else {
        await api.put(`/projects/tasks/${id}`, payload);
      }
      navigate("/project-management/tasks", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    setFormData(prev => ({
      ...prev,
      status: newStatus,
      completionPercent: newStatus === "COMPLETED" ? 100 : prev.completionPercent,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Task" : "Edit Task"}
              </h1>
              <p className="text-sm mt-1">WBS Item Specification</p>
            </div>
              <Link to="/project-management/tasks" className="btn-success">Back to List</Link>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Project *</label>
                <select className="input" value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })} required>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Task Title *</label>
                <input type="text" className="input" value={formData.taskTitle}
                  onChange={e => setFormData({ ...formData, taskTitle: e.target.value })} required />
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="pt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[formData.status] || "bg-gray-500 text-white"}`}>
                    {formData.status === "IN_PROGRESS" ? "In Progress" : formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="label">Estimated Hours</label>
                <input type="number" step="0.5" min="0" className="input" value={formData.estimatedHours}
                  onChange={e => setFormData({ ...formData, estimatedHours: e.target.value })} />
              </div>
              <div>
                <label className="label">Completion %</label>
                <input type="number" min="0" max="100" className="input" value={formData.completionPercent}
                  onChange={e => setFormData({ ...formData, completionPercent: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Assignee</label>
                <select className="input" value={formData.assignedToId}
                  onChange={e => {
                    const u = users.find(x => x.id == e.target.value);
                    setFormData({ ...formData, assignedToId: e.target.value, assignedToName: u?.username || "" });
                  }}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Work Stage</label>
                <select className="input" value={formData.status}
                  onChange={e => handleStatusChange(e.target.value)}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Execution Details</label>
              <textarea className="input w-full" rows="3" value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Specify task scope and deliverables..."></textarea>
            </div>

            <div>
              <label className="label">Reason for Delay</label>
              <textarea className="input w-full" rows="2" value={formData.reasonForDelay}
                onChange={e => setFormData({ ...formData, reasonForDelay: e.target.value })}
                placeholder="If task is delayed, describe the reason..."></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link to="/project-management/tasks"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Cancel</Link>
              <button type="submit" className="btn-success" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <DocumentAttachmentsModal open={showAttach} onClose={() => setShowAttach(false)} docType="task" docId={id} />
    </div>
  );
}