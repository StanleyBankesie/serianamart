import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function SalesReturnReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/sales/reports/sales-return", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      "Date",
      "Return No",
      "Customer",
      "Item",
      "Quantity",
      "Amount",
    ];
    const rows = (Array.isArray(items) ? items : []).map((r) => [
      r.return_date ? new Date(r.return_date).toLocaleDateString() : "-",
      r.return_no || "-",
      r.customer_name || "-",
      r.item_name || r.item_code || "-",
      Number(r.qty || 0).toFixed(2),
      Number(r.amount || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales_return.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = (Array.isArray(items) ? items : []).map((r) => ({
      date: r.return_date ? new Date(r.return_date).toLocaleDateString() : "-",
      return_no: r.return_no || "-",
      customer: r.customer_name || "-",
      item: r.item_name || r.item_code || "-",
      quantity: Number(r.qty || 0),
      amount: Number(r.amount || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesReturn");
    XLSX.writeFile(wb, "sales-return.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Sales Return Report", 10, y);
    y += 8;
    doc.setFontSize(10);
    const headers = ["Date", "Return No", "Customer", "Item", "Qty", "Amount"];
    doc.text(headers[0], 10, y);
    doc.text(headers[1], 35, y);
    doc.text(headers[2], 70, y);
    doc.text(headers[3], 120, y);
    doc.text(headers[4], 160, y);
    doc.text(headers[5], 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    (Array.isArray(items) ? items : []).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const dt = r.return_date
        ? new Date(r.return_date).toLocaleDateString()
        : "-";
      const no = String(r.return_no || "-");
      const cust = String(r.customer_name || "-");
      const item = String(r.item_name || r.item_code || "-");
      const qty = Number(r.qty || 0).toFixed(2);
      const amt = Number(r.amount || 0).toFixed(2);
      doc.text(dt, 10, y);
      doc.text(no, 35, y);
      doc.text(cust.slice(0, 40), 70, y);
      doc.text(item.slice(0, 35), 120, y);
      doc.text(qty, 160, y);
      doc.text(amt, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("sales-return.pdf");
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
              Sales Return Report
            </h1>
            <p className="text-sm mt-1">
              Returned items and amounts within period
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/sales" className="btn btn-secondary">
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
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Return No</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td>
                      {r.return_date
                        ? new Date(r.return_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.return_no || "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
