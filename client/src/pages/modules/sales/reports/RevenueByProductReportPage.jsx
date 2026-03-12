import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import jsPDF from "jspdf";

export default function RevenueByProductReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/revenue-by-product");
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

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Product",
      "Quantity Sold",
      "Total Revenue",
      "Avg Selling Price",
      "Discount Given",
    ];
    const rows = items.map((r) => [
      r.product_name || "-",
      Number(r.quantity_sold || 0),
      Number(r.total_revenue || 0).toFixed(2),
      Number(r.avg_selling_price || 0).toFixed(2),
      Number(r.discount_given || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-revenue-by-product.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        product: r.product_name,
        quantity_sold: Number(r.quantity_sold || 0),
        total_revenue: Number(r.total_revenue || 0),
        avg_price: Number(r.avg_selling_price || 0),
        discount_given: Number(r.discount_given || 0),
      })),
    );
    autosizeWorksheetColumns(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RevenueByProduct");
    XLSX.writeFile(wb, "sales-revenue-by-product.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Sales Revenue by Product", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Product", 10, y);
    doc.text("Qty", 120, y);
    doc.text("Revenue", 150, y);
    doc.text("Avg Price", 180, y);
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.product_name || "-").slice(0, 90), 10, y);
      doc.text(String(Number(r.quantity_sold || 0)), 120, y);
      doc.text(String(Number(r.total_revenue || 0).toFixed(2)), 150, y);
      doc.text(String(Number(r.avg_selling_price || 0).toFixed(2)), 180, y);
      y += 5;
    });
    doc.save("sales-revenue-by-product.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Sales Revenue by Product
            </h1>
            <p className="text-sm mt-1">Identify best-selling products</p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Quantity Sold</th>
                  <th className="text-right">Total Revenue</th>
                  <th className="text-right">Avg Selling Price</th>
                  <th className="text-right">Discount Given</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.product_name}</td>
                    <td className="text-right">
                      {Number(r.quantity_sold || 0)}
                    </td>
                    <td className="text-right">
                      {Number(r.total_revenue || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.avg_selling_price || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </td>
                    <td className="text-right">
                      {Number(r.discount_given || 0).toLocaleString(undefined, {
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
