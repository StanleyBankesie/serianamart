import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const LEAVE_CARDS = [
  {
    title: "Leave Application",
    description: "Submit leave requests and check your request status.",
    icon: "📝",
    path: "/human-resources/leave/request",
    accent: "from-blue-500 to-indigo-600",
    badge: "Self-Service",
  },
  {
    title: "Leave Scheduling",
    description: "HR assigns leave; bulk supported.",
    icon: "📅",
    path: "/human-resources/leave/scheduling",
    accent: "from-emerald-500 to-teal-600",
    badge: "Operations",
  },
  {
    title: "Leave Roster",
    description: "Annual planning & export.",
    icon: "📋",
    path: "/human-resources/leave/roster",
    accent: "from-amber-500 to-orange-600",
    badge: "Planning",
  },
  {
    title: "Leave Calendar",
    description: "Monthly view by type.",
    icon: "🗓️",
    path: "/human-resources/leave/calendar",
    accent: "from-purple-500 to-pink-600",
    badge: "Overview",
  },
  {
    title: "Leave Balances",
    description: "Allocated vs Used vs Remaining.",
    icon: "⚖️",
    path: "/human-resources/leave/balances",
    accent: "from-sky-500 to-blue-600",
    badge: "Reports",
  },
];

export default function LeaveManagementDashboard() {
  const [todayCount, setTodayCount] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [util, setUtil] = useState({ used: 0, allocated: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const next7 = new Date();
        next7.setDate(next7.getDate() + 7);
        const end = next7.toISOString().slice(0, 10);
        const [todayRes, nextRes, balRes] = await Promise.all([
          api.get(`/hr/leave/requests?from=${today}&to=${today}`),
          api.get(`/hr/leave/requests?from=${today}&to=${end}`),
          api.get(`/hr/leave/balances`),
        ]);
        setTodayCount((todayRes.data?.items || []).length);
        setUpcoming((nextRes.data?.items || []).length);
        const balances = balRes.data?.items || [];
        const used = balances.reduce((s, b) => s + Number(b.used_days || 0), 0);
        const allocated = balances.reduce((s, b) => s + Number(b.allocated_days || 0), 0);
        setUtil({ used, allocated });
      } catch {
        toast.error("Failed to load leave stats");
      }
    };
    load();
  }, []);

  const utilPct = useMemo(() => {
    if (!util.allocated) return 0;
    return Math.min(100, Math.round((util.used / util.allocated) * 100));
  }, [util]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Leave Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Apply, schedule, roster, calendar, and balances
          </p>
        </div>
        <Link to="/human-resources" className="btn-secondary shrink-0">
          ← Back to Menu
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-slate-500 text-xs">On Leave Today</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{todayCount}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-slate-500 text-xs">Upcoming 7 Days</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{upcoming}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-slate-500 text-xs">Leave Utilization</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{utilPct}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LEAVE_CARDS.map((card) => (
          <Link
            key={card.path}
            to={card.path}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          >
            {/* Gradient accent bar */}
            <div
              className={`h-1.5 w-full bg-gradient-to-r ${card.accent}`}
            />

            <div className="p-6 flex flex-col gap-4">
              {/* Icon + badge row */}
              <div className="flex items-center justify-between">
                <span className="text-3xl">{card.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {card.badge}
                </span>
              </div>

              {/* Title + description */}
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand transition-colors">
                  {card.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* CTA */}
              <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
                Open
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

