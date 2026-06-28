/**
 * @fileoverview TaskList component.
 * Provides functionality for TaskList.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING:     "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
    IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
    COMPLETED:   "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
    BLOCKED:     "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${styles[status] || styles.PENDING}`}>
      {status?.replace("_", " ")}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const colors = {
    CRITICAL: "text-rose-600 dark:text-rose-400",
    HIGH:     "text-orange-600 dark:text-orange-400",
    MEDIUM:   "text-blue-600 dark:text-blue-400",
    LOW:      "text-slate-400 dark:text-slate-500",
  };
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full bg-current ${colors[priority] || colors.LOW}`} />
      <span className={`text-[10px] font-bold uppercase tracking-tight ${colors[priority] || colors.LOW}`}>{priority}</span>
    </div>
  );
};

const CompletionSlider = ({ value, taskId, onUpdate }) => {
  const [localVal, setLocalVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => { setLocalVal(value); }, [value]);

  const handleChange = (e) => {
    const v = Number(e.target.value);
    setLocalVal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put(`/projects/tasks/${taskId}`, { completion_percent: v });
        if (onUpdate) onUpdate(taskId, v);
      } catch { toast.error("Failed to update completion %"); }
      finally { setSaving(false); }
    }, 400);
  };

  const barColor =
    localVal >= 100 ? "bg-emerald-500" :
    localVal >= 50  ? "bg-blue-500" :
    localVal >= 25  ? "bg-amber-500" : "bg-slate-400";

  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="relative flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${localVal}%` }} />
        <input type="range" min="0" max="100" step="1" value={localVal} onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-9 text-right tabular-nums">{localVal}%</span>
      {saving && <Loader2 size={12} className="animate-spin text-slate-400" />}
    </div>
  );
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString() : "—";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TaskList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchTasks = async () => {
    try {
      const [tasksRes] = await Promise.all([
        api.get("/projects/tasks"),
      ]);
      setItems(tasksRes.data?.items || []);
    } catch { toast.error("Failed to load workboard"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const filteredItems = items.filter(i =>
    i.task_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.project_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "created_at", "desc");

  const handleCompletionUpdate = useCallback((taskId, val) => {
    setItems(prev => prev.map(i => i.id === taskId ? { ...i, completion_percent: val } : i));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Task Board</h1>
              <p className="text-sm mt-1 opacity-80">WBS execution and progress monitoring</p>
            </div>
            <div className="flex gap-2">
              <Link to="/project-management" className="btn btn-secondary">Return to Menu</Link>
              <Link to="/project-management/tasks/new" className="btn-success">+ Add Task</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filter tasks by title or project..."
              className="input max-w-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <SortableHeader label="Task"       sortKey="task_title"          currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Start Date" sortKey="start_date"          currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Due Date"   sortKey="end_date"            currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Assignee</th>
                  <SortableHeader label="Completion" sortKey="completion_percent"  currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Hours"      sortKey="estimated_hours"     currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <SortableHeader label="Status"     sortKey="status"              currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Docs</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sortedItems.length > 0 ? sortedItems.map((item) => {
                  const isComplete = Number(item.completion_percent || 0) >= 100;
                  return (
                    <tr key={item.id} className={isComplete ? "opacity-75" : ""}>
                      {/* Task */}
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${isComplete ? "bg-emerald-50 border-emerald-200 text-emerald-500" : "bg-slate-50 border-slate-200 text-indigo-500"}`}>
                            <CheckCircle2 size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                              {item.task_title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.project_name || "—"}</div>
                            <PriorityBadge priority={item.priority} />
                          </div>
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 py-3">
                        {fmtDate(item.start_date)}
                      </td>

                      {/* Due Date — backend field is end_date */}
                      <td className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 py-3">
                        {fmtDate(item.end_date)}
                      </td>

                      {/* Assignee */}
                      <td className="text-sm whitespace-nowrap py-3">
                        {item.assigned_to_name || "—"}
                      </td>

                      {/* Completion slider */}
                      <td className="py-3">
                        <CompletionSlider value={item.completion_percent || 0} taskId={item.id} onUpdate={handleCompletionUpdate} />
                      </td>

                      {/* Hours */}
                      <td className="text-center whitespace-nowrap py-3">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded tabular-nums">
                          {Number(item.actual_hours || 0).toFixed(2)} / {Number(item.estimated_hours || 0).toFixed(2)}h
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Docs / Attach */}
                      <td className="text-center py-3">
                        <button
                          type="button"
                          onClick={() => { setActiveDocId(item.id); setShowAttach(true); }}
                          className="px-2 py-1 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition-colors"
                        >
                          Attach
                        </button>
                      </td>

                      {/* Actions — no Delete, Edit hidden when 100% */}
                      <td className="w-px whitespace-nowrap pl-4 py-3">
                        {!isComplete && (
                          <Link
                            to={`/project-management/tasks/${item.id}`}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">No tasks found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => { setShowAttach(false); setActiveDocId(null); }}
        docType="task"
        docId={activeDocId}
      />
    </div>
  );
}
