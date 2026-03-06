import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

export default function LeadTimeAnalysisReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/lead-time-analysis");
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
        po_no: r.po_no,
        rfq_to_po: r.rfq_to_po,
        po_to_shipment: r.po_to_shipment,
        shipment_to_clearance: r.shipment_to_clearance,
        clearance_to_grn: r.clearance_to_grn,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LeadTimeAnalysis");
    XLSX.writeFile(wb, "lead-time-analysis.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Lead Time Analysis
            </h1>
            <p className="text-sm mt-1">Measure procurement efficiency</p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>
              Export Excel
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th className="text-right">RFQ → PO (days)</th>
                  <th className="text-right">PO → Shipment (days)</th>
                  <th className="text-right">Shipment → Clearance (days)</th>
                  <th className="text-right">Clearance → GRN (days)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.po_no}</td>
                    <td className="text-right">{r.rfq_to_po ?? "—"}</td>
                    <td className="text-right">{r.po_to_shipment ?? "—"}</td>
                    <td className="text-right">{r.shipment_to_clearance ?? "—"}</td>
                    <td className="text-right">{r.clearance_to_grn ?? "—"}</td>
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

