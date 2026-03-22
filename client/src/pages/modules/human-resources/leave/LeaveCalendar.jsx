import React from "react";
import { api } from "../../../../api/client.js";

export default function LeaveCalendar() {
  const [items, setItems] = React.useState([]);
  const [month, setMonth] = React.useState(
    new Date().toISOString().slice(0, 7),
  );

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const start = `${month}-01`;
      const end = `${month}-31`;
      try {
        const res = await api.get(
          `/hr/leave/requests?status=APPROVED&from_date=${start}&to_date=${end}`,
        );
        if (mounted) setItems(res?.data?.items || []);
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, [month]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Leave Calendar</h2>
        <input
          type="month"
          className="input w-40"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded">
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="text-sm">
              {it.start_date} - {it.end_date}: {it.first_name} {it.last_name} (
              {it.type_name})
            </li>
          ))}
          {!items.length ? <li className="text-sm">No approved leaves</li> : null}
        </ul>
      </div>
    </div>
  );
}
