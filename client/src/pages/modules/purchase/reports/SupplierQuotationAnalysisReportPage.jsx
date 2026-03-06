import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function SupplierQuotationAnalysisReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        "/purchase/reports/supplier-quotation-analysis",
        {
          params: { from: from || null, to: to || null },
        },
      );
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportExcel() {
    if (!items.length) return;
    const rows = items.map((r) => ({
      quotation_no: r.quotation_no,
      quotation_date: r.quotation_date
        ? new Date(r.quotation_date).toLocaleDateString()
        : "-",
      supplier: r.supplier_name,
      items_count: r.items_count,
      total_amount: Number(r.total_amount || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SupplierQuotationAnalysis");
    XLSX.writeFile(wb, "supplier-quotation-analysis.xlsx");
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = ["Quotation No", "Date", "Supplier", "Items", "Total"];
    const rows = items.map((r) => [
      r.quotation_no || "-",
      r.quotation_date ? new Date(r.quotation_date).toLocaleDateString() : "-",
      r.supplier_name || "-",
      Number(r.items_count || 0),
      Number(r.total_amount || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier-quotation-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Supplier Quotation Analysis", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Quotation", 10, y);
    doc.text("Date", 55, y);
    doc.text("Supplier", 85, y);
    doc.text("Items", 160, y);
    doc.text("Total", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const qn = String(r.quotation_no || "-");
      const dt = r.quotation_date
        ? new Date(r.quotation_date).toLocaleDateString()
        : "-";
      const sup = String(r.supplier_name || "-");
      const cnt = String(Number(r.items_count || 0));
      const tot = Number(r.total_amount || 0).toFixed(2);
      doc.text(qn.slice(0, 30), 10, y);
      doc.text(dt, 55, y);
      doc.text(sup.slice(0, 60), 85, y);
      doc.text(cnt, 160, y);
      doc.text(tot, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("supplier-quotation-analysis.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Supplier Quotation Analysis
            </h1>
            <p className="text-sm mt-1">
              Compare quotations by supplier and RFQ
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/purchase" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.quotation_no}</td>
                    <td>
                      {r.quotation_date
                        ? new Date(r.quotation_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.supplier_name}</td>
                    <td className="text-right">{Number(r.items_count || 0)}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
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
