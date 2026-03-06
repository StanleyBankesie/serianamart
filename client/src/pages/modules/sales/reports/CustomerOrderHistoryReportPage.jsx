import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function CustomerOrderHistoryReportPage() {
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/customer-order-history", {
        params: { customer: customer || null },
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
              Customer Order History
            </h1>
            <p className="text-sm mt-1">Full customer transaction history</p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="label">Customer</label>
              <input
                className="input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Customer contains..."
              />
            </div>
            <div className="flex items-end">
              <button type="button" className="btn" onClick={run} disabled={loading}>
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.stage}</td>
                    <td>{r.ref_no}</td>
                    <td>{r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-"}</td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{r.notes || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
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

