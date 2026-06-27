import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function IssueRegisterReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const jan1 = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(jan1);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/issue-register", {
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


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/inventory"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Issue Register
          </h1>
          <p className="text-sm mt-1">
            Items issued to departments or projects
          </p>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const exportRows = rows.map((r) => ({
                    Date: r.issue_date
                      ? new Date(r.issue_date).toLocaleDateString()
                      : "",
                    "Issue No": r.issue_no || "",
                    Department: r.department_name || "",
                    "Item Code": r.item_code || "",
                    "Item Name": r.item_name || "",
                    "Qty Issued": Number(r.qty_issued || 0),
                    Returned: Number(r.returned_qty || 0),
                    Remaining: Number(r.remaining_qty || 0),
                  }));
                  const ws = XLSX.utils.json_to_sheet(exportRows, {
                    header: [
                      "Date",
                      "Issue No",
                      "Department",
                      "Item Code",
                      "Item Name",
                      "Qty Issued",
                      "Returned",
                      "Remaining",
                    ],
                  });
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Issue Register");
                  XLSX.writeFile(wb, "issue-register.xlsx");
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
                  doc.text("Issue Register", 10, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text("Date", 10, y);
                  doc.text("Issue No", 45, y);
                  doc.text("Department", 85, y);
                  doc.text("Item", 120, y);
                  doc.text("Issued", 160, y, { align: "right" });
                  doc.text("Returned", 180, y, { align: "right" });
                  doc.text("Remain", 200, y, { align: "right" });
                  y += 4;
                  doc.line(10, y, 200, y);
                  y += 5;
                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.issue_date
                      ? new Date(r.issue_date).toLocaleDateString()
                      : "-";
                    const no = String(r.issue_no || "-");
                    const dep = String(r.department_name || "-").slice(0, 35);
                    const item = String(
                      r.item_name || r.item_code || "-",
                    ).slice(0, 30);
                    const qtyI = String(
                      Number(r.qty_issued || 0).toLocaleString(),
                    );
                    const qtyR = String(
                      Number(r.returned_qty || 0).toLocaleString(),
                    );
                    const qtyM = String(
                      Number(r.remaining_qty || 0).toLocaleString(),
                    );
                    doc.text(dt, 10, y);
                    doc.text(no, 45, y);
                    doc.text(dep, 85, y);
                    doc.text(item, 120, y);
                    doc.text(qtyI, 160, y, { align: "right" });
                    doc.text(qtyR, 180, y, { align: "right" });
                    doc.text(qtyM, 200, y, { align: "right" });
                    y += 5;
                  });
                  doc.save("issue-register.pdf");
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
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Issue No" sortKey="issue_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Department" sortKey="department" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Qty Issued" sortKey="qty_issued" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Returned" sortKey="returned" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Remaining" sortKey="remaining" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.issue_date
                        ? new Date(r.issue_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.issue_no || "-"}</td>
                    <td>{r.department_name || "-"}</td>
                    <td>{r.item_name || r.item_code}</td>
                    <td className="text-right">
                      {Number(r.qty_issued || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.returned_qty || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.remaining_qty || 0).toLocaleString()}
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
