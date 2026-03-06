import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";

function Card({ title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function MultiLineChart({ title, data, seriesDefs }) {
  const w = 780;
  const h = 300;
  const pad = 40;
  const max = Math.max(
    ...data.flatMap((d) => seriesDefs.map((s) => Number(d[s.key] || 0))),
    1,
  );
  const sx = (i) => pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
  const sy = (v) => h - pad - ((Number(v || 0) / max) * (h - pad * 2));
  const colors = ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7"];
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold">{title}</div>
        <div className="text-xs text-slate-500 flex items-center gap-3">
          {seriesDefs.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: colors[i % colors.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[300px]">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" />
        {[0.25, 0.5, 0.75].map((t, i) => {
          const y = h - pad - t * (h - pad * 2);
          return <line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#e2e8f0" />;
        })}
        {seriesDefs.map((s, i) => {
          const pts = data.map((d, idx) => [sx(idx), sy(d[s.key])]);
          return (
            <polyline
              key={s.key}
              points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="2"
            />
          );
        })}
        {data.map((d, idx) => (
          <text
            key={idx}
            x={sx(idx)}
            y={h - 8}
            fontSize="10"
            textAnchor="middle"
            fill="#64748b"
          >
            {(d.label || "").slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SimpleBarChart({ title, data, palette = [] }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 300;
  const pad = 40;
  const barW = Math.max(18, (w - pad * 2) / Math.max(data.length * 1.6, 1));
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const colors =
    palette.length
      ? palette
      : ["#4f46e5","#06b6d4","#22c55e","#f59e0b","#a855f7","#ef4444","#14b8a6","#8b5cf6","#f97316","#0ea5e9","#10b981"];
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-lg font-bold mb-3">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[300px]">
        {data.map((d, i) => {
          const x = pad + i * step + (step - barW) / 2;
          const vh = ((Number(d.value || 0) / max) * (h - pad * 2)) | 0;
          const y = h - pad - vh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={vh} fill={colors[i % colors.length]} rx="2" />
              <text x={x + barW / 2} y={h - 8} fontSize="10" textAnchor="middle" fill="#64748b">
                {String(d.label || "").slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ServiceDashboardPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [topN, setTopN] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = { top: topN };
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await api.get("/purchase/service/dashboard/metrics", { params });
        if (!mounted) return;
        setData(res.data || {});
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load service dashboard");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [from, to, topN]);

  const cards = data?.cards || {};
  const trend = data?.month_wise_trend || [];
  const topCategories = data?.top_categories || [];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold">Service Management Dashboard</h1>
              <p className="text-sm mt-1">Requests → Orders → Executions → Confirmations</p>
            </div>
            <div className="flex gap-2 items-center">
              <input type="date" className="input input-sm w-36" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
              <input type="date" className="input input-sm w-36" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
              <label className="text-sm">Top</label>
              <select className="input input-sm w-24" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                {[1,2,3,5,10,15,20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Link to="/service-management" className="btn btn-secondary">Return</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          {loading ? <div className="text-slate-500">Loading...</div> : null}
          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Card title="YTD Requests" value={cards.ytd_requests} />
                <Card title="MTD Requests" value={cards.mtd_requests} />
                <Card title="WTD Requests" value={cards.wtd_requests} />
                <Card title="YTD Orders" value={cards.ytd_orders} />
                <Card title="MTD Orders" value={cards.mtd_orders} />
                <Card title="WTD Orders" value={cards.wtd_orders} />
                <Card title="YTD Executions" value={cards.ytd_executions} />
                <Card title="MTD Executions" value={cards.mtd_executions} />
                <Card title="WTD Executions" value={cards.wtd_executions} />
                <Card title="YTD Confirmations" value={cards.ytd_confirmations} />
                <Card title="MTD Confirmations" value={cards.mtd_confirmations} />
                <Card title="WTD Confirmations" value={cards.wtd_confirmations} />
                <Card title="YTD Service Bill Value" value={cards.ytd_service_bill_value} />
                <Card title="MTD Service Bill Value" value={cards.mtd_service_bill_value} />
              </div>
              <div className="grid grid-cols-1">
                <MultiLineChart
                  title="Month-wise Service Trend"
                  data={trend}
                  seriesDefs={[
                    { key: "orders", label: "Orders" },
                    { key: "executions", label: "Executions" },
                    { key: "confirmations", label: "Confirmations" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1">
                <SimpleBarChart title={`Top ${topN} Service Categories`} data={topCategories} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
