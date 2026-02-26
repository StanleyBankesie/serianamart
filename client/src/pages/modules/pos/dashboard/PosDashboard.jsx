import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

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
  const bars = data.map((d) => ({
    label: String(d[xKey]),
    value: Number(d[yKey] || 0),
    h: Math.round((Number(d[yKey] || 0) / max) * height),
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
                backgroundColor: color,
              }}
              title={`${b.label} • ${formatY ? formatY(b.value) : b.value.toLocaleString()}`}
            />
            <div className="text-[10px] mt-1 text-center w-12 truncate">
              {b.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-slate-500">{yLabel || ""}</div>
        <div className="text-[10px] text-slate-500">{xLabel || ""}</div>
      </div>
    </div>
  );
}

function LineChart({
  points,
  height = 180,
  xLabel,
  yLabel,
  formatY,
  color = "#ef4444",
  areaColor = "rgba(239,68,68,0.2)",
}) {
  const maxY = Math.max(1, ...points.map((p) => Number(p.y || 0)));
  const w = Math.max(240, points.length * 32);
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(height - (Number(p.y || 0) / maxY) * height);
    return { x, y, label: p.x, value: Number(p.y || 0) };
  });
  const path = coords.length
    ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
    : `M 0 ${height}`;
  const area = coords.length
    ? `${path} L ${coords[coords.length - 1].x} ${height} L 0 ${height} Z`
    : `M 0 ${height} L ${w} ${height}`;
  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
      >
        <path d={area} fill={areaColor} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {coords.map((c, idx) => (
          <g key={idx}>
            <circle cx={c.x} cy={c.y} r="3" fill={color} />
            <text
              x={c.x}
              y={Math.max(10, c.y - 6)}
              fontSize="10"
              textAnchor="middle"
              fill="#0f172a"
            >
              {formatY ? formatY(c.value) : c.value.toLocaleString()}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-slate-500">{yLabel || ""}</div>
        <div className="text-[10px] text-slate-500">{xLabel || ""}</div>
      </div>
    </div>
  );
}

function PieChart({ data, size = 160, label }) {
  const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const r = size / 2;
  const cx = r;
  const cy = r;
  let acc = 0;
  const slices = data.map((d, idx) => {
    const v = Number(d.value || 0);
    const frac = total ? v / total : 0;
    const start = acc * 2 * Math.PI;
    const end = (acc + frac) * 2 * Math.PI;
    acc += frac;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    const colors = [
      "#0e3646",
      "#0f6b83",
      "#12a3bf",
      "#5cc2d4",
      "#9bd9e2",
      "#cfeef1",
      "#fcd34d",
      "#fb7185",
    ];
    const fill = colors[idx % colors.length];
    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      fill,
      label: d.label,
      value: v,
    };
  });
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size}>
        {slices.map((s, idx) => (
          <path key={idx} d={s.d} fill={s.fill} />
        ))}
      </svg>
      <div className="text-xs space-y-1">
        {label ? (
          <div className="font-semibold text-slate-600 mb-1">{label}</div>
        ) : null}
        {data.map((d, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{
                backgroundColor: [
                  "#0e3646",
                  "#0f6b83",
                  "#12a3bf",
                  "#5cc2d4",
                  "#9bd9e2",
                  "#cfeef1",
                  "#fcd34d",
                  "#fb7185",
                ][idx % 8],
              }}
            />
            <span className="flex-1">{d.label}</span>
            <span className="font-semibold">
              {Number(d.value || 0).toLocaleString()}
            </span>
          </div>
        ))}
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
  return (
    <div className="w-full">
      <div className="flex items-end gap-3 w-full" style={{ height }}>
        {categories.map((cat, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="flex items-end gap-1">
              {series.map((s, j) => {
                const val = Number(s.data[cat] || 0);
                const h = Math.round((val / maxVal) * height);
                return (
                  <div
                    key={j}
                    className="rounded-t"
                    style={{
                      width: 10,
                      height: `${Math.max(4, h)}px`,
                      backgroundColor: s.color,
                    }}
                    title={`${s.label} @ ${cat} • ${formatY ? formatY(val) : val.toLocaleString()}`}
                  />
                );
              })}
            </div>
            <div className="text-[10px] mt-1 text-center w-16 truncate">
              {cat}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-slate-500">{yLabel || ""}</div>
        <div className="text-[10px] text-slate-500">{xLabel || ""}</div>
      </div>
      <div className="flex gap-4 mt-2">
        {series.map((s, j) => (
          <div
            key={j}
            className="flex items-center gap-2 text-[10px] text-slate-600"
          >
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: s.color }}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserBarChart({
  data,
  height = 180,
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
  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${data.length * 36} ${height}`}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={baselineY}
          x2={data.length * 36}
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
                fontSize="10"
                textAnchor="middle"
                fill="#0f172a"
              >
                {formatY ? formatY(v) : v.toLocaleString()}
              </text>
              <text
                x={x + 8}
                y={height - 2}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {String(d.label || "")}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-slate-500">{yLabel || ""}</div>
        <div className="text-[10px] text-slate-500">{xLabel || ""}</div>
      </div>
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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/pos/analytics/day-summary"),
      api.get("/pos/analytics/day-terminal-methods"),
      api.get("/pos/analytics/day-user-sales"),
      api.get("/pos/analytics/sales-30-days"),
      api.get("/pos/analytics/sales-monthly"),
      api.get("/pos/analytics/weekday-current-week"),
      api.get("/pos/analytics/hourly-today"),
      api.get("/pos/analytics/category-share"),
      api.get("/pos/reports/top-items", { params: { limit: 10 } }),
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
            Array.isArray(topRes.data?.items) ? topRes.data.items : [],
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
  }, []);

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
    () => sales30.map((d) => ({ x: String(d.date), y: Number(d.total || 0) })),
    [sales30],
  );
  const salesMonthlyPoints = useMemo(
    () =>
      salesMonthly.map((d) => ({ x: String(d.ym), y: Number(d.total || 0) })),
    [salesMonthly],
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

  const pieData = useMemo(
    () =>
      categoryShare.map((r) => ({
        label: String(r.category || "Uncategorized"),
        value: Number(r.total || 0),
      })),
    [categoryShare],
  );
  const fmtCurrency = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
          <p className="text-sm mt-1">Today and recent sales analytics</p>
        </div>
        <div className="text-right">
          <span className="badge">{loading ? "Loading" : "Updated"}</span>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Terminal Collection (Today)</div>
            <div className="text-xs text-slate-500">
              Terminals on X; Sales grouped by payment
            </div>
          </div>
          <div className="card-body">
            <GroupedBarChart
              categories={terminalGrouped.categories}
              series={terminalGrouped.series}
              xLabel="Terminal"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Users Sales (Today)</div>
            <div className="text-xs text-slate-500">By cashier</div>
          </div>
          <div className="card-body">
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
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Sales Trend</div>
            <div className="text-xs text-slate-500">Last {daysRange} days</div>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px]">Days</span>
              <input
                type="range"
                min={7}
                max={60}
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
              />
              <span className="badge">{daysRange}</span>
            </div>
            <LineChart
              points={sales30Points.slice(-daysRange)}
              xLabel="Date"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Month-to-Month Sales</div>
            <div className="text-xs text-slate-500">Last 12 months</div>
          </div>
          <div className="card-body">
            <LineChart
              points={salesMonthlyPoints}
              xLabel="Month"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Weekday Sales</div>
            <div className="text-xs text-slate-500">Monday to Sunday</div>
          </div>
          <div className="card-body">
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
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Hourly Sales (Today)</div>
            <div className="text-xs text-slate-500">07–08 to 22–23</div>
          </div>
          <div className="card-body">
            <LineChart
              points={hourlyPoints}
              xLabel="Date"
              yLabel="Sales (GH₵)"
              formatY={fmtCurrency}
              color="#2563eb"
              areaColor="rgba(37,99,235,0.2)"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Sales by Item Category</div>
            <div className="text-xs text-slate-500">Last 30 days</div>
          </div>
          <div className="card-body">
            <PieChart data={pieData} label="Category • Sales (GH₵)" />
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Top Selling Items</div>
            <div className="text-xs text-slate-500">
              Best performers (Today)
            </div>
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
    </div>
  );
}
