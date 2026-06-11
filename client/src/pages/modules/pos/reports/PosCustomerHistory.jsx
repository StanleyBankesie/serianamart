import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";

function fmt(n) {
  return `GH₵ ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceTotal(it) {
  return Number(it.gross_amount || 0) + Number(it.tax_amount || 0) - Number(it.discount_amount || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function yearStart() {
  const y = new Date().getFullYear();
  return `${y}-01-01`;
}
function yearEnd() {
  const y = new Date().getFullYear();
  return `${y}-12-31`;
}

export default function PosCustomerHistory() {
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [fromDate, setFromDate] = useState(yearStart());
  const [toDate, setToDate] = useState(yearEnd());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    let mounted = true;
    setCustomersLoading(true);
    api
      .get("/sales/customers")
      .then((res) => {
        if (mounted) {
          setCustomers(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      })
      .catch(() => {
        if (mounted) setCustomers([]);
      })
      .finally(() => {
        if (mounted) setCustomersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItems([]);
    setSearched(false);
    setExpandedId(null);
    try {
      const params = {};
      if (customerId) {
        params.customerId = customerId;
      } else if (customerName.trim()) {
        params.customerName = customerName.trim();
      }
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/pos/customer-history", { params });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setSearched(true);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to load customer history",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCustomerId("");
    setCustomerName("");
    setFromDate(yearStart());
    setToDate(yearEnd());
    setItems([]);
    setSearched(false);
    setError("");
    setExpandedId(null);
  }

  async function handleOpenModal(transaction) {
    setSelectedTransaction(transaction);
    setModalLoading(true);
    try {
      const res = await api.get(`/pos/sales/${transaction.id}`);
      const item = res.data?.item || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      if (item) {
        setSelectedTransaction({ ...item, lines: details });
        setShowModal(true);
      } else {
        alert("Transaction not found");
      }
    } catch (err) {
      alert(
        err?.response?.data?.message || "Failed to load transaction details",
      );
    } finally {
      setModalLoading(false);
    }
  }

  const totals = useMemo(() => {
    const paid = items.filter((x) => String(x.payment_status || "").toUpperCase() === "PAID");
    const unpaid = items.filter((x) => String(x.payment_status || "").toUpperCase() === "UNPAID");
    let running = 0;
    items.forEach((it) => {
      const p = String(it.payment_status || "").toUpperCase() === "PAID";
      const inv = invoiceTotal(it);
      const paidAmt = Number(it.paid_amount || 0);
      running += inv - Math.max(paidAmt, p ? inv : 0);
    });
    return {
      count: items.length,
      gross: items.reduce((s, x) => s + Number(x.gross_amount || 0), 0),
      discount: items.reduce((s, x) => s + Number(x.discount_amount || 0), 0),
      tax: items.reduce((s, x) => s + Number(x.tax_amount || 0), 0),
      net: items.reduce((s, x) => s + invoiceTotal(x), 0),
      paidCount: paid.length,
      paidNet: items.reduce((s, x) => s + Number(x.paid_amount || 0), 0),
      unpaidCount: unpaid.length,
      overallBalance: Math.abs(running),
      balanceIsNegative: running < 0,
    };
  }, [items]);

  async function handleSavePayment(saleId) {
    const val = editValues[saleId];
    if (val === undefined || val === "") return;
    const paid_amount = Number(val);
    if (isNaN(paid_amount) || paid_amount < 0) {
      toast.error("Payment amount must be a non-negative number");
      return;
    }
    setPayingId(saleId);
    try {
      const res = await api.put(`/pos/sales/${saleId}/payment-status`, { paid_amount });
      const { payment_status } = res.data;
      setItems((prev) =>
        prev.map((it) =>
          it.id === saleId ? { ...it, paid_amount, payment_status } : it,
        ),
      );
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[saleId];
        return next;
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to record payment");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
              Customer Accounts
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              View customer transactions and balances
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Search Filters</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="label">Customer Name</label>
                <select
                  id="customer-history-name"
                  className="input"
                  value={customerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCustomerId(id);
                    const c = customers.find((x) => String(x.id) === String(id));
                    setCustomerName(c ? c.customer_name : "");
                  }}
                  disabled={customersLoading}
                >
                  <option value="">All Customers / Walk-in</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">From Date</label>
                <input
                  id="customer-history-from"
                  type="date"
                  className="input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">To Date</label>
                <input
                  id="customer-history-to"
                  type="date"
                  className="input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                id="customer-history-search"
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? "Searching…" : "Search"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                disabled={loading}
              >
                Reset
              </button>
            </div>
          </form>
          {error && (
            <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {searched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <div className="text-xs uppercase text-green-700 mb-1">
              Payment ({totals.paidCount})
            </div>
            <div className="text-lg font-bold text-green-700">
              {fmt(totals.paidNet)}
            </div>
          </div>
          <div className={`p-4 rounded-lg border ${totals.balanceIsNegative ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'}`}>
            <div className={`text-xs uppercase mb-1 ${totals.balanceIsNegative ? 'text-green-700' : 'text-red-700'}`}>
              Balance ({totals.unpaidCount})
            </div>
            <div className={`text-lg font-bold ${totals.balanceIsNegative ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(totals.overallBalance)}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Total Sales
            </div>
            <div className="text-lg font-bold text-green-700">
              {fmt(totals.net)}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Transactions
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totals.count}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {searched && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="card-title">
              Results{items.length > 0 ? ` (${items.length})` : ""}
            </h2>
          </div>
          <div className="card-body overflow-x-auto p-0">
            {items.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                No transactions found for the selected criteria.
              </div>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-6"></th>
                    <th>Receipt No</th>
                    <th>Date &amp; Time</th>
                    <th className="text-right">Invoice Amount</th>
                    <th className="text-right text-green-700">Payment</th>
                    <th className="text-right text-red-700">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let running = 0;
                    const withBalance = items.map((it) => {
                    const isPaid = String(it.payment_status || "").toUpperCase() === "PAID";
                    const invoiceAmt = invoiceTotal(it);
                    const paidAmt = Number(it.paid_amount || 0);
                    const effectivePayment = Math.max(paidAmt, isPaid ? invoiceAmt : 0);
                    running += invoiceAmt - effectivePayment;
                    return { ...it, _isPaid: isPaid, _invoiceAmt: invoiceAmt, _paidAmt: paidAmt, _balanceAmt: running };
                    });
                    return withBalance.slice().reverse().map((it) => {
                    const { _isPaid: isPaid, _invoiceAmt: invoiceAmt, _paidAmt: paidAmt, _balanceAmt: balanceAmt } = it;
                    return (
                    <React.Fragment key={it.id}>
                      <tr className="border-t hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td
                          className="text-center text-slate-400 select-none cursor-pointer"
                          onClick={() =>
                            setExpandedId(expandedId === it.id ? null : it.id)
                          }
                        >
                          {expandedId === it.id ? "▾" : "▸"}
                        </td>
                        <td className="font-medium">
                          <button
                            type="button"
                            className="text-blue-500 hover:text-blue-600 font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(it);
                            }}
                            disabled={modalLoading}
                          >
                            {it.receipt_no || "-"}
                          </button>
                        </td>
                        <td>
                          {it.sale_datetime
                            ? String(it.sale_datetime)
                                .replace("T", " ")
                                .slice(0, 16)
                            : "-"}
                        </td>
                        <td className="text-right font-semibold">
                          {fmt(invoiceAmt)}
                        </td>
                        <td className="text-right font-semibold text-green-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isPaid ? (
                            fmt(paidAmt)
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-24 px-1 py-0.5 text-right text-sm border border-slate-300 rounded"
                                value={editValues[it.id] ?? (paidAmt || "")}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [it.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleSavePayment(it.id);
                                  }
                                }}
                                disabled={payingId === it.id}
                              />
                              <button
                                type="button"
                                disabled={payingId === it.id}
                                className="px-1.5 py-0.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                onClick={() => handleSavePayment(it.id)}
                              >
                                {payingId === it.id ? "..." : "Pay"}
                              </button>
                            </span>
                          )}
                        </td>
                        <td className={`text-right font-semibold ${balanceAmt < 0 ? "text-green-600" : "text-red-700"}`}>
                          {fmt(balanceAmt)}
                        </td>
                      </tr>
                      {expandedId === it.id && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-slate-50 dark:bg-slate-900 px-6 py-3"
                          >
                            {Array.isArray(it.lines) && it.lines.length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-slate-500">
                                    <th className="pb-1 font-medium">Item</th>
                                    <th className="pb-1 font-medium text-right">
                                      Qty
                                    </th>
                                    <th className="pb-1 font-medium text-right">
                                      Unit Price
                                    </th>
                                    <th className="pb-1 font-medium text-right">
                                      Line Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {it.lines.map((ln, idx) => (
                                    <tr
                                      key={idx}
                                      className="border-t border-slate-200"
                                    >
                                      <td className="py-1">
                                        {ln.item_name || "-"}
                                      </td>
                                      <td className="py-1 text-right">
                                        {Number(ln.qty || 0).toFixed(2)}
                                      </td>
                                      <td className="py-1 text-right">
                                        {fmt(ln.unit_price)}
                                      </td>
                                      <td className="py-1 text-right font-medium">
                                        {fmt(ln.line_total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-slate-400 italic text-sm">
                                No line items available.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                });
                })()}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Receipt Details: {selectedTransaction.receipt_no}
              </h2>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase text-slate-500 mb-1">
                    Receipt No
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedTransaction.receipt_no}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 mb-1">
                    Date & Time
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedTransaction.sale_datetime
                      ? new Date(
                          selectedTransaction.sale_datetime,
                        ).toLocaleString()
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 mb-1">
                    Customer
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedTransaction.customer_name || "Walk-in"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 mb-1">
                    Payment Method
                  </p>
                  <p className="font-semibold text-slate-900">
                    {(() => {
                      const pmts = selectedTransaction.payments;
                      if (Array.isArray(pmts) && pmts.length > 1) {
                        return pmts.map((p) => {
                          const m = String(p.method || "").replace(/^./, (c) => c.toUpperCase());
                          return `${m} (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
                        }).join(" + ");
                      }
                      const m = String(selectedTransaction.payment_method || "").replace(/^./, (c) => c.toUpperCase());
                      return m || "-";
                    })()}
                  </p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Line Items
              </h3>
              <div className="border border-slate-200 rounded overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">
                        Item
                      </th>
                      <th className="px-4 py-2 text-right font-semibold">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-right font-semibold">
                        Unit Price
                      </th>
                      <th className="px-4 py-2 text-right font-semibold">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(selectedTransaction.lines) &&
                    selectedTransaction.lines.length > 0 ? (
                      selectedTransaction.lines.map((line, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="px-4 py-2">{line.item_name || "-"}</td>
                          <td className="px-4 py-2 text-right">
                            {Number(line.qty || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {fmt(line.unit_price)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {fmt(line.line_total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-4 text-center text-slate-500 italic"
                        >
                          No line items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-right">
                    <p className="text-slate-600">Gross Amount:</p>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {fmt(selectedTransaction.gross_amount)}
                  </div>

                  <div className="text-right">
                    <p className="text-slate-600">Discount:</p>
                  </div>
                  <div className="font-semibold text-orange-600">
                    {fmt(selectedTransaction.discount_amount)}
                  </div>

                  <div className="text-right">
                    <p className="text-slate-600">Tax:</p>
                  </div>
                  <div className="font-semibold text-blue-600">
                    {fmt(selectedTransaction.tax_amount)}
                  </div>

                  <div className="text-right border-t border-slate-300 pt-2">
                    <p className="font-semibold text-slate-900">Total Amount:</p>
                  </div>
                  <div className="border-t border-slate-300 pt-2 font-bold text-lg text-green-700">
                    {fmt(
                      Number(selectedTransaction.gross_amount || 0) +
                      Number(selectedTransaction.tax_amount || 0) -
                      Number(selectedTransaction.discount_amount || 0)
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-slate-600">Net Amount:</p>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {fmt(selectedTransaction.net_amount)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                className="btn btn-primary ml-auto"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
