import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

export default function PosReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dailyItems, setDailyItems] = useState([]);
  const [paymentItems, setPaymentItems] = useState([]);
  const [topItems, setTopItems] = useState([]);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setEndDate(`${yyyy}-${mm}-${dd}`);
    const lastWeek = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const lyyyy = lastWeek.getFullYear();
    const lmm = String(lastWeek.getMonth() + 1).padStart(2, "0");
    const ldd = String(lastWeek.getDate()).padStart(2, "0");
    setStartDate(`${lyyyy}-${lmm}-${ldd}`);
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/pos/reports/daily-sales", { params: { startDate, endDate } }),
      api.get("/pos/reports/payment-breakdown", {
        params: { startDate, endDate },
      }),
      api.get("/pos/reports/top-items", {
        params: { startDate, endDate, limit: 20 },
      }),
    ])
      .then(([dailyRes, payRes, topRes]) => {
        if (!mounted) return;
        setDailyItems(
          Array.isArray(dailyRes.data?.items) ? dailyRes.data.items : [],
        );
        setPaymentItems(
          Array.isArray(payRes.data?.items) ? payRes.data.items : [],
        );
        setTopItems(Array.isArray(topRes.data?.items) ? topRes.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load reports");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [startDate, endDate]);

  const fmtCurrency = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/pos"
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to POS
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          POS Reports
        </h1>
        <p className="text-sm mt-1">Sales analytics and end-of-day reporting</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-3">
            <div className="text-sm">Start</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <div className="text-sm">End</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <span className="badge">{loading ? "Loading" : "Updated"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Daily Sales Summary</div>
            <div className="text-xs text-slate-500">Totals per day</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyItems.map((d, idx) => (
                    <tr key={idx}>
                      <td>{String(d.date)}</td>
                      <td className="text-right">
                        {Number(d.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right">{fmtCurrency(d.gross)}</td>
                      <td className="text-right">{fmtCurrency(d.discount)}</td>
                      <td className="text-right">{fmtCurrency(d.tax)}</td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(d.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Payment Method Breakdown</div>
            <div className="text-xs text-slate-500">Totals by method</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentItems.map((p, idx) => (
                    <tr key={idx}>
                      <td>{String(p.method || "").toUpperCase()}</td>
                      <td className="text-right">
                        {Number(p.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-slate-50 rounded-t-lg">
          <div className="font-semibold">Top Selling Items</div>
          <div className="text-xs text-slate-500">Best performers</div>
        </div>
        <div className="card-body">
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((t, idx) => (
                  <tr key={idx}>
                    <td>{String(t.item || "")}</td>
                    <td className="text-right">
                      {Number(t.qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-semibold">
                      {fmtCurrency(t.amount)}
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
