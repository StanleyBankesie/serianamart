import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function SystemLogBookPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState({
    startedAt: "",
    uptimeSeconds: 0,
    uptimeHuman: "",
    database: {
      threadsConnected: 0,
      threadsRunning: 0,
      maxConnections: 0,
      loadPercent: 0,
    },
    recentLogins: [],
  });

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/admin/reports/system-log-book", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let t = null;
    async function loadStatus() {
      try {
        setStatusLoading(true);
        const res = await api.get("/admin/system-status");
        if (cancelled) return;
        const s = res.data || {};
        setStatus({
          startedAt: String(s.startedAt || ""),
          uptimeSeconds: Number(s.uptimeSeconds || 0),
          uptimeHuman: String(s.uptimeHuman || ""),
          database: {
            threadsConnected: Number(s?.database?.threadsConnected || 0),
            threadsRunning: Number(s?.database?.threadsRunning || 0),
            maxConnections: Number(s?.database?.maxConnections || 0),
            loadPercent: Number(s?.database?.loadPercent || 0),
          },
          recentLogins: Array.isArray(s.recentLogins) ? s.recentLogins : [],
        });
      } catch (e) {
      } finally {
        setStatusLoading(false);
      }
    }
    loadStatus();
    t = setInterval(loadStatus, 15000);
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">System Log Book</h1>
            <p className="text-sm mt-1">Application events and user activity across modules</p>
          </div>
          <Link to="/administration" className="btn btn-secondary">Return to Menu</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold">System Status</div>
              <div className="text-xs text-slate-500">
                Started {status.startedAt ? new Date(status.startedAt).toLocaleString() : "-"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm">
                Server Uptime
              </div>
              <div className="text-xl font-bold text-brand-700">
                {statusLoading ? "…" : status.uptimeHuman || "-"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Database Load</div>
              <div className="text-2xl font-bold text-brand-700">
                {statusLoading ? "…" : `${Number(status.database.loadPercent || 0)}%`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Connected: {status.database.threadsConnected} / Max: {status.database.maxConnections}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Threads Running</div>
              <div className="text-2xl font-bold text-brand-700">
                {statusLoading ? "…" : Number(status.database.threadsRunning || 0)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Recent Login</div>
              <div className="text-sm mt-1 space-y-1">
                {statusLoading && <div>Loading…</div>}
                {!statusLoading &&
                  (status.recentLogins.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span className="font-medium">{r.username || "-"}</span>
                      <span className="text-xs text-slate-500">
                        {r.login_time ? new Date(r.login_time).toLocaleString() : "-"}
                      </span>
                    </div>
                  )) || <div className="text-xs text-slate-500">No recent logins</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button type="button" className="btn-success" onClick={run} disabled={loading}>
                {loading ? "Running..." : "Run Report"}
              </button>
              <button type="button" className="btn-success" onClick={() => { setFrom(""); setTo(""); }} disabled={loading}>
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Reference</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event_time ? new Date(r.event_time).toLocaleString() : "-"}</td>
                    <td>{r.user_name || "-"}</td>
                    <td>{r.module_name || "-"}</td>
                    <td>{r.action || "-"}</td>
                    <td className="font-medium">{r.ref_no || "-"}</td>
                    <td>{r.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? <div className="text-center py-10">No rows.</div> : null}
        </div>
      </div>
    </div>
  );
}

