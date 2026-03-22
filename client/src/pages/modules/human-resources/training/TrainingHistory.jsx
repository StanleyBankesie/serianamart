import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

export default function TrainingHistory() {
  const [items, setItems] = React.useState([]);
  const [employeeId, setEmployeeId] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const url = employeeId ? `/hr/training/records?employee_id=${employeeId}` : "/hr/training/records";
      try {
        const res = await api.get(url);
        if (mounted) setItems(res?.data?.items || []);
      } catch {}
    }
    load();
    return () => { mounted = false; };
  }, [employeeId]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back to Menu
          </Link>
          <h2 className="text-lg font-semibold">Training History</h2>
        </div>
        <input className="input w-40" placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded">
        <ul className="space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.id}>
              {it.completion_date} • {it.first_name} {it.last_name} • {it.program_title} • {it.status}
            </li>
          ))}
          {!items.length ? <li>No records</li> : null}
        </ul>
      </div>
    </div>
  );
}
