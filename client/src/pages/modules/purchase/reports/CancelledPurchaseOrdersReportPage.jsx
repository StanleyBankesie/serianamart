import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function CancelledPurchaseOrdersReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/cancelled-purchase-orders");
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

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Cancelled / Rejected Purchase Orders
            </h1>
            <p className="text-sm mt-1">Control procurement wastage</p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th>Supplier</th>
                  <th>Reason</th>
                  <th>Cancelled By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.po_no}</td>
                    <td>{r.supplier}</td>
                    <td>{r.cancel_reason || "-"}</td>
                    <td>{r.cancelled_by || "-"}</td>
                    <td>{r.date ? new Date(r.date).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

