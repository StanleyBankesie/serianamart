import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

function fmt(n) {
  return `GH₵ ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PosCustomerHistory() {
  const [customerName, setCustomerName] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
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
      if (customerName.trim()) params.customerName = customerName.trim();
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
    setCustomerName("");
    setFromDate(today());
    setToDate(today());
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
    return {
      count: items.length,
      gross: items.reduce((s, x) => s + Number(x.gross_amount || 0), 0),
      discount: items.reduce((s, x) => s + Number(x.discount_amount || 0), 0),
      tax: items.reduce((s, x) => s + Number(x.tax_amount || 0), 0),
      net: items.reduce((s, x) => s + Number(x.net_amount || 0), 0),
    };
  }, [items]);

  const uniqueCustomersCount = useMemo(
    () =>
      [...new Set(items.map((x) => x.customer_name).filter(Boolean))].length,
    [items],
  );

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
            Customer Purchase History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View historical POS transactions by customer and date range
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
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={customersLoading}
                >
                  <option value="">All Customers / Walk-in</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.customer_name}>
                      {c.customer_code ? `${c.customer_code} - ` : ""}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Transactions
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totals.count}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Customers
            </div>
            <div className="text-2xl font-bold text-brand-700">
              {uniqueCustomersCount}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Gross Amount
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {fmt(totals.gross)}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Tax Total
            </div>
            <div className="text-lg font-bold text-orange-700">
              {fmt(totals.tax)}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="text-xs uppercase text-slate-500 mb-1">
              Net Amount
            </div>
            <div className="text-lg font-bold text-green-700">
              {fmt(totals.net)}
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
                    <th>Customer</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Net</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <React.Fragment key={it.id}>
                      <tr
                        className="border-t cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() =>
                          setExpandedId(expandedId === it.id ? null : it.id)
                        }
                      >
                        <td className="text-center text-slate-400 select-none">
                          {expandedId === it.id ? "▾" : "▸"}
                        </td>
                        <td className="font-medium">
                          <button
                            type="button"
                            className="text-brand hover:text-brand-600 font-medium"
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
                        <td>
                          {it.customer_name || (
                            <span className="text-slate-400 italic">
                              Walk-in
                            </span>
                          )}
                        </td>
                        <td className="text-right">{fmt(it.gross_amount)}</td>
                        <td className="text-right text-orange-600">
                          {fmt(it.discount_amount)}
                        </td>
                        <td className="text-right text-blue-600">
                          {fmt(it.tax_amount)}
                        </td>
                        <td className="text-right font-semibold text-green-700">
                          {fmt(it.net_amount)}
                        </td>
                        <td>
                          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                            {it.status || "COMPLETED"}
                          </span>
                        </td>
                      </tr>
                      {expandedId === it.id && (
                        <tr>
                          <td
                            colSpan={9}
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
                  ))}
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
                    {selectedTransaction.payment_method || "-"}
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
                    <p className="font-semibold text-slate-900">Net Amount:</p>
                  </div>
                  <div className="border-t border-slate-300 pt-2 font-bold text-lg text-green-700">
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
