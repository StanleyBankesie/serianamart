import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function AccountsReceivableAgingReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/ar-aging");
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
      "Customer",
      "Invoice No",
      "Invoice Date",
      "Due Date",
      "Amount",
      "0–30",
      "31–60",
      "61–90",
      "90+",
    ];
    const rows = items.map((r) => [
      r.customer_name || "-",
      r.invoice_no || "-",
      r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
      r.due_date || "-",
      Number(r.amount || 0).toFixed(2),
      Number(r.d0_30 || 0).toFixed(2),
      Number(r.d31_60 || 0).toFixed(2),
      Number(r.d61_90 || 0).toFixed(2),
      Number(r.d90_plus || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "accounts-receivable-aging.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        customer: r.customer_name,
        invoice_no: r.invoice_no,
        invoice_date: r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
        due_date: r.due_date || "-",
        amount: Number(r.amount || 0),
        "0_30": Number(r.d0_30 || 0),
        "31_60": Number(r.d31_60 || 0),
        "61_90": Number(r.d61_90 || 0),
        "90_plus": Number(r.d90_plus || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ARAging");
    XLSX.writeFile(wb, "accounts-receivable-aging.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Accounts Receivable Aging", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Customer", 10, y);
    doc.text("Invoice", 60, y);
    doc.text("Date", 95, y);
    doc.text("0–30", 130, y);
    doc.text("31–60", 150, y);
    doc.text("61–90", 170, y);
    doc.text("90+", 190, y);
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.customer_name || "-").slice(0, 40), 10, y);
      doc.text(String(r.invoice_no || "-").slice(0, 15), 60, y);
      doc.text(
        r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
        95,
        y,
      );
      doc.text(String(Number(r.d0_30 || 0).toFixed(2)), 130, y);
      doc.text(String(Number(r.d31_60 || 0).toFixed(2)), 150, y);
      doc.text(String(Number(r.d61_90 || 0).toFixed(2)), 170, y);
      doc.text(String(Number(r.d90_plus || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("accounts-receivable-aging.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Accounts Receivable Aging
            </h1>
            <p className="text-sm mt-1">Track overdue payments</p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-success" onClick={exportCSV} disabled={loading || items.length === 0}>
              Export CSV
            </button>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>
              Export Excel
            </button>
            <button className="btn-primary" onClick={exportPDF} disabled={loading || items.length === 0}>
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Invoice No</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">0–30</th>
                  <th className="text-right">31–60</th>
                  <th className="text-right">61–90</th>
                  <th className="text-right">90+</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.customer_name}</td>
                    <td>{r.invoice_no}</td>
                    <td>{r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-"}</td>
                    <td>{r.due_date || "-"}</td>
                    <td className="text-right">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.d0_30 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.d31_60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.d61_90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.d90_plus || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500">No records</td>
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

