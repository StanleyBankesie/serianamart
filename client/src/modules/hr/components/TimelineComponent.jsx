import React from "react";

export default function TimelineComponent({ items }) {
  return (
    <div className="space-y-3">
      {(items || []).map((it, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-600 mt-1.5" />
          <div className="text-sm">
            <div className="font-medium">{it.title}</div>
            <div className="text-slate-600 dark:text-slate-300">{it.description}</div>
            <div className="text-xs text-slate-500">{it.time}</div>
          </div>
        </div>
      ))}
      {!items?.length ? <div className="text-sm">No history</div> : null}
    </div>
  );
}
