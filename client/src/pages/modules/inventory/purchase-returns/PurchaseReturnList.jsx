import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { Search } from "lucide-react";

export default function PurchaseReturnList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const resp = await api.get("/purchase/returns");
        if (!mounted) return;
        setItems(Array.isArray(resp.data?.items) ? resp.data.items : []);
      } catch (err) {
        if (!mounted) return;
        setError("Failed to load purchase returns");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    return { total };
  }, [items]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      return (
        String(r.return_no || "").toLowerCase().includes(q) ||
        String(r.supplier_name || "").toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>↩️</span> Purchase Returns
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Process supplier returns
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory/purchase-returns/new" className="btn btn-primary">
                New Purchase Return
              </Link>
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Total Returns</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                className="input pl-10"
                placeholder="Search by return no or supplier"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading purchase returns...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              No purchase returns found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Return No</th>
                    <th>Return Date</th>
                    <th>Supplier</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>{r.return_no}</td>
                      <td>{String(r.return_date || "").slice(0, 10)}</td>
                      <td>{r.supplier_name}</td>
                      <td className="text-right">
                        {(Number(r.total_amount || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
