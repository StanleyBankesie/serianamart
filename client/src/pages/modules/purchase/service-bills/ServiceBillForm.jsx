import React, { useMemo, useState } from "react";
import { api } from "../../../../api/client";
import { Link } from "react-router-dom";

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: {
      label: "✓ PAID",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    overdue: {
      label: "⚠ OVERDUE",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    pending: {
      label: "⏳ PENDING",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
  };
  const d = map[s] || map.pending;
  return (
    <span className={`inline-block px-3 py-1 text-xs rounded border ${d.cls}`}>
      {d.label}
    </span>
  );
}

function ServiceRow({ idx, row, onChange, onRemove }) {
  const update = (key, value) => onChange(idx, { ...row, [key]: value });
  const qty = Number(row.qty || 0);
  const rate = Number(row.rate || 0);
  const amount = qty * rate;
  return (
    <tr>
      <td className="p-2">{idx + 1}</td>
      <td className="p-2">
        <input
          className="input"
          value={row.desc || ""}
          onChange={(e) => update("desc", e.target.value)}
          placeholder="Service description"
        />
      </td>
      <td className="p-2">
        <select
          className="input"
          value={row.category || ""}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">Select</option>
          <option>Consultation</option>
          <option>Maintenance</option>
          <option>Repair</option>
          <option>Installation</option>
          <option>Support</option>
          <option>Other</option>
        </select>
      </td>
      <td className="p-2">
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          value={qty}
          onChange={(e) => update("qty", e.target.value)}
        />
      </td>
      <td className="p-2">
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={row.rate || 0}
          onChange={(e) => update("rate", e.target.value)}
        />
      </td>
      <td className="p-2 text-right">
        {amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>
      <td className="p-2">
        <button
          type="button"
          className="btn-danger btn-sm"
          onClick={() => onRemove(idx)}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export default function ServiceBillForm() {
  const [bill, setBill] = useState({
    number: "SB-2025-001",
    clientName: "",
    clientCompany: "",
    clientAddress: "",
    clientPhone: "",
    clientEmail: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })(),
    serviceDate: new Date().toISOString().slice(0, 10),
    status: "pending",
    paymentMethod: "cash",
    paymentReference: "",
    paymentTerms:
      "Payment is due within 30 days of the bill date. Please make checks payable to Your Company Name.",
    notes: "",
    discountPercent: 0,
    taxPercent: 0,
  });
  const [rows, setRows] = useState([
    { desc: "", category: "", qty: 1, rate: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [serverId, setServerId] = useState(null);

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, r) => sum + Number(r.qty || 0) * Number(r.rate || 0),
      0
    );
    const discountAmount = subtotal * (Number(bill.discountPercent || 0) / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (Number(bill.taxPercent || 0) / 100);
    const grandTotal = afterDiscount + taxAmount;
    return { subtotal, discountAmount, taxAmount, grandTotal };
  }, [rows, bill.discountPercent, bill.taxPercent]);

  function update(key, value) {
    setBill((prev) => ({ ...prev, [key]: value }));
  }
  function addRow() {
    setRows((prev) => [...prev, { desc: "", category: "", qty: 1, rate: 0 }]);
  }
  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? patch : r)));
  }
  function removeRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function selectPaymentMethod(method) {
    update("paymentMethod", method);
  }
  function printBill() {
    window.print();
  }
  function saveDraft() {
    if (saving) return;
    setSaving(true);
    const payload = {
      bill_no: bill.number || undefined,
      bill_date: bill.billDate,
      due_date: bill.dueDate,
      service_date: bill.serviceDate,
      status: bill.status,
      client_name: bill.clientName,
      client_company: bill.clientCompany,
      client_address: bill.clientAddress,
      client_phone: bill.clientPhone,
      client_email: bill.clientEmail,
      payment_method: bill.paymentMethod,
      payment_reference: bill.paymentReference,
      payment_terms: bill.paymentTerms,
      notes: bill.notes,
      discount_percent: bill.discountPercent,
      tax_percent: bill.taxPercent,
      rows,
    };
    api
      .post("/purchase/service-bills", payload)
      .then((res) => {
        const id = res?.data?.id || null;
        const billNo = res?.data?.bill_no || bill.number;
        setServerId(id);
        setBill((prev) => ({ ...prev, number: billNo }));
        alert("Bill saved");
      })
      .catch((err) => {
        alert(
          err?.response?.data?.message ||
            "Failed to save bill. Please try again."
        );
      })
      .finally(() => {
        setSaving(false);
      });
  }
  function emailClient() {
    if (!bill.clientEmail) {
      alert("Please enter client email address first.");
      return;
    }
    alert(`Bill will be sent to: ${bill.clientEmail} (demo)`);
  }
  function downloadPDF() {
    alert("Use browser print to save as PDF (demo).");
  }
  function resetAll() {
    if (!confirm("Clear all data?")) return;
    setBill((prev) => ({
      ...prev,
      clientName: "",
      clientCompany: "",
      clientAddress: "",
      clientPhone: "",
      clientEmail: "",
      paymentReference: "",
      notes: "",
      discountPercent: 0,
      taxPercent: 0,
      status: "pending",
    }));
    setRows([{ desc: "", category: "", qty: 1, rate: 0 }]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/purchase"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Purchase
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Service Bill
          </h1>
          <p className="text-sm mt-1">
            Prepare and issue bill for services provided
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-600">BILL NO.</div>
          <div className="text-lg font-semibold">{bill.number}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Bill To</div>
            <StatusBadge status={bill.status} />
          </div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Client Name</label>
            <input
              className="input"
              value={bill.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              placeholder="Client Name"
            />
          </div>
          <div>
            <label className="label">Company Name</label>
            <input
              className="input"
              value={bill.clientCompany}
              onChange={(e) => update("clientCompany", e.target.value)}
              placeholder="Company Name"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input
              className="input"
              value={bill.clientAddress}
              onChange={(e) => update("clientAddress", e.target.value)}
              placeholder="Address"
            />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input
              className="input"
              value={bill.clientPhone}
              onChange={(e) => update("clientPhone", e.target.value)}
              placeholder="+233 ..."
            />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input
              className="input"
              type="email"
              value={bill.clientEmail}
              onChange={(e) => update("clientEmail", e.target.value)}
              placeholder="name@example.com"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Bill Information</div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Bill Date</label>
            <input
              className="input"
              type="date"
              value={bill.billDate}
              onChange={(e) => update("billDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              className="input"
              type="date"
              value={bill.dueDate}
              onChange={(e) => update("dueDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Service Date</label>
            <input
              className="input"
              type="date"
              value={bill.serviceDate}
              onChange={(e) => update("serviceDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={bill.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Services Provided</div>
            <button type="button" className="btn-secondary" onClick={addRow}>
              + Add Service
            </button>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2 w-1/3">Service Description</th>
                <th className="text-left p-2 w-40">Category</th>
                <th className="text-left p-2 w-24">Quantity</th>
                <th className="text-left p-2 w-32">Rate</th>
                <th className="text-right p-2 w-32">Amount</th>
                <th className="p-2 w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="p-2 text-center" colSpan={7}>
                    No services added
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <ServiceRow
                    key={idx}
                    idx={idx}
                    row={row}
                    onChange={updateRow}
                    onRemove={removeRow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Totals</div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <div>Subtotal</div>
              <div className="font-semibold">
                {totals.subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>Discount</div>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={bill.discountPercent}
                  onChange={(e) => update("discountPercent", e.target.value)}
                />
                <span>%</span>
                <span className="font-semibold">
                  {totals.discountAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>Tax</div>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={bill.taxPercent}
                  onChange={(e) => update("taxPercent", e.target.value)}
                />
                <span>%</span>
                <span className="font-semibold">
                  {totals.taxAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <div className="flex justify-between border-t pt-2">
              <div className="font-semibold">TOTAL AMOUNT</div>
              <div className="font-bold text-lg">
                {totals.grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">Payment Method</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { key: "cash", icon: "💵", label: "Cash" },
                { key: "card", icon: "💳", label: "Credit/Debit" },
                { key: "bank", icon: "🏦", label: "Bank Transfer" },
                { key: "check", icon: "📝", label: "Check" },
                { key: "mobile", icon: "📱", label: "Mobile Money" },
              ].map((m) => {
                const active = bill.paymentMethod === m.key;
                return (
                  <button
                    type="button"
                    key={m.key}
                    className={`p-3 rounded border text-left ${
                      active
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white"
                    }`}
                    onClick={() => selectPaymentMethod(m.key)}
                  >
                    <div className="text-2xl">{m.icon}</div>
                    <div className="text-sm">{m.label}</div>
                  </button>
                );
              })}
            </div>
            <div>
              <label className="label">
                Payment Reference / Transaction ID
              </label>
              <input
                className="input"
                value={bill.paymentReference}
                onChange={(e) => update("paymentReference", e.target.value)}
                placeholder="Enter reference number"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Terms & Notes</div>
        </div>
        <div className="card-body space-y-3">
          <div>
            <label className="label">Payment Terms</label>
            <textarea
              className="input h-24"
              value={bill.paymentTerms}
              onChange={(e) => update("paymentTerms", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Additional Notes</label>
            <textarea
              className="input h-24"
              value={bill.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional information or special instructions..."
            />
          </div>
          <div className="flex flex-col md:flex-row gap-2 mt-2">
            <button type="button" className="btn-primary" onClick={printBill}>
              🖨️ Print Bill
            </button>
            <button type="button" className="btn-success" onClick={downloadPDF}>
              📄 Download PDF
            </button>
            <button type="button" className="btn-primary" onClick={emailClient}>
              📧 Email to Client
            </button>
            <button type="button" className="btn-secondary" onClick={saveDraft}>
              💾 Save Draft
            </button>
            <button type="button" className="btn-secondary" onClick={resetAll}>
              🔄 Clear All
            </button>
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Thank you for your business!
          </div>
        </div>
      </div>
    </div>
  );
}
