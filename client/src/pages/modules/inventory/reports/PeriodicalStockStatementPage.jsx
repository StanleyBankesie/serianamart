import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function PeriodicalStockStatementPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemGroupId, setItemGroupId] = useState("");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState("new");
  const [warehouses, setWarehouses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemOptions, setItemOptions] = useState([]);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get(
        "/inventory/reports/periodical-stock-statement",
        {
          params: {
            from: from || null,
            to: to || null,
            warehouseId: warehouseId || null,
            itemGroupId: itemGroupId || null,
            q: q || null,
          },
        },
      );
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
      } catch {}
      try {
        const itRes = await api.get("/inventory/items");
        if (mounted) {
          setItemOptions(
            Array.isArray(itRes?.data?.items) ? itRes.data.items : [],
          );
        }
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

  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "txn_date", "desc");

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
            Periodical Stock Statement
          </h1>
          <p className="text-sm mt-1">
            Detailed stock movements within the period
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
            <div>
              <label className="label">Item Group</label>
              <select
                className="input"
                value={itemGroupId}
                onChange={(e) => setItemGroupId(e.target.value)}
              >
                <option value="">All</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Item</label>
              <input
                className="input"
                type="text"
                placeholder="Item code or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                list="statement_item_options"
              />
              <datalist id="statement_item_options">
                {itemOptions.slice(0, 1000).map((it) => (
                  <option key={it.id} value={it.item_code}>
                    {it.item_name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="flex items-end gap-3 sm:ml-auto flex-wrap">
              <button
                type="button"
                className="btn-secondary"
                title={order === "new" ? "New entries first" : "Old entries first"}
                onClick={() => setOrder(order === "new" ? "old" : "new")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5l-4 4h8l-4-4zm0 14l4-4H8l4 4z" fill="currentColor" />
                </svg>
              </button>
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
                    "PeriodicalStockStatement",
                  );
                  XLSX.writeFile(wb, "periodical-stock-statement.xlsx");
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
                  doc.text("Periodical Stock Statement", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Document", 45, y);
                  doc.text("Item", 95, y);
                  doc.text("In", 140, y);
                  doc.text("Out", 165, y);
                  doc.text("Balance", 190, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.txn_date
                      ? new Date(r.txn_date).toLocaleDateString()
                      : "-";
                    const docno = String(r.doc_no || "-");
                    const item = String(
                      r.item_name || r.item_code || "-",
                    ).slice(0, 40);
                    const inq = String(Number(r.qty_in || 0).toLocaleString());
                    const outq = String(
                      Number(r.qty_out || 0).toLocaleString(),
                    );
                    const bal = String(
                      Number(r.balance_qty || 0).toLocaleString(),
                    );
                    doc.text(dt, 10, y);
                    doc.text(docno, 45, y);
                    doc.text(item, 95, y);
                    doc.text(inq, 140, y);
                    doc.text(outq, 165, y);
                    doc.text(bal, 190, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("periodical-stock-statement.pdf");
                }}
                disabled={!items.length}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Date" sortKey="txn_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Document" sortKey="document" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="In" sortKey="in" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Out" sortKey="out" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Balance" sortKey="balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {(order === "new" ? items.slice().reverse() : items).map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td>
                      {r.txn_date
                        ? new Date(r.txn_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.doc_no || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.qty_in || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.qty_out || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.balance_qty || 0).toLocaleString()}
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
