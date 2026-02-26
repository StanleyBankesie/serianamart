import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function PurchaseBillsList() {
  const location = useLocation();
  const billType = location.pathname.includes("purchase-bills-import")
    ? "IMPORT"
    : "LOCAL";
  const { canPerformAction } = usePermission();

  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/purchase/bills", { params: { bill_type: billType } })
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load purchase bills");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [billType]);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      POSTED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };
  const getPaymentBadge = (status) => {
    const badges = {
      UNPAID: "badge-error",
      PARTIALLY_PAID: "badge-warning",
      PAID: "badge-success",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((r) => {
      const no = String(r.bill_no || "").toLowerCase();
      const sup = String(r.supplier_name || "").toLowerCase();
      const po = String(r.po_no || "").toLowerCase();
      return no.includes(q) || sup.includes(q) || po.includes(q);
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Bills - {billType}
          </h1>
          <p className="text-sm mt-1">Record and manage supplier bills</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase" className="btn btn-secondary">
            Return to Menu
          </Link>
          {canPerformAction(
            billType === "IMPORT"
              ? "purchase:purchase-bills-import"
              : "purchase:purchase-bills-local",
            "create",
          ) && (
            <Link
              to={`/purchase/purchase-bills-${billType.toLowerCase()}/new`}
              className="btn-success"
            >
              + New Bill
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by bill no / supplier / PO..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>PO</th>
                <th>GRN</th>
                <th className="text-right">Total</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Net</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="10"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="10"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No records
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>
                      {r.bill_date
                        ? new Date(r.bill_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{r.supplier_name}</td>
                    <td>{r.po_no || "-"}</td>
                    <td>
                      {r.grn_no ? (
                        r.grn_no
                      ) : r.grn_id ? (
                        <Link
                          to={`/inventory/grn-local/${r.grn_id}?mode=view`}
                          className="text-brand hover:text-brand-600 text-sm font-medium"
                        >
                          {r.grn_no || String(r.grn_id)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-right font-medium">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.tax_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right font-medium">
                      {Number(r.net_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`badge ${getPaymentBadge(
                          String(r.payment_status || ""),
                        )}`}
                      >
                        {String(r.payment_status || "") || "-"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {canPerformAction(
                        billType === "IMPORT"
                          ? "purchase:purchase-bills-import"
                          : "purchase:purchase-bills-local",
                        "view",
                      ) && (
                        <Link
                          to={`/purchase/purchase-bills-${billType.toLowerCase()}/${r.id}?mode=view`}
                          className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        className="ml-2 text-slate-700 hover:text-slate-900 text-sm"
                        title="Print"
                        onClick={() =>
                          window.open(
                            `/purchase/purchase-bills-${billType.toLowerCase()}/${r.id}?mode=view`,
                            "_blank",
                          )
                        }
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        className="ml-2 text-slate-700 hover:text-slate-900 text-sm"
                        title="PDF"
                        onClick={() =>
                          window.open(
                            `/purchase/purchase-bills-${billType.toLowerCase()}/${r.id}?mode=view`,
                            "_blank",
                          )
                        }
                      >
                        PDF
                      </button>
                      {canPerformAction(
                        billType === "IMPORT"
                          ? "purchase:purchase-bills-import"
                          : "purchase:purchase-bills-local",
                        "edit",
                      ) && (
                        <Link
                          to={`/purchase/purchase-bills-${billType.toLowerCase()}/${r.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium ml-2"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
