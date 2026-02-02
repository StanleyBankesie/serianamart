import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";

export default function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/sales/quotations");
      const items =
        (response.data && response.data.data && response.data.data.items) ||
        response.data?.items ||
        [];
      setQuotations(Array.isArray(items) ? items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching quotations");
      console.error("Error fetching quotations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      SENT: "badge badge-info",
      ACCEPTED: "badge badge-success",
      REJECTED: "badge badge-error",
      EXPIRED:
        "badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    };
    return <span className={statusClasses[status] || "badge"}>{status}</span>;
  };

  const filteredQuotations = quotations.filter((quot) => {
    const matchesSearch =
      String(quot.quotation_no || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(quot.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || quot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-8">Loading quotations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Quotations
              </h1>
              <p className="text-sm mt-1">
                Manage customer quotations and proposals
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/sales/quotations/new" className="btn-success">
                + New Quotation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by quotation number or customer..."
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
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading quotations...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No quotations found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Quotation No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Valid Until</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((quot) => (
                    <tr key={quot.id}>
                      <td className="font-medium">{quot.quotation_no}</td>
                      <td>
                        {new Date(quot.quotation_date).toLocaleDateString()}
                      </td>
                      <td>{quot.customer_name}</td>
                      <td>{new Date(quot.valid_until).toLocaleDateString()}</td>
                      <td className="font-semibold">
                        {quot.total_amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>{getStatusBadge(quot.status)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              navigate(`/sales/quotations/${quot.id}?mode=view`)
                            }
                            className="text-brand hover:text-brand-600 font-medium text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/sales/quotations/${quot.id}?mode=edit`)
                            }
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
