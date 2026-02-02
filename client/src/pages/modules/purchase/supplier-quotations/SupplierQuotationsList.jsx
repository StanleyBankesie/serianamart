import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function SupplierQuotationsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/purchase/supplier-quotations")
      .then((res) => {
        if (!mounted) return;
        setQuotations(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load supplier quotations"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: "badge-neutral",
      SUBMITTED: "badge-info",
      RECEIVED: "badge-info",
      UNDER_REVIEW: "badge-warning",
      ACCEPTED: "badge-success",
      REJECTED: "badge-error",
    };
    return statusConfig[status] || "badge-info";
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        String(q.quotation_no || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(q.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(q.rfq_no || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Supplier Quotations
          </h1>
          <p className="text-sm mt-1">
            Receive and manage supplier quotations
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/purchase/supplier-quotations/new" className="btn-success">
            + New Quotation
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by quotation no, supplier, or RFQ no..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="RECEIVED">Received</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Quotation No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>RFQ No</th>
                <th>Valid Until</th>
                <th className="text-right">Total Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No quotations found
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td className="font-medium">{quotation.quotation_no}</td>
                    <td>
                      {new Date(quotation.quotation_date).toLocaleDateString()}
                    </td>
                    <td>{quotation.supplier_name}</td>
                    <td>{quotation.rfq_no}</td>
                    <td>
                      {quotation.valid_until
                        ? new Date(quotation.valid_until).toLocaleDateString()
                        : ""}
                    </td>
                    <td className="text-right font-medium">
                      {quotation.total_amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(quotation.status)}`}
                      >
                        {quotation.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/purchase/supplier-quotations/${quotation.id}`}
                          className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                        >
                          View
                        </Link>
                        <Link
                          to={`/purchase/supplier-quotations/${quotation.id}/edit`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span>
              Showing {filteredQuotations.length} of {quotations.length}{" "}
              quotations
            </span>
            <div className="flex gap-2">
              <button className="btn-success px-3 py-1.5" disabled>
                Previous
              </button>
              <button className="btn-success px-3 py-1.5" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







