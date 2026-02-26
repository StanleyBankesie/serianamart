import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "All"}</option>
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PosRegister() {
  const { user } = useAuth();
  const { canPerformAction } = usePermission();
  const [now, setNow] = useState(new Date());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [terminalCode, setTerminalCode] = useState("");
  const [assignedTerminals, setAssignedTerminals] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignedTerminals() {
      setTerminalsLoading(true);
      try {
        const [termsRes, linksRes] = await Promise.all([
          api.get("/pos/terminals"),
          api.get("/pos/terminal-users"),
        ]);
        if (cancelled) return;
        const allTerminals = Array.isArray(termsRes.data?.items)
          ? termsRes.data.items
          : [];
        const links = Array.isArray(linksRes.data?.items)
          ? linksRes.data.items
          : [];
        const uid =
          Number(user?.sub || 0) || Number(user?.id || 0) || undefined;
        const assignedIds = new Set(
          links
            .filter((x) => Number(x?.user_id) === uid)
            .map((x) => Number(x?.terminal_id))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        const assigned = allTerminals.filter((t) =>
          assignedIds.has(Number(t?.id)),
        );
        setAssignedTerminals(assigned);
        const code =
          (assigned.length ? String(assigned[0]?.code || "") : "") || "";
        setTerminalCode(code);
      } catch {
        if (cancelled) return;
        setAssignedTerminals([]);
        setTerminalCode("");
      } finally {
        if (cancelled) return;
        setTerminalsLoading(false);
      }
    }
    loadAssignedTerminals();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.sub]);

  useEffect(() => {
    let cancelled = false;
    const params = terminalCode ? { params: { terminal: terminalCode } } : {};
    api
      .get("/pos/sales", params)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = rows.map((it) => {
          const dt = String(it.sale_date || "");
          const date = dt.slice(0, 10);
          const time = dt.includes("T") ? dt.split("T")[1].slice(0, 8) : "";
          return {
            id: it.id,
            receiptNo: String(it.sale_no || ""),
            date,
            time,
            customer: String(it.customer_id || ""),
            phone: "",
            payment: String(it.payment_method || "").toLowerCase(),
            status: String(it.payment_status || "").toLowerCase(),
            items: [],
            total_amount: Number(it.total_amount || 0),
            items_count: Number(it.items_count || 0),
          };
        });
        setTransactions(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setTransactions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [terminalCode]);

  const calculateTotal = (items) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = subtotal * 0.125;
    return subtotal + tax;
  };
  const calculateSubtotal = (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filtered = useMemo(() => {
    const term = String(searchTerm || "").toLowerCase();
    return transactions.filter((t) => {
      const okDate =
        (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo);
      const okStatus = !statusFilter || t.status === statusFilter;
      const okPayment = !paymentFilter || t.payment === paymentFilter;
      const okSearch =
        !term ||
        t.receiptNo.toLowerCase().includes(term) ||
        t.customer.toLowerCase().includes(term);
      return okDate && okStatus && okPayment && okSearch;
    });
  }, [transactions, dateFrom, dateTo, statusFilter, paymentFilter, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filtered.slice(start, end);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, statusFilter, paymentFilter, searchTerm]);

  function exportToCSV() {
    const headers = [
      "Receipt",
      "Date",
      "Time",
      "Customer",
      "Phone",
      "Payment",
      "Status",
      "Items",
      "Total",
    ];
    const rows = filtered.map((t) => [
      t.receiptNo,
      t.date,
      t.time,
      t.customer,
      t.phone,
      t.payment,
      t.status,
      t.items.reduce((s, i) => s + i.quantity, 0),
      calculateTotal(t.items).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pos_register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function printRegister() {
    window.print();
  }

  function closeRegister() {
    alert("Register closing flow will be implemented with sessions.");
  }

  function printTransaction(id) {
    alert("Printing transaction " + id);
  }

  function deleteTransaction(id) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function openDetails(t) {
    try {
      const res = await api.get(`/pos/sales/${t.id}`);
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      const items = details.map((d) => ({
        name: String(d.item_name || ""),
        price: Number(d.unit_price || 0),
        quantity: Number(d.qty || 0),
      }));
      setSelected({ ...t, items });
    } catch {
      setSelected(t);
    }
  }

  function closeModal() {
    setSelected(null);
  }

  function printReceipt() {
    alert("Printing receipt " + String(selected?.receiptNo || ""));
  }

  function emailReceipt() {
    alert("Emailing receipt " + String(selected?.receiptNo || ""));
  }

  const showingFrom = filtered.length ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = Math.min(page * itemsPerPage, filtered.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Register
          </h1>
          <p className="text-sm mt-1">Transactions listing and details</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700">
            {now.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 flex-1">
            <div>
              <label className="label">Terminal</label>
              <FilterableSelect
                value={terminalCode}
                onChange={setTerminalCode}
                placeholder={
                  terminalsLoading
                    ? "Loading terminals..."
                    : "All Terminals (assigned)"
                }
                options={(Array.isArray(assignedTerminals)
                  ? assignedTerminals
                  : []
                ).map((t) => ({
                  value: String(t.code || ""),
                  label: String(t.code || t.name || ""),
                }))}
                disabled={terminalsLoading}
                filterPlaceholder="Filter terminals..."
              />
            </div>
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <FilterableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Status"
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                  { value: "returned", label: "Returned" },
                ]}
                filterPlaceholder="Filter status..."
              />
            </div>
            <div>
              <label className="label">Payment</label>
              <FilterableSelect
                value={paymentFilter}
                onChange={setPaymentFilter}
                placeholder="All Payments"
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "mobile", label: "Mobile Money" },
                ]}
                filterPlaceholder="Filter payments..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Search</label>
              <input
                className="input"
                placeholder="Search receipt or customer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-success" onClick={exportToCSV}>
              Export CSV
            </button>
            <button className="btn-primary" onClick={printRegister}>
              Print
            </button>
            <button className="btn-danger" onClick={closeRegister}>
              Close Register
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date/Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!pageItems.length ? (
                <tr>
                  <td colSpan="8">
                    <div className="text-center text-slate-600 py-6">
                      No transactions found
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => {
                  const total = Number(t.total_amount || 0);
                  const itemCount = Number(t.items_count || 0);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openDetails(t)}
                      className="cursor-pointer"
                    >
                      <td className="font-medium">{t.receiptNo}</td>
                      <td>
                        {t.date}
                        <div className="text-xs text-slate-500">{t.time}</div>
                      </td>
                      <td>
                        {t.customer}
                        <div className="text-xs text-slate-500">{t.phone}</div>
                      </td>
                      <td>{itemCount}</td>
                      <td>
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                          {String(t.payment || "").toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right">
                        {`GH₵ ${Number(total).toFixed(2)}`}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            t.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : t.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {String(t.status || "").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {canPerformAction("pos:register", "view") && (
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(t);
                              }}
                            >
                              View
                            </button>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              printTransaction(t.id);
                            }}
                          >
                            Print
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTransaction(t.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          Showing {showingFrom} to {showingTo} of {filtered.length} transactions
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`btn ${page === n ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
          >
            Next →
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold">Transaction Details</div>
              <button className="btn btn-secondary" onClick={closeModal}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <div className="text-slate-500 text-sm">Receipt Number</div>
                <div className="font-medium">{selected.receiptNo}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Date & Time</div>
                <div className="font-medium">
                  {selected.date} {selected.time}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Customer</div>
                <div className="font-medium">{selected.customer}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Payment Method</div>
                <div className="font-medium">
                  {String(selected.payment || "").toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Cashier</div>
                <div className="font-medium">{selected.cashier}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Status</div>
                <div className="font-medium">
                  {String(selected.status || "").toUpperCase()}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="font-semibold mb-2">Items Purchased</div>
              <div className="space-y-2">
                {selected.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-slate-600">
                        {it.quantity} × GH₵ {Number(it.price).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {`GH₵ ${(it.quantity * it.price).toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between">
                <div>Subtotal</div>
                <div>{`GH₵ ${calculateSubtotal(selected.items).toFixed(
                  2,
                )}`}</div>
              </div>
              <div className="flex justify-between">
                <div>Tax</div>
                <div>{`GH₵ ${(
                  calculateSubtotal(selected.items) * 0.125
                ).toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <div>Total</div>
                <div>{`GH₵ ${calculateTotal(selected.items).toFixed(2)}`}</div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button className="btn btn-primary" onClick={printReceipt}>
                Print Receipt
              </button>
              <button className="btn btn-secondary" onClick={emailReceipt}>
                Email Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
