/**
 * @fileoverview PeriodicalStockSummaryPage component.
 * Provides functionality for PeriodicalStockSummaryPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function PeriodicalStockSummaryPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemGroupId, setItemGroupId] = useState("");
  const [q, setQ] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemOptions, setItemOptions] = useState([]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [groupSearchVal, setGroupSearchVal] = useState("");

  const itemSelectOptions = React.useMemo(() => {
    if (!itemOptions) return [];
    return itemOptions.map((p) => ({
      value: String(p.id),
      label: `${p.item_code} - ${p.item_name}`,
      barcode: p.barcode,
      item_code: p.item_code,
      item_name: p.item_name,
    }));
  }, [itemOptions]);

  const itemSearchResults = React.useMemo(() => {
    if (!searchVal) return [];
    const lower = searchVal.toLowerCase();
    return itemSelectOptions.filter(
      (o) =>
        (o.barcode && o.barcode.toLowerCase() === lower) ||
        (o.item_code && o.item_code.toLowerCase().includes(lower)) ||
        (o.item_name && o.item_name.toLowerCase().includes(lower)),
    );
  }, [searchVal, itemSelectOptions]);

  const groupSelectOptions = React.useMemo(() => {
    if (!groups) return [];
    return groups.map((g) => ({
      value: String(g.id),
      label: g.group_name,
      group_name: g.group_name,
    }));
  }, [groups]);

  const groupSearchResults = React.useMemo(() => {
    if (!groupSearchVal) return [];
    const lower = groupSearchVal.toLowerCase();
    return groupSelectOptions.filter(
      (o) => o.group_name && o.group_name.toLowerCase().includes(lower),
    );
  }, [groupSearchVal, groupSelectOptions]);

  async function run() {
    try {
      if (!from && !to && !warehouseId && !itemGroupId && !q) {
        setItems([]);
        return;
      }
      setLoading(true);
      const res = await api.get("/inventory/reports/periodical-stock-summary", {
        params: {
          from: from || null,
          to: to || null,
          warehouseId: warehouseId || null,
          itemGroupId: itemGroupId || null,
          q: q || null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [whRes, grpRes] = await Promise.all([
          api.get("/inventory/warehouses"),
          api.get("/inventory/item-groups"),
        ]);
        if (!mounted) return;
        setWarehouses(
          Array.isArray(whRes?.data?.items) ? whRes.data.items : [],
        );
        setGroups(Array.isArray(grpRes?.data?.items) ? grpRes.data.items : []);
        try {
          const itRes = await api.get("/inventory/items");
          if (mounted) {
            setItemOptions(
              Array.isArray(itRes?.data?.items) ? itRes.data.items : [],
            );
          }
        } catch {}
      } catch {}
      run();
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, warehouseId, itemGroupId, q]);

  const {
    sorted: sorted_items,
    sortKey,
    sortDir,
    toggle,
  } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/inventory"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Periodical Stock Summary
          </h1>
          <p className="text-sm mt-1">
            Opening, receipts, issues, closing per period
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end mb-6">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="label">Item Group</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type="text"
                  placeholder="Type to search group..."
                  value={groupSearchVal}
                  onChange={(e) => {
                    setGroupSearchVal(e.target.value);
                    setShowGroupDropdown(true);
                  }}
                  onFocus={() => setShowGroupDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowGroupDropdown(false), 200)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!groupSearchVal) {
                        setItemGroupId("");
                      } else if (groupSearchResults.length) {
                        setItemGroupId(groupSearchResults[0].value);
                        setGroupSearchVal("");
                        setShowGroupDropdown(false);
                      }
                    }
                  }}
                />
                <div className="absolute right-3 top-3 text-slate-400">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              {showGroupDropdown &&
              groupSearchVal &&
              groupSearchResults.length > 0 ? (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {groupSearchResults.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                      onClick={() => {
                        setItemGroupId(o.value);
                        setGroupSearchVal("");
                        setShowGroupDropdown(false);
                      }}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {o.group_name}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <label className="label">Item</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type="text"
                  placeholder="Scan barcode or type..."
                  value={searchVal}
                  onChange={(e) => {
                    setSearchVal(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!searchVal) {
                        setQ("");
                      } else if (itemSearchResults.length) {
                        setQ(itemSearchResults[0].item_code);
                        setSearchVal("");
                        setShowDropdown(false);
                      }
                    }
                  }}
                />
                <div className="absolute right-3 top-3 text-slate-400">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              {showDropdown && searchVal && itemSearchResults.length > 0 ? (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {itemSearchResults.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                      onClick={() => {
                        setQ(o.item_code);
                        setSearchVal("");
                        setShowDropdown(false);
                      }}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {o.item_name}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-end gap-3 sm:ml-auto flex-wrap">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(
                    wb,
                    ws,
                    "PeriodicalStockSummary",
                  );
                  XLSX.writeFile(wb, "periodical-stock-summary.xlsx");
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Periodical Stock Summary", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Item", 10, y);
                  doc.text("Opening", 95, y);
                  doc.text("Receipts", 130, y);
                  doc.text("Issues", 160, y);
                  doc.text("Closing", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    doc.text(
                      String(r.item_name || r.item_code || "-").slice(0, 60),
                      10,
                      y,
                    );
                    doc.text(
                      String(Number(r.opening_qty || 0).toLocaleString()),
                      95,
                      y,
                    );
                    doc.text(
                      String(Number(r.receipts_qty || 0).toLocaleString()),
                      130,
                      y,
                    );
                    doc.text(
                      String(Number(r.issues_qty || 0).toLocaleString()),
                      160,
                      y,
                    );
                    doc.text(
                      String(Number(r.closing_qty || 0).toLocaleString()),
                      190,
                      y,
                      { align: "right" },
                    );
                    y += 5;
                  });
                  doc.save("periodical-stock-summary.pdf");
                }}
                disabled={!items.length}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-fixed w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortableHeader
                    label="Item"
                    sortKey="item"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Opening"
                    sortKey="opening"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Receipts"
                    sortKey="receipts"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Issues"
                    sortKey="issues"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Closing"
                    sortKey="closing"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.item_id}>
                    <td className="font-medium">
                      {r.item_name || r.item_code}
                    </td>
                    <td className="text-right">
                      {Number(r.opening_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.receipts_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.issues_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.closing_qty || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
