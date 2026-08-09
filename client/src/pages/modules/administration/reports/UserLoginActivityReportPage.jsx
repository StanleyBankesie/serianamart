/**
 * @fileoverview UserLoginActivityReportPage component.
 * Modernized report for user system activities, logins, and page access logs.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { Activity, UserCheck, ShieldAlert, Calendar, Filter, Printer, Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function UserLoginActivityReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

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
  }, [pollingCounter]);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/admin/reports/user-login-activity", {
        params: { from: from || null, to: to || null, user_id: userId || null, filter },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load activity report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => run(), 300);
    return () => clearTimeout(t);
  }, [from, to, userId, filter, pollingCounter]);

  const totalLogs = items.length;
  const loginCount = items.filter(r => (r.page_name || r.action || "").toLowerCase().includes("login")).length;
  const pageAccessCount = totalLogs - loginCount;

  function exportExcel() {
    const exportData = items.map((r) => ({
      "Date & Time": r.event_time ? new Date(r.event_time).toLocaleString() : "-",
      User: r.user_name || r.username || "-",
      Module: r.module_name || "-",
      "Page / Event": r.page_name || r.action || r.ref_no || "-",
      "IP Address": r.ip_address || "-",
      Location: r.location || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UserActivity");
    XLSX.writeFile(wb, `user-activity-report-${from}-to-${to}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(16);
    doc.text("User Activity & Audit Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Period: ${from} to ${to} | Generated on ${new Date().toLocaleDateString()}`, 14, 22);

    let y = 30;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Date & Time", 14, y);
    doc.text("User", 55, y);
    doc.text("Module", 95, y);
    doc.text("Page / Event", 135, y);
    doc.text("IP Address", 210, y);
    doc.text("Location", 250, y);
    doc.line(14, y + 2, 280, y + 2);
    y += 7;

    doc.setFont("helvetica", "normal");
    items.slice(0, 40).forEach((r) => {
      doc.text(r.event_time ? new Date(r.event_time).toLocaleString().slice(0, 19) : "-", 14, y);
      doc.text(String(r.user_name || r.username || "-").slice(0, 20), 55, y);
      doc.text(String(r.module_name || "-").slice(0, 20), 95, y);
      doc.text(String(r.page_name || r.action || r.ref_no || "-").slice(0, 35), 135, y);
      doc.text(String(r.ip_address || "-").slice(0, 15), 210, y);
      doc.text(String(r.location || "-").slice(0, 15), 250, y);
      y += 6;
    });

    doc.save(`user-activity-report-${from}-to-${to}.pdf`);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-7 h-7" /> User Activity & Audit Report
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Monitor system navigation, user logins, and administrative module access
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary text-xs">Back</button></div>
              <button onClick={exportExcel} disabled={!items.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> Excel
              </button>
              <button onClick={exportPDF} disabled={!items.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => window.print()} className="btn btn-secondary text-xs flex items-center gap-1.5">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-brand bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Log Entries</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{totalLogs}</h3>
          </div>
          <Activity className="w-8 h-8 text-brand opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Login Events</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{loginCount}</h3>
          </div>
          <UserCheck className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>

        <div className="card p-4 border-l-4 border-blue-500 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Page Navigation Logs</p>
            <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{pageAccessCount}</h3>
          </div>
          <Filter className="w-8 h-8 text-blue-500 opacity-80" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">From Date</label>
            <input className="input w-full text-xs" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">To Date</label>
            <input className="input w-full text-xs" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">User</label>
            <select className="input w-full text-xs" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username || u.full_name || `User #${u.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">Event Type</label>
            <select className="input w-full text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Events</option>
              <option value="page">Page Access</option>
              <option value="login">Logins</option>
            </select>
          </div>
          <div>
            <button
              className="btn btn-secondary text-xs w-full flex items-center justify-center gap-1 py-2"
              onClick={() => { setFrom(today); setTo(today); setUserId(""); setFilter("all"); }}
            >
              <RefreshCw size={13} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Date & Time</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">User</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Module</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Page / Event</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">IP Address</th>
                  <th className="py-3.5 px-4 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Location</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading activity logs...</td></tr>
                ) : items.length > 0 ? (
                  items.map((r) => {
                    const isLogin = (r.page_name || r.action || "").toLowerCase().includes("login");
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                          {r.event_time ? new Date(r.event_time).toLocaleString() : "-"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-slate-100">
                          {r.user_name || r.username || "-"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-bold">
                            {r.module_name || "General"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
                            isLogin
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                          }`}>
                            {r.page_name || r.action || r.ref_no || "-"}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs font-mono text-slate-500">
                          {r.ip_address || "-"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {r.location || "-"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No activity records found for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
