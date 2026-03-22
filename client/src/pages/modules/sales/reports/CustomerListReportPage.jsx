import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function CustomerListReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/customers", {
        params: { active: "true" }
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        "Customer Code": r.customer_code || "-",
        "Customer Name": r.customer_name || "-",
        "Customer Type": r.customer_type || "-",
        "Email": r.email || "-",
        "Phone": r.phone || "-",
        "Mobile": r.mobile || "-",
        "Contact Person": r.contact_person || "-",
        "Address": r.address || "-",
        "City": r.city || "-",
        "State": r.state || "-",
        "Country": r.country || "-",
        "Credit Limit": Number(r.credit_limit || 0).toFixed(2),
        "Price Type": r.price_type_name || "-",
        "Status": r.is_active ? "Active" : "Inactive",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customer-list.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center py-3">
          <div>
            <h1 className="text-xl font-bold">Customer List Report</h1>
            <p className="text-xs opacity-90">Export all active customers to Excel</p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-sm bg-white/10 hover:bg-white/20 text-white border-white/20">
              Back
            </Link>
            <button
              onClick={exportExcel}
              disabled={loading || items.length === 0}
              className="btn btn-sm btn-success"
            >
              Export to Excel
            </button>
          </div>
        </div>
        <div className="card-body p-4 bg-slate-50 dark:bg-slate-900/50">
          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="table table-compact w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left p-3 border-b">Code</th>
                  <th className="text-left p-3 border-b">Name</th>
                  <th className="text-left p-3 border-b">Type</th>
                  <th className="text-left p-3 border-b">Email</th>
                  <th className="text-left p-3 border-b">Phone</th>
                  <th className="text-left p-3 border-b">City</th>
                  <th className="text-right p-3 border-b">Credit Limit</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8">Loading...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-slate-500">No customers found</td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3 border-b font-mono text-xs">{r.customer_code || "-"}</td>
                      <td className="p-3 border-b font-medium">{r.customer_name}</td>
                      <td className="p-3 border-b">{r.customer_type || "-"}</td>
                      <td className="p-3 border-b text-slate-500">{r.email || "-"}</td>
                      <td className="p-3 border-b">{r.phone || "-"}</td>
                      <td className="p-3 border-b">{r.city || "-"}</td>
                      <td className="p-3 border-b text-right font-mono">
                        {Number(r.credit_limit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
