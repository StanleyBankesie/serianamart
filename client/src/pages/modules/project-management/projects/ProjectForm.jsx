import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";

export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    status: "PLANNED",
    budget: 0,
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetchProject();
  }, [id]);

  async function fetchProject() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/projects/projects/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching project");
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
        await api.put(`/projects/projects/${id}`, form);
      } else {
        await api.post("/projects/projects", form);
      }
      navigate("/project-management/projects");
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/project-management/projects"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {isEdit ? "Edit Project" : "New Project"}
        </h1>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Code</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  placeholder="Auto"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
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
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="label">Budget</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => update("budget", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Link to="/project-management/projects" className="btn-success">
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







