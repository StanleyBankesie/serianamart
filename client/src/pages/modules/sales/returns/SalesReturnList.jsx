import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { Search } from "lucide-react";

export default function SalesReturnList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/sales/returns")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load sales returns");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((r) => {
      const no = String(r.return_no || "").toLowerCase();
      const cust = String(r.customer_name || "").toLowerCase();
      const inv = String(r.invoice_id || "").toLowerCase();
      return no.includes(q) || cust.includes(q) || inv.includes(q);
    });
  }, [items, searchTerm]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((r) => r.status === "PENDING").length;
    const approved = items.filter((r) => r.status === "APPROVED").length;
    const draft = items.filter((r) => r.status === "DRAFT").length;
    return { total, pending, approved, draft };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>↩️</span> Sales Returns
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Process customer returns and track status
              </p>
            </div>
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
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
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Draft</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.draft}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="text-2xl font-bold text-emerald-600">
                {stats.approved}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Search by return no, customer, or invoice"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading sales returns...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              No sales returns found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Return No</th>
                    <th>Return Date</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.return_no}</td>
                      <td>
                        {r.return_date
                          ? new Date(r.return_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{r.customer_name || "-"}</td>
                      <td className="text-right">
                        {Number(r.total_amount || 0).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === "APPROVED"
                              ? "badge-success"
                              : r.status === "PENDING"
                              ? "badge-warning"
                              : r.status === "CANCELLED"
                              ? "badge-error"
                              : "badge-info"
                          }`}
                        >
                          {r.status || "DRAFT"}
                        </span>
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
