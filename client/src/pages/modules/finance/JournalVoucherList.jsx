import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 * Journal Voucher List Page
 * Displays all journal vouchers with search, filter, and action capabilities
 */
export default function JournalVoucherList() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/finance/vouchers", {
        params: { voucherTypeCode: "JV" },
      });
      setVouchers(
        Array.isArray(response.data?.items) ? response.data.items : []
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching vouchers");
      console.error("Error fetching vouchers:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge badge-warning",
      APPROVED: "badge badge-success",
      POSTED: "badge badge-info",
      CANCELLED: "badge badge-error",
    };
    return badges[status] || "badge";
  };

  const filteredVouchers = vouchers.filter((voucher) => {
    const matchesSearch =
      String(voucher.voucher_no || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(voucher.narration || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || voucher.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="text-center py-8">Loading vouchers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Journal Vouchers
            </h1>
            <p className="text-sm mt-1">
              Manage general ledger journal entries
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance" className="btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/finance/journal-voucher/create" className="btn-success">
              Create New
            </Link>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mx-4 mt-4">
            <span>{error}</span>
          </div>
        )}

        <div className="card-body">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by voucher number or narration..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-48"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Narration</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td className="font-medium">{voucher.voucher_no}</td>
                    <td>
                      {voucher.voucher_date
                        ? new Date(voucher.voucher_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{voucher.narration}</td>
                    <td className="text-right">
                      {Number(voucher.total_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(voucher.total_credit || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={getStatusBadge(voucher.status)}>
                        {voucher.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/finance/journal-voucher/${voucher.id}?mode=view`}
                          className="text-brand hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-100"
                        >
                          View
                        </Link>
                        <Link
                          to={`/finance/journal-voucher/${voucher.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          Edit
                        </Link>
                        {voucher.status === "DRAFT" && (
                          <button className="text-red-600 hover:text-red-800 dark:text-red-400">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredVouchers.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No journal vouchers found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}







