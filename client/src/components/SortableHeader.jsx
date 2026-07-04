/**
 * @fileoverview A table header component that supports clickable sorting.
 * Displays interactive up/down arrows indicating the current sort direction.
 */

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Determines the justify-content class based on text alignment classes.
 * @param {string} className - The CSS classes.
 * @returns {string} The justify class string.
 */
function getJustifyClass(className) {
  if (className.includes("text-right")) return "justify-end";
  if (className.includes("text-center")) return "justify-center";
  return "justify-start";
}

/**
 * SortableHeader component
 * 
 * @param {Object} props
 * @param {string} props.label - The visible text label for the column header.
 * @param {string} props.sortKey - The underlying data key associated with this column.
 * @param {string} props.currentKey - The key that is currently being sorted by the table.
 * @param {string} props.direction - The current sort direction ('asc' or 'desc').
 * @param {Function} props.onToggle - Callback triggered when the header is clicked, passing the `sortKey`.
 * @param {string} [props.className=""] - Additional CSS classes.
 * @returns {JSX.Element} The rendered table header cell (`<th>`).
 */
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
      className={`select-none font-bold transition-colors ${active ? "bg-sky-50 text-sky-700" : "text-slate-700 hover:text-brand-700"} ${className}`}
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
