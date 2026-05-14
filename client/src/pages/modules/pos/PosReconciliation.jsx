import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { getUnsyncedSales, getFailedSales, deleteLocalSale } from "../../../offline/posStore.js";
import { retryItem, retryAllFailed, getQueueSnapshot, onQueueUpdate } from "../../../offline/syncEngine.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

export default function PosReconciliation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const unsynced = await getUnsyncedSales();
    const failed = await getFailedSales();
    const all = [...unsynced.map((s) => ({ ...s, syncStatus: "pending" })), ...failed.map((s) => ({ ...s, syncStatus: "failed" }))];
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const off = onQueueUpdate(() => load());
    return () => off();
  }, [load]);

  const handleRetry = async (id) => {
    try {
      await retryItem(id);
      toast.success("Retry queued");
      load();
    } catch { toast.error("Retry failed"); }
  };

  const handleRetryAll = async () => {
    setSyncing(true);
    try {
      await retryAllFailed();
      toast.success("Retrying all failed items");
      load();
    } catch { toast.error("Retry all failed"); }
    setSyncing(false);
  };

  const handleDiscard = async (id) => {
    if (!window.confirm("Discard this offline sale? This cannot be undone.")) return;
    try {
      await deleteLocalSale(id);
      toast.success("Discarded");
      load();
    } catch { toast.error("Failed to discard"); }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.syncStatus === filter);
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filtered, "createdAt", "desc");
  const hasFailed = items.some((i) => i.syncStatus === "failed");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POS Sync Reconciliation</h1>
          <p className="text-sm text-slate-600">Manage offline sales that haven't synced to the server</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pos" className="btn btn-secondary">Back to POS</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          {!navigator.onLine && (
            <div className="alert alert-warning">You are offline. Sales will be queued locally and sync when connectivity returns.</div>
          )}

          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">Filter:</div>
            <select className="input w-40" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Items</option>
              <option value="pending">Pending Sync</option>
              <option value="failed">Failed</option>
            </select>
            <div className="flex-1" />
            {hasFailed && (
              <button className="btn-primary" disabled={syncing} onClick={handleRetryAll}>
                {syncing ? "Retrying..." : "Retry All Failed"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-3xl mb-2">✅</div>
              <p>All sales are synced. No pending items.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <SortableHeader label="Date/Time" sortKey="createdAt" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th>Items</th>
                    <SortableHeader label="Total" sortKey="total" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Status" sortKey="syncStatus" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                      <td>{item.customer_name || "Walk-in"}</td>
                      <td>{Array.isArray(item.items) ? item.items.length : 0}</td>
                      <td className="font-medium">
                        {item.total
                          ? Number(item.total).toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : "-"}
                      </td>
                      <td>
                        <span className={`badge ${item.syncStatus === "failed" ? "badge-error" : "badge-warning"}`}>
                          {item.syncStatus === "failed" ? "Failed" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-outline text-xs" onClick={() => handleRetry(item.id)}>
                            Retry Sync
                          </button>
                          <button className="btn-outline text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleDiscard(item.id)}>
                            Discard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <p>• <strong>Pending</strong> items will sync automatically when online</p>
            <p>• <strong>Failed</strong> items have exceeded max retries — click Retry to attempt again</p>
            <p>• <strong>Discard</strong> removes the sale from the queue — it will NOT be sent to the server</p>
          </div>
        </div>
      </div>
    </div>
  );
}
