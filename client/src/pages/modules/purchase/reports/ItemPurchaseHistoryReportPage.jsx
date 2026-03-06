import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function ItemPurchaseHistoryReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/item-purchase-history");
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
        item_name: r.item_name,
        supplier: r.supplier_name,
        po_no: r.po_no,
        purchase_date: r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : "-",
        quantity: Number(r.quantity || 0),
        unit_price: Number(r.unit_price || 0),
        total_cost: Number(r.total_cost || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ItemPurchaseHistory");
    XLSX.writeFile(wb, "item-purchase-history.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Item Purchase History</h1>
            <p className="text-sm mt-1">Track procurement per item</p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">Return to Menu</Link>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>Export Excel</button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Supplier</th>
                  <th>PO No</th>
                  <th>Purchase Date</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.item_name}</td>
                    <td>{r.supplier_name}</td>
                    <td>{r.po_no}</td>
                    <td>{r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : "-"}</td>
                    <td className="text-right">{Number(r.quantity || 0)}</td>
                    <td className="text-right">{Number(r.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">No records</td>
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

