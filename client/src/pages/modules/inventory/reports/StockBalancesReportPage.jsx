import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";
import { Link } from "react-router-dom";

export default function StockBalancesReportPage() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [itemOptions, setItemOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/inventory/warehouses"),
      api.get("/inventory/stock-balances"),
      api.get("/inventory/items"),
    ])
      .then(([whRes, sbRes, itRes]) => {
        if (!mounted) return;
        setWarehouses(
          Array.isArray(whRes?.data?.items) ? whRes.data.items : [],
        );
        setItems(Array.isArray(sbRes?.data?.items) ? sbRes.data.items : []);
        setItemOptions(
          Array.isArray(itRes?.data?.items) ? itRes.data.items : [],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load stock balances");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchBalances() {
      try {
        const params = {};
        if (warehouseId) params.warehouseId = warehouseId;
        if (q.trim()) params.q = q.trim();
        const res = await api.get("/inventory/stock-balances", { params });
        if (!cancelled) {
          setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.message || "Failed to load stock balances",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchBalances();
    return () => {
      cancelled = true;
    };
  }, [warehouseId, q]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((r) => {
      if (!key) return true;
      return (
        String(r.item_code || "")
          .toLowerCase()
          .includes(key) || String(r.item_name || "").includes(key)
      );
    });
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Balances
              </h1>
              <p className="text-sm mt-1">
                Quantity available per item and warehouse
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search item..."
              className="input flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              list="stock_bal_item_options"
            />
            <datalist id="stock_bal_item_options">
              {itemOptions.slice(0, 1000).map((it) => (
                <option key={it.id} value={it.item_code}>
                  {it.item_name}
                </option>
              ))}
            </datalist>
            <select
              className="input w-full md:w-72"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              title="Warehouse"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th className="text-right">Total Qty</th>
                  <th className="text-right">Reserve Qty</th>
                  <th className="text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : null}
                {!loading && !filtered.length ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {r.item_code}
                    </td>
                    <td>{r.item_name}</td>
                    <td className="text-right">
                      {Number(r.total_qty || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.reserved_qty || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.available_qty || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
