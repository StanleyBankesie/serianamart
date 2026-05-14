import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function UserLoginActivityReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const u = res?.data?.data?.items || res?.data?.items || [];
        setUsers(u);
      } catch {}
    }
    loadUsers();
  }, []);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/admin/reports/user-login-activity", {
        params: { from: from || null, to: to || null, user_id: userId || null, filter },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => run(), 300);
    return () => clearTimeout(t);
  }, [from, to, userId, filter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">User Activities</h1>
            <p className="text-sm mt-1">Pages accessed, modules used, and login events</p>
          </div>
          <Link to="/administration" className="btn btn-secondary">Return to Menu</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="label">User</label>
              <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username || u.full_name || `User #${u.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Events</option>
                <option value="page">Page Access</option>
                <option value="login">Logins</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn-secondary" onClick={() => { setFrom(today); setTo(today); setUserId(""); setFilter("all"); }}>Clear</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Page / Event</th>
                  <th>IP Address</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event_time ? new Date(r.event_time).toLocaleString() : "-"}</td>
                    <td>{r.user_name || r.username || "-"}</td>
                    <td>{r.module_name || "-"}</td>
                    <td>{r.page_name || r.action || r.ref_no || "-"}</td>
                    <td>{r.ip_address || "-"}</td>
                    <td>{r.location || "-"}</td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500">No activity found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && <div className="text-center py-4 text-slate-500">Loading...</div>}
        </div>
      </div>
    </div>
  );
}
