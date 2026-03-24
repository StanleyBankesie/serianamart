import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function LeaveCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(
          `/hr/leave-calendar?year=${year}&month=${month}`,
        );
        setEvents(res.data?.events || []);
      } catch {
        toast.error("Failed to load calendar");
      }
    };
    load();
  }, [year, month]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  function dayEvents(d) {
    const iso = d.toISOString().slice(0, 10);
    return events.filter(
      (e) => e.start_date <= iso && e.end_date >= iso,
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/human-resources/leave" className="btn-secondary text-sm">
          Back
        </Link>
        <h1 className="text-xl font-semibold">Leave Calendar</h1>
      </div>
      <div className="flex gap-2">
        <input
          className="input w-28"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <select
          className="input w-36"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i, 1).toLocaleString("en", { month: "long" })}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-xs font-semibold text-slate-500">
            {d}
          </div>
        ))}
        {grid.map((d, idx) => {
          const evs = dayEvents(d);
          const isCurrent = d.getMonth() + 1 === month;
          return (
            <div
              key={idx}
              className={`p-2 border rounded min-h-[80px] ${
                isCurrent ? "bg-white dark:bg-slate-800" : "bg-slate-50"
              }`}
            >
              <div className="text-xs text-slate-500">
                {d.getDate()}
              </div>
              <div className="space-y-1 mt-1">
                {evs.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="text-[10px] px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    title={`${e.first_name} ${e.last_name} (${e.type_name}) ${e.start_date}→${e.end_date}`}
                  >
                    {e.first_name} {e.last_name} ({e.type_name})
                  </div>
                ))}
                {evs.length > 3 && (
                  <div className="text-[10px] text-slate-400">+{evs.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

