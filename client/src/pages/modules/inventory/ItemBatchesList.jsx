import React, { useEffect, useMemo, useState } from "react";
import { api } from "api/client";
import { Link } from "react-router-dom";

export default function ItemBatchesList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    item_id: "",
    batch_no: "",
    expiry_from: "",
    expiry_to: "",
  });
  const [inventoryItems, setInventoryItems] = useState([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/batches", { params: filters });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get("/inventory/items")
      .then((r) =>
        setInventoryItems(Array.isArray(r.data?.items) ? r.data.items : []),
      )
      .catch(() => setInventoryItems([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const soonToExpire = useMemo(() => {
    const today = new Date();
    const in90 = new Date();
    in90.setMonth(in90.getMonth() + 3);
    return items.filter((b) => {
      if (!b.expiry_date) return false;
      const d = new Date(b.expiry_date);
      return d >= today && d <= in90 && Number(b.qty) > 0;
    }).length;
  }, [items]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/inventory" className="text-sm text-brand hover:text-brand-600">
            ← Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold mt-2">Item Batches</h1>
          <p className="text-sm text-slate-600">
            Track item batches, costs, quantities and expiry dates. Soon-to-expire: {soonToExpire}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Item</label>
            <select
              className="input h-9 text-sm w-full"
              value={filters.item_id}
              onChange={(e) => setFilters((p) => ({ ...p, item_id: e.target.value }))}
            >
              <option value="">All Items</option>
              {inventoryItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_code} - {it.item_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Batch No</label>
            <input
              className="input h-9 text-sm w-full"
              value={filters.batch_no}
              onChange={(e) => setFilters((p) => ({ ...p, batch_no: e.target.value }))}
              placeholder="Search batch..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Expiry From</label>
            <input
              type="date"
              className="input h-9 text-sm w-full"
              value={filters.expiry_from}
              onChange={(e) => setFilters((p) => ({ ...p, expiry_from: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Expiry To</label>
            <input
              type="date"
              className="input h-9 text-sm w-full"
              value={filters.expiry_to}
              onChange={(e) => setFilters((p) => ({ ...p, expiry_to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading batches…</div>
          ) : error ? (
            <div className="py-10 text-center text-red-600">{error}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date Entered</th>
                  <th>Warehouse</th>
                  <th>Item</th>
                  <th>Batch No</th>
                  <th>Serial No</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Reserved</th>
                  <th>Expiry Date</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.entry_date ? String(b.entry_date).slice(0, 10) : "-"}</td>
                    <td>{b.warehouse_name || "-"}</td>
                    <td>{b.item_code} - {b.item_name}</td>
                    <td className="font-mono">{b.batch_no || "-"}</td>
                    <td className="font-mono">{b.serial_no || "-"}</td>
                    <td className="text-right">{Number(b.qty || 0).toLocaleString()}</td>
                    <td className="text-right text-orange-600">{Number(b.reserved_qty || 0).toLocaleString()}</td>
                    <td>{b.expiry_date ? String(b.expiry_date).slice(0,10) : "-"}</td>
                    <td>{it.created_by_name || "-"}</td>
                    <td>{it.created_at ? new Date(it.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No batches found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
