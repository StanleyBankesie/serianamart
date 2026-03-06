import React, { useEffect, useRef } from "react";
import { loadChartJs } from "@/lib/loadChartJs.js";

export default function ChartPie({ data, donut = false, colors = [], height = 320 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadChartJs()
      .then((Chart) => {
        if (!mounted || !canvasRef.current) return;
        const labels = (data || []).map((d) => String(d.label || ""));
        const values = (data || []).map((d) => Number(d.value || 0));
        const palette =
          colors && colors.length
            ? colors
            : [
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
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
        const ctx = canvasRef.current.getContext("2d");
        chartRef.current = new Chart(ctx, {
          type: donut ? "doughnut" : "pie",
          data: {
            labels,
            datasets: [
              {
                data: values,
                backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "right" },
              tooltip: { enabled: true },
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [JSON.stringify(data), donut, colors.join("|")]);

  return (
    <div style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
