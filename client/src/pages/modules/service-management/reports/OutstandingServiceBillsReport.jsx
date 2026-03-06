import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function OutstandingServiceBillsReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        "/service-management/reports/outstanding-bills",
      );
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
      "Bill No",
      "Service Order No",
      "Customer",
      "Bill Date",
      "Due Date",
      "Total",
      "Paid",
      "Balance",
      "Aging",
    ];
    const rows = items.map((r) => [
      r.bill_no || "-",
      r.service_order_no || "-",
      r.customer || "-",
      r.bill_date || "-",
      r.due_date || "-",
      Number(r.total_amount || 0).toFixed(2),
      Number(r.paid_amount || 0).toFixed(2),
      Number(r.balance || 0).toFixed(2),
      r.aging || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outstanding-service-bills.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        bill_no: r.bill_no,
        service_order_no: r.service_order_no,
        customer: r.customer,
        bill_date: r.bill_date,
        due_date: r.due_date,
        total_amount: Number(r.total_amount || 0),
        paid_amount: Number(r.paid_amount || 0),
        balance: Number(r.balance || 0),
        aging: r.aging,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OutstandingServiceBills");
    XLSX.writeFile(wb, "outstanding-service-bills.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Outstanding Service Bills", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Bill No", 10, y);
    doc.text("Order", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Bill", 120, y);
    doc.text("Due", 145, y);
    doc.text("Bal", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.bill_no || "-").slice(0, 18), 10, y);
      doc.text(String(r.service_order_no || "-").slice(0, 18), 40, y);
      doc.text(String(r.customer || "-").slice(0, 36), 70, y);
      doc.text(String(r.bill_date || "-"), 120, y);
      doc.text(String(r.due_date || "-"), 145, y);
      doc.text(String(Number(r.balance || 0).toFixed(2)), 190, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("outstanding-service-bills.pdf");
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
              Outstanding Service Bills
            </h1>
            <p className="text-sm mt-1">Accounts receivable tracking</p>
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
                  <th>Bill No</th>
                  <th>Service Order No</th>
                  <th>Customer</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right">Paid Amount</th>
                  <th className="text-right">Balance</th>
                  <th>Aging</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>{r.service_order_no || "-"}</td>
                    <td>{r.customer || "-"}</td>
                    <td>{r.bill_date || "-"}</td>
                    <td>{r.due_date || "-"}</td>
                    <td className="text-right">{r.total_amount || "-"}</td>
                    <td className="text-right">{r.paid_amount || "-"}</td>
                    <td className="text-right">{r.balance || "-"}</td>
                    <td>{r.aging || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500">
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
