import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { toast } from "react-toastify";
import { MODULES_REGISTRY } from "../../data/modulesRegistry.js";

export default function DashboardPermissions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [perms, setPerms] = useState([]);

  const modules = useMemo(() => {
    const base = Object.entries(MODULES_REGISTRY).map(([key, val]) => ({
      key,
      name: val.name,
      icon: val.icon,
      dashboards: val.dashboards || [],
    }));
    // Add Home as a virtual module for homepage cards/tickers
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
        { key: "total-sales", label: "Total Sales" },
        { key: "open-orders", label: "Open Orders" },
        { key: "pending-deliveries", label: "Pending Deliveries" },
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
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setPerms(items);
      } catch {
        setPerms([]);
      }
    }
    loadPerms();
  }, [selectedUserId]);

  const getView = (
    module_key,
    dashboard_key,
    card_key = null,
    ticker_key = null,
  ) => {
    const row = perms.find(
      (p) =>
        String(p.module_key) === String(module_key) &&
        String(p.dashboard_key || "") === String(dashboard_key || "") &&
        String(p.card_key || "") === String(card_key || "") &&
        String(p.ticker_key || "") === String(ticker_key || ""),
    );
    return !!row?.can_view;
  };
  const setView = (module_key, dashboard_key, card_key, ticker_key, value) => {
    setPerms((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (p) =>
          String(p.module_key) === String(module_key) &&
          String(p.dashboard_key || "") === String(dashboard_key || "") &&
          String(p.card_key || "") === String(card_key || "") &&
          String(p.ticker_key || "") === String(ticker_key || ""),
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], can_view: value ? 1 : 0 };
      } else {
        next.push({
          user_id: Number(selectedUserId),
          module_key,
          dashboard_key: dashboard_key || null,
          card_key: card_key || null,
          ticker_key: ticker_key || null,
          can_view: value ? 1 : 0,
        });
      }
      return next;
    });
  };

  const persistPermission = async (module_key, type, key, allow) => {
    if (!selectedUserId) return;
    try {
      await api.put("/access/dashboard-permissions", {
        user_id: Number(selectedUserId),
        permissions: [
          {
            user_id: Number(selectedUserId),
            module_key,
            dashboard_key: type === "dashboard" ? key : null,
            card_key: type === "card" ? key : null,
            ticker_key: type === "ticker" ? key : null,
            can_view: allow ? 1 : 0,
          },
        ],
      });
      toast.success("Permission updated");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update permission");
    }
  };

  async function saveAll() {
    if (!selectedUserId) {
      setError("Please choose a user");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.put("/access/dashboard-permissions", {
        user_id: Number(selectedUserId),
        permissions: perms,
      });
      setSuccess("Dashboard permissions saved");
      toast.success("Dashboard permissions saved");
      setTimeout(() => setSuccess(""), 1500);
      navigate("/administration/access/dashboard-permissions");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

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
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

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
              {modules.map((m) => (
                <div key={m.key} className="border rounded-lg">
                  <div className="px-4 py-3 bg-slate-50 border-b">
                    <div className="font-semibold">
                      {m.icon} {m.name}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Dashboards</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {m.dashboards.map((d) => (
                          <label
                            key={d.key}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={getView(m.key, d.key)}
                              onChange={(e) => {
                                setView(
                                  m.key,
                                  d.key,
                                  null,
                                  null,
                                  e.target.checked,
                                );
                                persistPermission(
                                  m.key,
                                  "dashboard",
                                  d.key,
                                  e.target.checked,
                                );
                              }}
                            />
                            <span className="text-sm">{d.name || d.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Cards</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(KNOWN_CARDS[m.key] || []).map((c) => (
                          <label
                            key={c.key}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={getView(m.key, null, c.key, null)}
                              onChange={(e) => {
                                setView(
                                  m.key,
                                  null,
                                  c.key,
                                  null,
                                  e.target.checked,
                                );
                                persistPermission(
                                  m.key,
                                  "card",
                                  c.key,
                                  e.target.checked,
                                );
                              }}
                            />
                            <span className="text-sm">{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Tickers</h4>
                      <CardTickerEditor
                        entries={perms.filter(
                          (p) =>
                            p.module_key === m.key &&
                            !p.dashboard_key &&
                            !p.card_key &&
                            p.ticker_key,
                        )}
                        onChange={(list) => {
                          setPerms((prev) => {
                            const next = prev.filter(
                              (p) =>
                                !(
                                  p.module_key === m.key &&
                                  !p.dashboard_key &&
                                  !p.card_key &&
                                  p.ticker_key
                                ),
                            );
                            const additions = list.map((k) => ({
                              user_id: Number(selectedUserId),
                              module_key: m.key,
                              dashboard_key: null,
                              card_key: null,
                              ticker_key: k,
                              can_view: 1,
                            }));
                            // Persist each immediately
                            additions.forEach((a) =>
                              persistPermission(
                                m.key,
                                "ticker",
                                a.ticker_key,
                                true,
                              ),
                            );
                            return next.concat(additions);
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Immediate save on toggle; no bulk Save button needed */}
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
