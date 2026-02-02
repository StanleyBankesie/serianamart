import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function SupplierOutstandingReportPage() {
  const [asOf, setAsOf] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/supplier-outstanding", {
        params: { asOf: asOf || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/finance"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Supplier Outstanding Report
          </h1>
          <p className="text-sm mt-1">
            Payables outstanding per supplier as of a date
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">As of Date</label>
              <input
                className="input"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
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
                  setAsOf("");
                }}
                disabled={loading}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "SupplierOutstanding");
                  XLSX.writeFile(wb, "supplier-outstanding.xlsx");
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const doc = new jsPDF("p", "mm", "a4");
                  let y = 15;
                  doc.setFontSize(14);
                  doc.text("Supplier Outstanding Report", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Supplier", 10, y);
                  doc.text("Bill No", 75, y);
                  doc.text("Bill Date", 110, y);
                  doc.text("Due Date", 140, y);
                  doc.text("Amount", 165, y);
                  doc.text("Paid", 180, y);
                  doc.text("Outstanding", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const supp = String(r.supplier_name || "-").slice(0, 60);
                    const bill = String(r.bill_no || "-");
                    const billd = r.bill_date
                      ? new Date(r.bill_date).toLocaleDateString()
                      : "-";
                    const dued = r.due_date
                      ? new Date(r.due_date).toLocaleDateString()
                      : "-";
                    const amt = String(Number(r.amount || 0).toLocaleString());
                    const paid = String(Number(r.paid || 0).toLocaleString());
                    const out = String(
                      Number(r.outstanding || 0).toLocaleString(),
                    );
                    doc.text(supp, 10, y);
                    doc.text(bill, 75, y);
                    doc.text(billd, 110, y);
                    doc.text(dued, 140, y);
                    doc.text(amt, 165, y);
                    doc.text(paid, 180, y);
                    doc.text(out, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("supplier-outstanding.pdf");
                }}
                disabled={!items.length}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Supplier</th>
                  <th>Bill No</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.supplier_name || "-"}</td>
                    <td>{r.bill_no || "-"}</td>
                    <td>
                      {r.bill_date
                        ? new Date(r.bill_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.paid || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.outstanding || 0).toLocaleString()}
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
