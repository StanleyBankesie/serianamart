/**
 * @fileoverview VisitorsLogList component.
 * Provides functionality for VisitorsLogList.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function VisitorsLogList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    from_time: "",
    to_time: "",
    status: "",
    department: "",
    search: "",
  });
  const [departments, setDepartments] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    today: 0,
  });

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.from_time) params.from_time = filters.from_time;
      if (filters.to_time) params.to_time = filters.to_time;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;
      if (filters.search) params.search = filters.search;

      const res = await api.get("/visitors", { params });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load visitors log");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/visitors/dashboard/stats");
      setStats({
        total: res.data?.stats?.total_visitors || 0,
        active: res.data?.stats?.active_visitors || 0,
        completed: res.data?.stats?.completed_visits || 0,
        today: res.data?.stats?.today_visitors || 0,
      });
    } catch {
      // Silent fail for stats
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get("/visitors/metadata/departments");
      setDepartments(res.data?.items || []);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    loadVisitors();
    loadStats();
    loadDepartments();
  }, [loadVisitors, loadStats, loadDepartments]);

  function formatTime(time) {
    if (!time) return "-";
    return time;
  }

  function formatDate(date) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Total Visitors</div>
            <div className="text-2xl font-bold text-black">{stats.total}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Active (Checked In)</div>
            <div className="text-2xl font-bold text-black">{stats.active}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Completed Visits</div>
            <div className="text-2xl font-bold text-black">{stats.completed}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Today's Visitors</div>
            <div className="text-2xl font-bold text-black">{stats.today}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Visitors Log Book</h1>
              <p className="text-sm mt-1">Track and manage visitor records</p>
            </div>
            <div className="flex gap-2">
              <Link to="/service-management" className="btn-success text-sm">
                Back
              </Link>
              <Link to="new" className="btn-success text-sm">
                + New Visitor
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-4">
            <div>
              <label className="label text-xs">From Date</label>
              <input
                type="date"
                className="input input-sm"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label text-xs">From Time</label>
              <input
                type="time"
                className="input input-sm"
                value={filters.from_time}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from_time: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label text-xs">To Date</label>
              <input
                type="date"
                className="input input-sm"
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label text-xs">To Time</label>
              <input
                type="time"
                className="input input-sm"
                value={filters.to_time}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to_time: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label text-xs">Status</label>
              <select
                className="input input-sm"
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Department</label>
              <select
                className="input input-sm"
                value={filters.department}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, department: e.target.value }))
                }
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Search</label>
              <input
                type="text"
                className="input input-sm"
                placeholder="Name, phone, org..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
            </div>
          </div>



          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Visitor Name</th>
                  <th>Phone</th>
                  <th>Organisation</th>
                  <th>Department</th>
                  <th>Temp Address</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-slate-500">
                      No visitor records found
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.visitor_name}</td>
                      <td>{item.phone_number || "-"}</td>
                      <td>{item.organisation || "-"}</td>
                      <td>{item.department_visited || "-"}</td>
                      <td>{item.temp_address || "-"}</td>
                      <td>{formatDate(item.visit_date)}</td>
                      <td>{formatTime(item.time_in)}</td>
                      <td>{formatTime(item.time_out)}</td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            item.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link
                            to={`${item.id}/edit?mode=view`}
                            className="text-brand hover:text-brand-700 text-sm"
                          >
                            View
                          </Link>
                          <Link
                            to={`${item.id}/edit`}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Edit
                          </Link>
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
    </div>
  );
}
