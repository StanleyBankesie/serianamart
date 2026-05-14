import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function getJustifyClass(className) {
  if (className.includes("text-right")) return "justify-end";
  if (className.includes("text-center")) return "justify-center";
  return "justify-start";
}

export default function SortableHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onToggle,
  className = "",
}) {
  const active = currentKey === sortKey;
  const justifyClass = getJustifyClass(className);
  const ariaSort = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      className={`select-none transition-colors ${active ? "bg-sky-50 text-sky-700" : "text-slate-700 hover:text-brand-700"} ${className}`}
      title={`Sort by ${label}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-2 ${justifyClass} bg-transparent py-3 outline-none`}
        onClick={() => onToggle(sortKey)}
      >
        <span>{label}</span>
        <span
          className={`inline-flex flex-col leading-none ${
            active ? "text-sky-600" : "text-slate-500"
          }`}
          aria-hidden="true"
        >
          <ChevronUp
            className={`h-3 w-3 ${
              active && direction === "asc" ? "opacity-100" : "opacity-50"
            }`}
            strokeWidth={2.25}
          />
          <ChevronDown
            className={`-mt-1 h-3 w-3 ${
              active && direction === "desc" ? "opacity-100" : "opacity-50"
            }`}
            strokeWidth={2.25}
          />
        </span>
      </button>
    </th>
  );
}
