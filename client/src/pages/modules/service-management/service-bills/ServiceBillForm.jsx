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
          <option value="">Select service</option>
          <option value="installation">Installation</option>
          <option value="maintenance">Maintenance</option>
          <option value="repair">Repair</option>
          <option value="consultation">Consultation</option>
        </select>
      </td>
      <td className="p-2">
        <input
          className="input text-right"
          type="number"
          value={row.qty ?? ""}
          onChange={(e) => update("qty", e.target.value)}
          placeholder="Qty"
        />
      </td>
      <td className="p-2">
        <input
          className="input text-right"
          type="number"
          value={row.rate ?? ""}
          onChange={(e) => update("rate", e.target.value)}
          placeholder="Rate"
        />
      </td>
      <td className="p-2 text-right">{Number(amount || 0).toFixed(2)}</td>
      <td className="p-2">
        <button
          type="button"
          className="btn-danger"
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
    number: "",
    status: "pending",
    clientName: "",
    clientCompany: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientZip: "",
    clientPhone: "",
    clientEmail: "",
    billDate: "",
    dueDate: "",
    services: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentMethod: "cash",
    paymentReference: "",
    notes: "",
    terms: "",
  });
  const [methods] = useState([
    { key: "cash", label: "Cash", icon: "💵" },
    { key: "card", label: "Card", icon: "💳" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
    { key: "bank", label: "Bank Transfer", icon: "🏦" },
  ]);

  const selectPaymentMethod = (v) => {
    setBill((prev) => ({ ...prev, paymentMethod: v }));
  };
  const update = (key, value) => {
    setBill((prev) => ({ ...prev, [key]: value }));
  };
  const addRow = () => {
    setBill((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        { desc: "", category: "", qty: "", rate: "" },
      ],
    }));
  };
  const removeRow = (idx) => {
    setBill((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== idx),
    }));
  };
  const setRow = (idx, row) => {
    setBill((prev) => ({
      ...prev,
      services: prev.services.map((r, i) => (i === idx ? row : r)),
    }));
  };

  const totals = useMemo(() => {
    const subtotal = bill.services.reduce((sum, r) => {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      return sum + qty * rate;
    }, 0);
    const tax = subtotal * 0.0;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [bill.services]);

  React.useEffect(() => {
    setBill((prev) => ({
      ...prev,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
    }));
  }, [totals.subtotal, totals.tax, totals.total]);

  function saveBill() {
    const payload = {
      number: bill.number || null,
      status: bill.status || "pending",
      client_name: bill.clientName || null,
      client_company: bill.clientCompany || null,
      client_address: bill.clientAddress || null,
      client_city: bill.clientCity || null,
      client_state: bill.clientState || null,
      client_zip: bill.clientZip || null,
      client_phone: bill.clientPhone || null,
      client_email: bill.clientEmail || null,
      bill_date: bill.billDate || null,
      due_date: bill.dueDate || null,
      services: bill.services.map((s) => ({
        description: s.desc || "",
        category: s.category || "",
        qty: Number(s.qty || 0),
        unit_price: Number(s.rate || 0),
      })),
      subtotal: Number(totals.subtotal || 0),
      tax_amount: Number(totals.tax || 0),
      total_amount: Number(totals.total || 0),
      payment_method: bill.paymentMethod || "cash",
      payment_reference: bill.paymentReference || null,
      notes: bill.notes || null,
      terms: bill.terms || null,
    };
    api
      .post("/purchase/service-bills", payload)
      .then(() => alert("Service bill saved"))
      .catch((e) =>
        alert(e?.response?.data?.message || "Failed to save service bill"),
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/service-management"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Service Management
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
            <div className="font-semibold">Client Information</div>
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
            <label className="label">Street Address</label>
            <input
              className="input"
              value={bill.clientAddress}
              onChange={(e) => update("clientAddress", e.target.value)}
              placeholder="123 Main Street"
            />
          </div>
          <div>
            <label className="label">City</label>
            <input
              className="input"
              value={bill.clientCity}
              onChange={(e) => update("clientCity", e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <label className="label">State</label>
            <input
              className="input"
              value={bill.clientState}
              onChange={(e) => update("clientState", e.target.value)}
              placeholder="NY"
            />
          </div>
          <div>
            <label className="label">Zip Code</label>
            <input
              className="input"
              value={bill.clientZip}
              onChange={(e) => update("clientZip", e.target.value)}
              placeholder="10001"
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
          <div className="md:col-span-2">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.services.map((row, idx) => (
                    <ServiceRow
                      key={idx}
                      idx={idx}
                      row={row}
                      onChange={setRow}
                      onRemove={removeRow}
                    />
                  ))}
                  <tr>
                    <td colSpan="7">
                      <button
                        type="button"
                        className="btn-success"
                        onClick={addRow}
                      >
                        + Add Service Line
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Payment Details</div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {methods.map((m) => {
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
              className="input"
              rows={3}
              value={bill.terms}
              onChange={(e) => update("terms", e.target.value)}
              placeholder="Payment due within 14 days"
            />
          </div>
          <div>
            <label className="label">Additional Notes</label>
            <textarea
              className="input"
              rows={3}
              value={bill.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional information"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => {}}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={saveBill}>
          Save Bill
        </button>
      </div>
    </div>
  );
}
