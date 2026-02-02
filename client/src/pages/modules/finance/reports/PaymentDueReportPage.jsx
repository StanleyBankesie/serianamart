import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function PaymentDueReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/payment-due", {
        params: { from: from || null, to: to || null },
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
            Payment Due Report
          </h1>
          <p className="text-sm mt-1">
            Upcoming and overdue payables by due date
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label">From Due Date</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To Due Date</label>
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
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const headers = [
                    "Due Date",
                    "Ref",
                    "Party",
                    "Amount",
                    "Outstanding",
                    "Status",
                  ];
                  const data = rows.map((r) => [
                    r.due_date
                      ? new Date(r.due_date).toLocaleDateString()
                      : "-",
                    String(r.ref_no || "-"),
                    String(r.party_name || "-"),
                    Number(r.amount || 0).toFixed(2),
                    Number(r.outstanding || 0).toFixed(2),
                    String(r.status || "-"),
                  ]);
                  const csv = [
                    headers.join(","),
                    ...data.map((r) => r.join(",")),
                  ].join("\n");
                  const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "payment-due.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!items.length}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "PaymentDue");
                  XLSX.writeFile(wb, "payment-due.xlsx");
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
                  doc.text("Payment Due Report", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Due Date", 10, y);
                  doc.text("Ref", 45, y);
                  doc.text("Party", 85, y);
                  doc.text("Amount", 140, y);
                  doc.text("Outstanding", 165, y);
                  doc.text("Status", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dd = r.due_date
                      ? new Date(r.due_date).toLocaleDateString()
                      : "-";
                    const ref = String(r.ref_no || "-");
                    const party = String(r.party_name || "-").slice(0, 40);
                    const amt = String(Number(r.amount || 0).toLocaleString());
                    const out = String(
                      Number(r.outstanding || 0).toLocaleString(),
                    );
                    const st = String(r.status || "-");
                    doc.text(dd, 10, y);
                    doc.text(ref, 45, y);
                    doc.text(party, 85, y);
                    doc.text(amt, 140, y);
                    doc.text(out, 165, y);
                    doc.text(st, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("payment-due.pdf");
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
                  <th>Due Date</th>
                  <th>Reference</th>
                  <th>Party</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.ref_no || "-"}</td>
                    <td>{r.party_name || "-"}</td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.outstanding || 0).toLocaleString()}
                    </td>
                    <td>{r.status || "-"}</td>
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
