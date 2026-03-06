import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function MonthlySalesTrendReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/monthly-sales-trend");
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

  function growthPercent(cur, prev) {
    if (!prev) return 0;
    return Math.round(((cur - prev) * 100) / prev);
  }

  const rows = items
    .map((r) => ({
      month_start: r.month_start,
      total_invoices: Number(r.total_invoices || 0),
      total_revenue: Number(r.total_revenue || 0),
      total_discounts: Number(r.total_discounts || 0),
    }))
    .sort((a, b) => new Date(a.month_start) - new Date(b.month_start))
    .map((r, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const g = prev ? growthPercent(r.total_revenue, prev.total_revenue) : 0;
      return { ...r, growth_percent: g };
    });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Monthly Sales Trend
            </h1>
            <p className="text-sm mt-1">
              Executive overview of monthly performance
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Total Invoices</th>
                  <th className="text-right">Total Revenue</th>
                  <th className="text-right">Total Discounts</th>
                  <th className="text-right">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">
                      {r.month_start
                        ? new Date(r.month_start).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                          })
                        : "-"}
                    </td>
                    <td className="text-right">{r.total_invoices}</td>
                    <td className="text-right">
                      {r.total_revenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {r.total_discounts.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">{r.growth_percent}%</td>
                  </tr>
                ))}
                {!rows.length && !loading ? (
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

