import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../api/client.js";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";

function permKey(module_key, dashboard_key, card_key, ticker_key) {
  return `${module_key}|${dashboard_key || ""}|${card_key || ""}|${ticker_key || ""}`;
}

export default function DashboardPermissions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [perms, setPerms] = useState([]);
  const [userToggles, setUserToggles] = useState({});
  const [togglesInitialized, setTogglesInitialized] = useState(false);

  useEffect(() => {
    setUserToggles({});
    setTogglesInitialized(false);
  }, [selectedUserId]);

  useEffect(() => {
    if (togglesInitialized || perms.length === 0) return;
    const map = {};
    for (const p of perms) {
      const key = permKey(p.module_key, p.dashboard_key, p.card_key, p.ticker_key);
      map[key] = Number(p.can_view) === 1;
    }
    setUserToggles(map);
    setTogglesInitialized(true);
  }, [perms, togglesInitialized]);

  const modules = useMemo(() => {
    const base = Object.entries(MODULES_REGISTRY).map(([key, val]) => {
      const fromRegistry = Array.isArray(val.dashboards) ? val.dashboards : [];
      const existing = new Set(fromRegistry.map((d) => String(d.key || "")));
      const extras = [{ key: "dashboard", name: "Dashboard" }];
      if (key === "business-intelligence") {
        extras.unshift({ key: "dashboards", name: "Dashboards" });
      }
      const dashboards = [
        ...extras.filter((d) => !existing.has(String(d.key || ""))),
        ...fromRegistry,
      ];
      return {
        key,
        name: val.name,
        icon: val.icon,
        dashboards,
      };
    });
    base.unshift({ key: "home", name: "Home", icon: "🏠", dashboards: [] });
    return base;
  }, []);

  const KNOWN_CARDS = useMemo(
    () => ({
      home: [
        { key: "today-sales", label: "Today Sales" },
        { key: "total-customers", label: "Total Customers" },
        { key: "average-order", label: "Average Order" },
        { key: "monthly-revenue", label: "Monthly Revenue" },
      ],
      administration: [
        { key: "total-users", label: "Total Users" },
        { key: "active-sessions", label: "Active Sessions" },
        { key: "pending-workflows", label: "Pending Workflows" },
      ],
      sales: [
        { key: "sales-this-month", label: "Total Sales This Month" },
        { key: "open-quotations", label: "Open Quotations" },
        { key: "pending-deliveries", label: "Pending Deliveries" },
        { key: "overdue-invoices", label: "Overdue Invoices" },
        { key: "total-revenue", label: "Total Revenue" },
        { key: "sales-growth", label: "Sales Growth %" },
        { key: "total-sales", label: "Total Sales" },
        { key: "open-orders", label: "Open Orders" },
      ],
      purchase: [
        { key: "total-purchases", label: "Total Purchases" },
        { key: "active-purchase-orders", label: "Active Purchase Orders" },
        { key: "active-suppliers", label: "Active Suppliers" },
        { key: "pending-approvals", label: "Pending Approvals" },
        { key: "outstanding-payables", label: "Outstanding Payables" },
        { key: "pending-orders", label: "Pending Orders" },
        { key: "pending-grns", label: "Pending GRNs" },
      ],
      inventory: [
        { key: "items-tracked", label: "Items Tracked" },
        { key: "pending-requisitions", label: "Pending Requisitions" },
        { key: "incoming-transfers", label: "Incoming Transfers" },
      ],
      finance: [
        { key: "cash-balance", label: "Cash Balance" },
        { key: "pending-vouchers", label: "Pending Vouchers" },
        { key: "monthly-expenses", label: "Monthly Expenses" },
      ],
      "human-resources": [
        { key: "active-employees", label: "Active Employees" },
        { key: "on-leave", label: "On Leave" },
        { key: "payroll-status", label: "Payroll Status" },
      ],
      maintenance: [
        { key: "open-requests", label: "New Requests" },
        { key: "active-jobs", label: "Jobs In Progress" },
        { key: "open-work-orders", label: "Open Work Orders" },
        { key: "overdue-pms", label: "Overdue PMs" },
        { key: "asset-health", label: "Asset Health" },
      ],
      production: [
        { key: "active-work-orders", label: "Active Work Orders" },
        { key: "efficiency", label: "Efficiency" },
        { key: "active-boms", label: "Active BOMs" },
      ],
      "project-management": [
        { key: "active-projects", label: "Active Projects" },
        { key: "active-tasks", label: "Active Tasks" },
        { key: "total-budget", label: "Total Budget" },
        { key: "logged-hours", label: "Logged Hours" },
        { key: "open-tasks", label: "Open Tasks" },
        { key: "on-time-completion", label: "On Time Completion" },
      ],
      pos: [
        { key: "today-sales", label: "Today Sales" },
        { key: "total-customers", label: "Total Customers" },
        { key: "average-order", label: "Average Order" },
        { key: "monthly-revenue", label: "Monthly Revenue" },
      ],
      "business-intelligence": [
        { key: "active-dashboards", label: "Active Dashboards" },
        { key: "scheduled-reports", label: "Scheduled Reports" },
        { key: "data-sources", label: "Data Sources" },
      ],
      "service-management": [
        { key: "open-requests", label: "Open Requests" },
        { key: "pending-bills", label: "Pending Bills" },
        { key: "confirmed-services", label: "Confirmed Services" },
      ],
      "executive-overview": [
        { key: "executive-metrics", label: "Executive Metrics" },
        { key: "kpi-summary", label: "KPI Summary" },
        { key: "goal-tracking", label: "Goal Tracking" },
      ],
    }),
    [],
  );

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
        setUsers(items);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadPerms() {
      if (!selectedUserId) {
        setPerms([]);
        return;
      }
      try {
        const res = await api.get(
          `/access/dashboard-permissions?user_id=${selectedUserId}`,
        );
        const items =
          (res.data && res.data.data && Array.isArray(res.data.data.items)
            ? res.data.data.items
            : Array.isArray(res.data?.items)
              ? res.data.items
              : []) || [];
        setPerms(items);
      } catch {
        setPerms([]);
      }
    }
    loadPerms();
  }, [selectedUserId]);

  function makeToggleHandler(module_key, dashboard_key, card_key, ticker_key, onChange) {
    return (e) => {
      const key = permKey(module_key, dashboard_key, card_key, ticker_key);
      setUserToggles((prev) => ({ ...prev, [key]: e.target.checked }));
      onChange(e.target.checked);
    };
  }

  const getView = (
    module_key,
    dashboard_key,
    card_key = null,
    ticker_key = null,
  ) => {
    const key = permKey(module_key, dashboard_key, card_key, ticker_key);
    if (key in userToggles) return userToggles[key];
    const match = perms.filter(
      (p) =>
        String(p.module_key) === String(module_key) &&
        String(p.dashboard_key || "") === String(dashboard_key || "") &&
        String(p.card_key || "") === String(card_key || "") &&
        String(p.ticker_key || "") === String(ticker_key || ""),
    );
    if (match.length === 0) return true;
    return match.some((p) => Number(p.can_view) === 1);
  };
  const setView = (module_key, dashboard_key, card_key, ticker_key, value) => {
    setPerms((prev) => {
      const matched = prev.filter(
        (p) =>
          String(p.module_key) === String(module_key) &&
          String(p.dashboard_key || "") === String(dashboard_key || "") &&
          String(p.card_key || "") === String(card_key || "") &&
          String(p.ticker_key || "") === String(ticker_key || ""),
      );
      if (matched.length > 0) {
        // Update ALL matching records (handles duplicates)
        return prev.map((p) =>
          String(p.module_key) === String(module_key) &&
          String(p.dashboard_key || "") === String(dashboard_key || "") &&
          String(p.card_key || "") === String(card_key || "") &&
          String(p.ticker_key || "") === String(ticker_key || "")
            ? { ...p, can_view: value ? 1 : 0 }
            : p,
        );
      }
      return [
        ...prev,
        {
          user_id: Number(selectedUserId),
          module_key,
          dashboard_key: dashboard_key || null,
          card_key: card_key || null,
          ticker_key: ticker_key || null,
          can_view: value ? 1 : 0,
        },
      ];
    });
  };

  const persistPermission = async (module_key, type, key, allow) => {
    if (!selectedUserId) return;
    const dashboard_key = type === "dashboard" ? key : null;
    const card_key = type === "card" ? key : null;
    const ticker_key = type === "ticker" ? key : null;
    setView(module_key, dashboard_key, card_key, ticker_key, allow);
    try {
      await api.put("/access/dashboard-permissions", {
        user_id: Number(selectedUserId),
        permissions: [
          {
            module_key,
            dashboard_key,
            card_key,
            ticker_key,
            can_view: allow ? 1 : 0,
          },
        ],
      });
      const msg = `${String(module_key || "").toUpperCase()}: ${String(
        type === "dashboard" ? "Dashboard" : type === "card" ? "Card" : "Ticker",
      )} ${String(key || "")} ${allow ? "enabled" : "disabled"}`;
      toast.success(msg);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Permissions</h1>
          <p className="text-sm text-slate-600">
            Control which dashboards/cards/tickers a user can view
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/administration")}
        >
          Back to Admin
        </button>
      </div>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="max-w-md">
            <label className="label">User</label>
            <select
              className="input w-full"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username || u.full_name || `User #${u.id}`}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && (
            <div className="space-y-6">
              {modules.map((m) => {
                const cards = KNOWN_CARDS[m.key] || [];
                const hasDashboards = m.dashboards.length > 0;
                const hasCards = cards.length > 0;
                if (!hasDashboards && !hasCards && m.key !== "home")
                  return null;

                return (
                  <div key={m.key} className="border rounded-lg">
                    <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="font-semibold">
                        {m.icon} {m.name}
                      </div>
                      {(hasDashboards || hasCards) && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={
                              hasDashboards &&
                              m.dashboards.every((d) =>
                                getView(m.key, d.key),
                              ) &&
                              hasCards &&
                              cards.every((c) =>
                                getView(m.key, null, c.key, null),
                              )
                            }
                            onChange={(e) => {
                              const val = e.target.checked;
                              const updates = {};
                              m.dashboards.forEach((d) => {
                                const k = permKey(m.key, d.key, null, null);
                                updates[k] = val;
                                setView(m.key, d.key, null, null, val);
                                persistPermission(m.key, "dashboard", d.key, val);
                              });
                              cards.forEach((c) => {
                                const k = permKey(m.key, null, c.key, null);
                                updates[k] = val;
                                setView(m.key, null, c.key, null, val);
                                persistPermission(m.key, "card", c.key, val);
                              });
                              setUserToggles((prev) => ({ ...prev, ...updates }));
                            }}
                          />
                          <span>Select All</span>
                        </label>
                      )}
                    </div>
                    <div className="p-4 space-y-4">
                      {m.dashboards.map((d) => (
                        <div key={d.key}>
                          <label className="flex items-center gap-2 font-medium mb-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={getView(m.key, d.key)}
                              onChange={makeToggleHandler(m.key, d.key, null, null, (val) => {
                                setView(m.key, d.key, null, null, val);
                                persistPermission(m.key, "dashboard", d.key, val);
                              })}
                            />
                            <span>📊 {d.name || d.label}</span>
                          </label>
                        </div>
                      ))}
                      {cards.length > 0 && (
                        <div className={m.dashboards.length > 0 ? "ml-7 space-y-1" : ""}>
                          {m.dashboards.length > 0 && (
                            <h4 className="font-medium text-sm text-slate-700 mb-1">
                              Dashboard Cards
                            </h4>
                          )}
                          <div className={m.dashboards.length > 0 ? "space-y-1" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"}>
                            {cards.map((c) => (
                              <label
                                key={c.key}
                                className={
                                  m.dashboards.length > 0
                                    ? "flex items-center gap-2 pl-2 border-l-2 border-slate-200"
                                    : "flex items-center gap-2"
                                }
                              >
                                <input
                                  type="checkbox"
                                  className={m.dashboards.length > 0 ? "checkbox checkbox-xs" : "checkbox checkbox-sm"}
                                  checked={getView(m.key, null, c.key, null)}
                                  onChange={makeToggleHandler(m.key, null, c.key, null, (val) => {
                                    setView(m.key, null, c.key, null, val);
                                    persistPermission(m.key, "card", c.key, val);
                                  })}
                                />
                                <span className={"text-sm" + (m.dashboards.length > 0 ? " text-slate-600" : "")}>
                                  {c.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardTickerEditor({ entries = [], onChange }) {
  const [value, setValue] = useState("");
  const list = entries
    .filter((e) => e.can_view)
    .map((e) => e.card_key || e.ticker_key)
    .filter(Boolean);
  const remove = (k) => {
    const next = list.filter((x) => String(x) !== String(k));
    onChange(next);
  };
  const add = () => {
    const k = value.trim();
    if (!k) return;
    if (!list.includes(k)) onChange([...list, k]);
    setValue("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Enter key (e.g., total-sales)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className="btn" onClick={add}>
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((k) => (
          <span
            key={k}
            className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center gap-2"
          >
            {k}
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={() => remove(k)}
              title="Remove"
            >
              ✕
            </button>
          </span>
        ))}
        {!list.length && (
          <span className="text-xs text-slate-500">
            No entries. Add keys to allow viewing.
          </span>
        )}
      </div>
    </div>
  );
}
