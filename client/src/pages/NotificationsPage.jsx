import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { toast } from "react-toastify";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const unread = useMemo(
    () => items.filter((n) => Number(n.is_read) !== 1).length,
    [items],
  );
  const visibleItems = useMemo(
    () => items.filter((n) => Number(n.is_read) !== 1),
    [items],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/workflows/notifications");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    try {
      await api.put(`/workflows/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Notifications
            </h1>
            <p className="text-slate-500 mt-1">
              {unread} unread • {items.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn btn-secondary">
              Home
            </Link>
            <button
              className="btn btn-outline"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Loading...
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    No notifications
                  </td>
                </tr>
              ) : (
                visibleItems.map((n) => (
                  <tr key={n.id} className="hover">
                    <td className="font-medium">{n.title}</td>
                    <td>{n.message}</td>
                    <td>
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {Number(n.is_read) === 1 ? (
                        <span className="badge bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-800">
                          Read
                        </span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800">
                          Unread
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {n.link ? (
                          <button
                            className="btn btn-ghost btn-xs text-blue-600"
                            onClick={() => navigate(n.link)}
                            title="Open"
                          >
                            Open
                          </button>
                        ) : null}
                        {Number(n.is_read) !== 1 ? (
                          <button
                            className="btn btn-ghost btn-xs text-slate-600"
                            onClick={() => markRead(n.id)}
                            title="Mark Read"
                          >
                            Mark Read
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
