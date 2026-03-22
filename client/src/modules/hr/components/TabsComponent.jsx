import React from "react";

export default function TabsComponent({ tabs, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b mb-3">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`px-3 py-2 text-sm ${value === t.value ? "border-b-2 border-brand-600" : ""}`}
            onClick={() => onChange?.(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.value === value)?.content}</div>
    </div>
  );
}
