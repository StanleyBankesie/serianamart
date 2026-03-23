import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function TrainingList() {
  const [programs, setPrograms] = React.useState([]);

  const load = async () => {
    try {
      const res = await api.get("/hr/training/programs");
      setPrograms(res?.data?.items || []);
    } catch {
      toast.error("Failed to load training programs");
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back to Menu
          </Link>
          <h2 className="text-lg font-semibold">Training Programs</h2>
        </div>
        <Link to="/human-resources/training/new" className="btn-primary text-sm">
          New Program
        </Link>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded">
        <table className="min-w-full">
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dates</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.code}</td>
                <td className="px-3 py-2">{p.title}</td>
                <td className="px-3 py-2">
                  {p.start_date} - {p.end_date}
                </td>
              </tr>
            ))}
            {!programs.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm" colSpan={3}>
                  No programs
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
