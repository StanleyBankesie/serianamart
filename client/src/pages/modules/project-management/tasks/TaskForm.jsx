import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    projectCode: "PRJ-001",
    title: "",
    assignee: "",
    due: "",
    status: "PLANNED",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchTask();
  }, [id]);

  async function fetchTask() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/projects/tasks/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching task");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isEdit) {
        await api.put(`/projects/tasks/${id}`, form);
      } else {
        await api.post("/projects/tasks", form);
      }
      navigate("/project-management/tasks");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/project-management/tasks"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to Tasks
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {isEdit ? "Edit Task" : "New Task"}
        </h1>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Project</label>
                <input
                  className="input"
                  value={form.projectCode}
                  onChange={(e) => update("projectCode", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Assignee</label>
                <input
                  className="input"
                  value={form.assignee}
                  onChange={(e) => update("assignee", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.due}
                  onChange={(e) => update("due", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Link to="/project-management/tasks" className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







