import React, { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * SortableTable — wraps an existing table element and adds client-side
 * column sorting on click. Automatically attaches sort toggles on all <th>
 * elements that have a data-sort-key attribute.
 *
 * Usage:
 *   <SortableTable data={items} defaultSortKey="name">
 *     <table>
 *       <thead>
 *         <tr>
 *           <th data-sort-key="name">Name</th>
 *           <th data-sort-key="date">Date</th>
 *           <th>Actions (not sortable)</th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {sorted.map((row) => (<tr>...</tr>))}
 *       </tbody>
 *     </table>
 *   </SortableTable>
 */
export default function SortableTable({ children, data, defaultSortKey = "", defaultSortDir = "asc", className = "" }) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const toggle = useCallback((key) => {
    if (!key) return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !Array.isArray(data) || data.length === 0) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] == null ? "" : String(a[sortKey]).toLowerCase();
      const bVal = b[sortKey] == null ? "" : String(b[sortKey]).toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const getJustifyClass = useCallback((className = "") => {
    if (className.includes("text-right")) return "justify-end";
    if (className.includes("text-center")) return "justify-center";
    return "justify-start";
  }, []);

  // Clone children and inject sorting into thead th elements
  const enhanced = useMemo(() => {
    return React.Children.map(children, (child) => {
      if (!React.isValidElement(child) || child.type !== "table") return child;
      return React.cloneElement(child, {}, [
        child.props.children ? React.Children.map(child.props.children, (section) => {
          if (!React.isValidElement(section) || (section.type !== "thead" && section.type !== "tbody" && section.type !== "tfoot")) return section;
          if (section.type === "thead") {
            return React.cloneElement(section, {}, [
              React.Children.map(section.props.children, (row) =>
                React.cloneElement(row, {}, [
                  React.Children.map(row.props.children, (th) => {
                    if (!React.isValidElement(th) || th.type !== "th") return th;
                    const sortKeyAttr = th.props["data-sort-key"];
                    if (!sortKeyAttr) return th;
                    const active = sortKey === sortKeyAttr;
                    const thClassName = `${th.props.className || ""}`.trim();
                    const justifyClass = getJustifyClass(thClassName);
                    return React.cloneElement(th, {
                      title: `Sort by ${th.props.children}`,
                      "aria-sort": active
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none",
                      className: `select-none transition-colors ${
                        active
                          ? "bg-sky-50 text-sky-700"
                          : "text-slate-700 hover:text-brand-700"
                      } ${thClassName}`.trim(),
                      style: th.props.style || {},
                    }, [
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          onClick: () => toggle(sortKeyAttr),
                          className: `flex w-full items-center gap-2 ${justifyClass} bg-transparent py-3 outline-none`,
                        },
                        [
                          React.createElement("span", {}, th.props.children),
                          React.createElement(
                            "span",
                            {
                              className: `inline-flex flex-col leading-none ${
                                active ? "text-sky-600" : "text-slate-500"
                              }`,
                              "aria-hidden": "true",
                            },
                            [
                              React.createElement(ChevronUp, {
                                className: `h-3 w-3 ${
                                  active && sortDir === "asc"
                                    ? "opacity-100"
                                    : "opacity-50"
                                }`,
                                strokeWidth: 2.25,
                              }),
                              React.createElement(ChevronDown, {
                                className: `-mt-1 h-3 w-3 ${
                                  active && sortDir === "desc"
                                    ? "opacity-100"
                                    : "opacity-50"
                                }`,
                                strokeWidth: 2.25,
                              }),
                            ],
                          ),
                        ],
                      ),
                    ]);
                  })
                ])
              )
            ]);
          }
          return section;
        }) : child.props.children
      ]);
    });
  }, [children, getJustifyClass, sortKey, sortDir, toggle]);

  return React.createElement("div", { className }, enhanced);
}
