import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";

export default function FiscalYearsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/fiscal-years");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load fiscal years");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/fiscal-years", {
        code: code.trim(),
        startDate,
        endDate,
        isOpen,
      });
      toast.success("Fiscal year created");
      setCode("");
      setStartDate("");
      setEndDate("");
      setIsOpen(true);
      load();
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to create fiscal year"
      );
    }
  }

  async function openYear(id) {
    try {
      await api.post(`/finance/fiscal-years/${id}/open`);
      toast.success("Fiscal year opened");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to open fiscal year");
    }
  }

  async function closeYear(id) {
    try {
      await api.post(`/finance/fiscal-years/${id}/close`);
      toast.success("Fiscal year closed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to close fiscal year");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Fiscal Years
            </h1>
            <p className="text-sm mt-1">
              Open and close fiscal periods, manage reporting ranges
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn btn-secondary"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form
            onSubmit={create}
            className="grid grid-cols-1 md:grid-cols-6 gap-3"
          >
            <div>
              <label className="label">Code *</label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Start Date *</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                />
                Set Open
              </label>
            </div>
            <div className="flex items-end">
              <button className="btn-success">Create</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td>
                      {r.start_date ? String(r.start_date).split("T")[0] : ""}
                    </td>
                    <td>
                      {r.end_date ? String(r.end_date).split("T")[0] : ""}
                    </td>
                    <td>
                      {r.is_open ? (
                        <span className="badge badge-success">Open</span>
                      ) : (
                        <span className="badge badge-error">Closed</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.is_open ? (
                          <button
                            className="btn"
                            onClick={() => closeYear(r.id)}
                          >
                            Close
                          </button>
                        ) : (
                          <button
                            className="btn"
                            onClick={() => openYear(r.id)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
