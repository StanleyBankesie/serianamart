import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function RepeatServiceRequestReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/repeat-requests");
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
      "Customer",
      "Asset/Equipment",
      "Number of Requests",
      "Last Service Date",
      "Issue Type",
    ];
    const rows = items.map((r) => [
      r.customer || "-",
      r.asset_equipment || "-",
      Number(r.num_requests || 0),
      r.last_service_date || "-",
      r.issue_type || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "repeat-service-requests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        customer: r.customer,
        asset_equipment: r.asset_equipment,
        num_requests: Number(r.num_requests || 0),
        last_service_date: r.last_service_date,
        issue_type: r.issue_type,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RepeatServiceRequests");
    XLSX.writeFile(wb, "repeat-service-requests.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Repeat Service Requests", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Customer", 10, y);
    doc.text("Asset", 70, y);
    doc.text("#Req", 130, y);
    doc.text("Last Date", 160, y);
    doc.text("Issue", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.customer || "-").slice(0, 40), 10, y);
      doc.text(String(r.asset_equipment || "-").slice(0, 40), 70, y);
      doc.text(String(Number(r.num_requests || 0)), 130, y);
      doc.text(String(r.last_service_date || "-"), 160, y);
      doc.text(String(r.issue_type || "-").slice(0, 20), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("repeat-service-requests.pdf");
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
              Repeat Service Request
            </h1>
            <p className="text-sm mt-1">Identify recurring issues</p>
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
                  <th>Customer</th>
                  <th>Asset / Equipment</th>
                  <th className="text-right">Number of Requests</th>
                  <th>Last Service Date</th>
                  <th>Issue Type</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.customer}</td>
                    <td>{r.asset || "-"}</td>
                    <td className="text-right">{r.count || 0}</td>
                    <td>{r.last_service_date || "-"}</td>
                    <td>{r.issue_type || "-"}</td>
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
