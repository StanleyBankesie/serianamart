import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function ServiceConfirmationReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/confirmation");
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Service Order No",
      "Confirmation Date",
      "Customer Name",
      "Confirmation Status",
      "Remarks",
      "Rating",
    ];
    const rows = items.map((r) => [
      r.order_no || "-",
      r.confirmation_date || "-",
      r.customer_name || "-",
      r.confirmation_status || "-",
      r.remarks || "-",
      r.rating || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-confirmation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        service_order_no: r.order_no,
        confirmation_date: r.confirmation_date,
        customer_name: r.customer_name,
        confirmation_status: r.confirmation_status,
        remarks: r.remarks,
        rating: r.rating,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceConfirmation");
    XLSX.writeFile(wb, "service-confirmation.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Service Confirmation", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Order", 10, y);
    doc.text("Date", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Status", 135, y);
    doc.text("Rating", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.order_no || "-").slice(0, 20), 10, y);
      doc.text(String(r.confirmation_date || "-"), 40, y);
      doc.text(String(r.customer_name || "-").slice(0, 50), 70, y);
      doc.text(String(r.confirmation_status || "-").slice(0, 20), 135, y);
      doc.text(String(r.rating || "-"), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("service-confirmation.pdf");
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
              Service Confirmation
            </h1>
            <p className="text-sm mt-1">Confirm customer acceptance</p>
          </div>
          <div className="flex gap-2">
            <Link to="/service-management" className="btn btn-secondary">
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
                  <th>Service Order No</th>
                  <th>Confirmation Date</th>
                  <th>Customer Name</th>
                  <th>Confirmation Status</th>
                  <th>Remarks</th>
                  <th>Customer Rating</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.order_no}</td>
                    <td>{r.confirmation_date || "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.remarks || "-"}</td>
                    <td>{r.rating || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
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
