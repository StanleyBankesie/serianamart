import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function ServiceRequestSummaryReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/request-summary", {
        params: {
          from: from || null,
          to: to || null,
          status: status || null,
          priority: priority || null,
          customer: customer || null,
        },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Service Request Summary
            </h1>
            <p className="text-sm mt-1">Monitor incoming service demand</p>
          </div>
          <div className="flex gap-2">
            <Link to="/service-management" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option>Open</option>
                <option>In Progress</option>
                <option>Closed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Customer</label>
              <input
                className="input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Name contains..."
              />
            </div>
            <div className="md:col-span-6 flex items-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Request Date</th>
                  <th>Customer Name</th>
                  <th>Service Type</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>SLA Due Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.request_no}</td>
                    <td>{r.request_date || "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td>{r.service_type || "-"}</td>
                    <td>{r.priority || "-"}</td>
                    <td>{r.assigned_to || "-"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.sla_due_date || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
