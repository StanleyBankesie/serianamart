import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";
import ChartPie from "@/components/charts/ChartPie.jsx";

function shade(c, pct) {
  const n = c.replace("#", "");
  const num = parseInt(
    n.length === 3
      ? n
          .split("")
          .map((x) => x + x)
          .join("")
      : n,
    16,
  );
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const nr = Math.round((t - r) * p + r);
  const ng = Math.round((t - g) * p + g);
  const nb = Math.round((t - b) * p + b);
  return `rgb(${nr},${ng},${nb})`;
}

function BarChart({
  data,
  xKey,
  yKey,
  height = 160,
  xLabel,
  yLabel,
  formatY,
  color = "#3b82f6",
}) {
  const max = Math.max(1, ...data.map((d) => Number(d[yKey] || 0)));
  const topPad = 18;
  const bars = data.map((d) => ({
    label: String(d[xKey]),
    value: Number(d[yKey] || 0),
    h: Math.round((Number(d[yKey] || 0) / max) * (height - topPad)),
  }));
  return (
    <div className="w-full">
      <div className="flex items-end gap-4 w-full" style={{ height }}>
        {bars.map((b, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="text-[10px] font-semibold">
              {formatY
                ? formatY(b.value)
                : Number(b.value || 0).toLocaleString()}
            </div>
            <div
              className="w-8 rounded-t"
              style={{
                height: `${Math.max(4, b.h)}px`,
                backgroundImage: `linear-gradient(${shade(color, 0.35)}, ${color})`,
                boxShadow:
                  "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15), 3px -3px 0 rgba(0,0,0,0.08)",
              }}
              title={`${b.label} • ${formatY ? formatY(b.value) : b.value.toLocaleString()}`}
            />
            <div className="text-[10px] mt-1 text-center w-12 truncate">
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({
  points,
  height = 220,
  xLabel,
  yLabel,
  formatY,
  color = "#ef4444",
  areaColor = "rgba(239,68,68,0.2)",
  showXLabels = false,
  showAmounts = true,
  scrollX = false,
}) {
  const maxY = Math.max(1, ...points.map((p) => Number(p.y || 0)));
  const xLabelH = showXLabels ? 56 : 0;
  const chartH = height - xLabelH;
  const w = Math.max(720, points.length * 92);
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(chartH - (Number(p.y || 0) / maxY) * chartH);
    return { x, y, label: p.x, value: Number(p.y || 0) };
  });
  const path = coords.length
    ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
    : `M 0 ${chartH}`;
  const area = coords.length
    ? `${path} L ${coords[coords.length - 1].x} ${chartH} L 0 ${chartH} Z`
    : `M 0 ${chartH} L ${w} ${chartH}`;
  const svg = (
    <svg
      width={scrollX ? "100%" : "100%"}
      style={scrollX ? { minWidth: `${w}px` } : undefined}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio={scrollX ? "xMinYMin" : "none"}
    >
      <path d={area} fill={areaColor} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {coords.map((c, idx) => (
        <g key={idx}>
          <circle cx={c.x} cy={c.y} r="3" fill={color} />
          {showAmounts ? (
            <text
              x={c.x}
              y={Math.max(10, c.y - 6)}
              fontSize="13"
              textAnchor="middle"
              fill="#0f172a"
              fontWeight="600"
            >
              {formatY ? formatY(c.value) : c.value.toLocaleString()}
            </text>
          ) : null}
          {showXLabels ? (
            <text
              x={c.x}
              y={height - 16}
              fontSize="13"
              textAnchor="end"
              transform={`rotate(-20 ${c.x} ${height - 16})`}
              fill="#334155"
              fontWeight="600"
            >
              {c.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
  return (
    <div className="w-full">
      {scrollX ? <div className="overflow-x-auto pb-2">{svg}</div> : svg}
    </div>
  );
}

function PieChart({ data, label }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[240px] text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <div className="text-2xl mb-2">📊</div>
        <div className="text-sm">No data available for this period</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
      <div className="w-full max-w-[280px] h-[280px] relative">
        <ChartPie data={data} donut={data.length > 1} height={280} />
      </div>
      <div className="flex-1 w-full pr-2">
        <div className="text-xs space-y-2">
          {label ? (
            <div className="font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100">
              {label}
            </div>
          ) : null}
          {data.map((d, idx) => {
            const palette = [
              "#6366f1",
              "#22c55e",
              "#ef4444",
              "#f59e0b",
              "#06b6d4",
              "#a855f7",
              "#0ea5e9",
              "#84cc16",
              "#fb7185",
              "#f97316",
            ];
            const color = palette[idx % palette.length];
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded transition-colors"
              >
                <span
                  className="inline-block w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-slate-600 truncate">
                  {d.label}
                </span>
                <span className="font-bold text-slate-900">
                  {Number(d.value || 0).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupedBarChart({
  categories,
  series,
  height = 160,
  xLabel,
  yLabel,
  formatY,
}) {
  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => categories.map((c) => Number(s.data[c] || 0))),
  );
  const w = Math.max(240, categories.length * 80);
  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-6" style={{ height, minWidth: w }}>
          {categories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 px-1">
              <div className="flex items-end gap-3">
                {series.map((s, j) => {
                  const val = Number(s.data[cat] || 0);
                  const h = Math.round((val / maxVal) * height);
                  return (
                    <div
                      key={j}
                      className="rounded-t"
                      style={{
                        width: 16,
                        height: `${Math.max(4, h)}px`,
                        backgroundImage: `linear-gradient(${shade(s.color, 0.35)}, ${s.color})`,
                        boxShadow:
                          "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15), 2px -2px 0 rgba(0,0,0,0.08)",
                      }}
                      title={`${s.label} @ ${cat} • ${formatY ? formatY(val) : val.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              <div className="text-[13px] font-semibold text-slate-600 text-center w-full truncate">
                {cat}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBarChart({
  data,
  height = 160,
  xLabel,
  yLabel,
  formatY,
  color = "#3b82f6",
}) {
  const values = data.map((d) => Number(d.total || 0));
  const posMax = Math.max(0, ...values.filter((v) => v >= 0));
  const negMax = Math.max(
    0,
    ...values.filter((v) => v < 0).map((v) => Math.abs(v)),
  );
  const totalRange = posMax + negMax || 1;
  const posHeight = Math.round((posMax / totalRange) * height);
  const baselineY = height - posHeight;
  const chartWidth = Math.max(240, data.length * 36);
  const chartHeight = height + 24;
  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ minWidth: `${chartWidth}px` }}
      >
        <line
          x1="0"
          y1={baselineY}
          x2={chartWidth}
          y2={baselineY}
          stroke="#94a3b8"
          strokeWidth="1"
        />
        {data.map((d, idx) => {
          const v = Number(d.total || 0);
          const barHeight =
            Math.round((Math.abs(v) / totalRange) * height) || 0;
          const x = idx * 36 + 12;
          const y = v >= 0 ? baselineY - barHeight : baselineY;
          return (
            <g key={idx}>
              <rect x={x} y={y} width="16" height={barHeight} fill={color} />
              <text
                x={x + 8}
                y={v >= 0 ? y - 4 : y + barHeight + 10}
                fontSize="13"
                textAnchor="middle"
                fill="#0f172a"
                fontWeight="600"
              >
                {formatY ? formatY(v) : v.toLocaleString()}
              </text>
              <text
                x={x + 8}
                y={chartHeight - 4}
                fontSize="14"
                textAnchor="middle"
                fill="#64748b"
                fontWeight="600"
              >
                {String(d.label || "")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function PosDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [daySummary, setDaySummary] = useState(null);
  const [terminalMethod, setTerminalMethod] = useState([]);
  const [userDaySales, setUserDaySales] = useState([]);
  const [sales30, setSales30] = useState([]);
  const [salesMonthly, setSalesMonthly] = useState([]);
  const [weekdaySales, setWeekdaySales] = useState([]);
  const [hourlyToday, setHourlyToday] = useState([]);
  const [categoryShare, setCategoryShare] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [daysRange, setDaysRange] = useState(30);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [showTrendAmounts, setShowTrendAmounts] = useState(true);
  const [showMonthlyAmounts, setShowMonthlyAmounts] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");

  const dateLabel = useMemo(() => {
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return "Today";
  }, [startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    const dateParams = { startDate, endDate };
    const trendParams = { days: daysRange };
    Promise.all([
      api.get("/pos/analytics/day-summary", { params: dateParams }),
      api.get("/pos/analytics/day-terminal-methods", { params: dateParams }),
      api.get("/pos/analytics/day-user-sales", { params: dateParams }),
      api.get("/pos/analytics/sales-30-days", { params: trendParams }),
      api.get("/pos/analytics/sales-monthly"),
      api.get("/pos/analytics/weekday-current-week"),
      api.get("/pos/analytics/hourly-today", { params: dateParams }),
      api.get("/pos/analytics/category-share", { params: dateParams }),
      api.get("/pos/reports/top-items", {
        params: { ...dateParams, limit: 10 },
      }),
    ])
      .then(
        ([
          daySummaryRes,
          terminalMethodRes,
          userDayRes,
          sales30Res,
          salesMonthlyRes,
          weekdayRes,
          hourlyRes,
          categoryRes,
          topRes,
        ]) => {
          if (!mounted) return;
          setDaySummary(daySummaryRes.data?.summary || null);
          setTerminalMethod(
            Array.isArray(terminalMethodRes.data?.items)
              ? terminalMethodRes.data.items
              : [],
          );
          setUserDaySales(
            Array.isArray(userDayRes.data?.items) ? userDayRes.data.items : [],
          );
          setSales30(
            Array.isArray(sales30Res.data?.items) ? sales30Res.data.items : [],
          );
          setSalesMonthly(
            Array.isArray(salesMonthlyRes.data?.items)
              ? salesMonthlyRes.data.items
              : [],
          );
          setWeekdaySales(
            Array.isArray(weekdayRes.data?.items) ? weekdayRes.data.items : [],
          );
          setHourlyToday(
            Array.isArray(hourlyRes.data?.items) ? hourlyRes.data.items : [],
          );
          setCategoryShare(
            Array.isArray(categoryRes.data?.items)
              ? categoryRes.data.items
              : [],
          );
          setTopItems(
            Array.isArray(topRes.data?.items)
              ? [...topRes.data.items].sort(
                  (a, b) => Number(b.qty || 0) - Number(a.qty || 0),
                )
              : [],
          );
        },
      )
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load dashboard");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [startDate, endDate, daysRange]);

  const paymentBars = useMemo(() => {
    const s = daySummary || {};
    return [
      { method: "Cash", amount: Number(s.cashAmount || 0) },
      { method: "Card", amount: Number(s.cardAmount || 0) },
      { method: "Mobile", amount: Number(s.mobileAmount || 0) },
    ];
  }, [daySummary]);

  const terminalGrouped = useMemo(() => {
    const cats = terminalMethod.map((r) => String(r.terminal || "UNKNOWN"));
    const uniqCats = Array.from(new Set(cats));
    const series = [
      { label: "Mobile Money", key: "mobile_total", color: "#3b82f6" },
      { label: "Cash", key: "cash_total", color: "#22c55e" },
      { label: "Card", key: "card_total", color: "#f59e0b" },
    ].map((s) => ({
      label: s.label,
      color: s.color,
      data: Object.fromEntries(
        uniqCats.map((c) => {
          const row = terminalMethod.find(
            (r) => String(r.terminal || "UNKNOWN") === c,
          );
          return [c, Number(row ? row[s.key] || 0 : 0)];
        }),
      ),
    }));
    return { categories: uniqCats, series };
  }, [terminalMethod]);

  const userBars = useMemo(
    () =>
      userDaySales.map((u) => ({
        label: String(u.user_label || ""),
        total: Number(u.total || 0),
      })),
    [userDaySales],
  );

  const sales30Points = useMemo(
    () =>
      sales30.map((d) => {
        const dateStr = String(d.date || "");
        return { x: dateStr.split("T")[0], y: Number(d.total || 0) };
      }),
    [sales30],
  );
  const salesMonthlyPoints = useMemo(
    () =>
      salesMonthly.map((d) => ({ x: String(d.ym), y: Number(d.total || 0) })),
    [salesMonthly],
  );
  const monthOptions = useMemo(
    () => [...new Set(salesMonthlyPoints.map((p) => p.x))].sort(),
    [salesMonthlyPoints],
  );

  useEffect(() => {
    if (selectedMonth !== "all" && !monthOptions.includes(selectedMonth)) {
      setSelectedMonth("all");
    }
  }, [monthOptions, selectedMonth]);
  const filteredMonthlyPoints = useMemo(
    () =>
      selectedMonth === "all"
        ? salesMonthlyPoints
        : salesMonthlyPoints.filter((p) => p.x === selectedMonth),
    [salesMonthlyPoints, selectedMonth],
  );
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const formatMonth = (ym) => {
    if (!ym || !ym.includes("-")) return ym;
    const [y, m] = ym.split("-");
    return `${monthNames[parseInt(m, 10) - 1] || m} ${y}`;
  };
  const formattedMonthlyPoints = useMemo(
    () => filteredMonthlyPoints.map((p) => ({ ...p, x: formatMonth(p.x) })),
    [filteredMonthlyPoints],
  );

  const weekdayLabels = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const weekdayBars = useMemo(() => {
    const map = new Map();
    for (const r of weekdaySales)
      map.set(Number(r.dow || 0), Number(r.total || 0));
    return weekdayLabels.map((label, idx) => ({
      label,
      total: Number(map.get(((idx + 1) % 7) + 1) || 0),
    }));
  }, [weekdaySales]);

  const hourlyPoints = useMemo(() => {
    const map = new Map();
    for (const r of hourlyToday) {
      map.set(Number(r.hr || 0), Number(r.total || 0));
    }
    return Array.from({ length: 16 }, (_, i) => {
      const h = i + 7;
      return {
        x: `${String(h).padStart(2, "0")}-${String(h + 1).padStart(2, "0")}`,
        y: Number(map.get(h) || 0),
      };
    });
  }, [hourlyToday]);

  const pieData = useMemo(() => {
    const totals = new Map();
    for (const row of categoryShare) {
      const label = String(row.category || "Uncategorized");
      const value = Number(row.total || 0);
      if (value <= 0) continue;
      totals.set(label, Number(totals.get(label) || 0) + value);
    }
    return Array.from(totals.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }, [categoryShare]);
  const fmtCurrency = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Dashboard
          </h1>
          <p className="text-sm mt-1">{dateLabel} sales analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input text-xs py-1 px-2 w-36"
          />
          <span className="badge">{loading ? "Loading" : "Updated"}</span>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="text-xl font-bold text-slate-800">
              Terminal Collection
            </div>
            <div className="text-sm text-slate-500">
              Terminals grouped by payment ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <GroupedBarChart
              categories={terminalGrouped.categories}
              series={terminalGrouped.series}
              xLabel="Terminal"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>

        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="text-xl font-bold text-slate-800">Users Sales</div>
            <div className="text-sm text-slate-500">
              By cashier ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <UserBarChart
              data={userBars}
              xLabel="User"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-800">
                Sales Trend
              </div>
              <div className="text-sm text-slate-500">
                Last {daysRange} days
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showTrendAmounts}
                onChange={(e) => setShowTrendAmounts(e.target.checked)}
                className="accent-brand"
              />
              Amounts
            </label>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <div className="flex items-center gap-3 mb-4 bg-slate-50 p-2 rounded-lg">
              <span className="text-sm font-semibold text-slate-600">
                Days Range:
              </span>
              <input
                type="range"
                min={7}
                max={60}
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
                className="flex-1 accent-brand"
              />
              <span className="badge-primary text-xs px-2 py-0.5">
                {daysRange}d
              </span>
            </div>
            <LineChart
              points={sales30Points}
              xLabel="Date"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              showXLabels
              showAmounts={showTrendAmounts}
              scrollX
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-800">
                Month-to-Month Sales
              </div>
              <div className="text-sm text-slate-500">{dateLabel}</div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input text-sm py-1 px-2 w-36 border-slate-200"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={showMonthlyAmounts}
                  onChange={(e) => setShowMonthlyAmounts(e.target.checked)}
                  className="accent-brand"
                />
                Amounts
              </label>
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={formattedMonthlyPoints}
              xLabel="Month"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              showXLabels
              showAmounts={showMonthlyAmounts}
              scrollX
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Weekday Sales</div>
            <div className="text-[11px] text-slate-500">
              Monday to Sunday performance
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <BarChart
              data={weekdayBars}
              xKey="label"
              yKey="total"
              xLabel="Weekday"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#0ea5e9"
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Hourly Sales</div>
            <div className="text-[11px] text-slate-500">
              07:00 to 23:00 ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={hourlyPoints}
              xLabel="Hour"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#2563eb"
              areaColor="rgba(37,99,235,0.15)"
              showXLabels
              scrollX
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1">
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Busy Sales Hours</div>
            <div className="text-[11px] text-slate-500">
              Heatmap emphasis by hour ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <LineChart
              points={hourlyPoints}
              xLabel="Hour"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#22c55e"
              areaColor="rgba(34,197,94,0.2)"
              showXLabels
              scrollX
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">
              Sales by Item Category
            </div>
            <div className="text-[11px] text-slate-500">{dateLabel}</div>
          </div>
          <div className="card-body overflow-x-auto p-4">
            <BarChart
              data={pieData}
              xKey="label"
              yKey="value"
              xLabel="Category"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#8b5cf6"
            />
          </div>
        </div>
        <div className="card shadow-sm border-slate-200/60">
          <div className="card-header bg-slate-50/80 rounded-t-lg border-b border-slate-200/60">
            <div className="font-bold text-slate-800">Top Selling Items</div>
            <div className="text-[11px] text-slate-500">
              Best performers by quantity ({dateLabel})
            </div>
          </div>
          <div className="card-body overflow-x-auto p-0">
            <div className="overflow-x-auto">
              <table className="table table-compact w-full">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-600">
                      Item
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-600">
                      Qty
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-600 w-32">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topItems.length > 0 ? (
                    topItems.map((t, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                          {String(t.item || "")}
                        </td>
                        <td className="text-right py-3 px-4 text-sm font-bold text-brand">
                          {Number(t.qty || 0).toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-4 text-sm font-semibold text-slate-600">
                          {fmtCurrency(t.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-slate-400 text-sm"
                      >
                        No items found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
