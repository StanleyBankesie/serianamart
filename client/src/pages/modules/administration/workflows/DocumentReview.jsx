import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../../../../api/client";
import { toast } from "react-toastify";

export default function DocumentReview() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [docHeader, setDocHeader] = useState(null);
  const [docDetails, setDocDetails] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [nextUser, setNextUser] = useState(null);

  useEffect(() => {
    client
      .get(`/workflows/approvals/instance/${instanceId}`)
      .then((res) => setData(res.data.item))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load workflow details");
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  useEffect(() => {
    if (!data) return;
    if (!data.is_last_step && Array.isArray(data.next_step_approvers)) {
      const first = data.next_step_approvers[0];
      setNextUser(first ? first.id : null);
    } else {
      setNextUser(null);
    }
    const t = String(data.document_type || "").toUpperCase();
    if (t === "MATERIAL_REQUISITION") {
      setDocLoading(true);
      client
        .get(`/inventory/material-requisitions/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.item || null);
          setDocDetails(
            Array.isArray(res.data?.details) ? res.data.details : []
          );
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (t === "STOCK_ADJUSTMENT") {
      setDocLoading(true);
      client
        .get(`/inventory/stock-adjustments/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.item || null);
          setDocDetails(
            Array.isArray(res.data?.details) ? res.data.details : []
          );
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (t === "PURCHASE_ORDER" || t === "PURCHASE ORDER") {
      setDocLoading(true);
      client
        .get(`/purchase/orders/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.item || null);
          setDocDetails(
            Array.isArray(res.data?.item?.details) ? res.data.item.details : []
          );
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (
      t === "GOODS_RECEIPT" ||
      t === "GRN" ||
      t === "GOODS RECEIPT NOTE"
    ) {
      setDocLoading(true);
      client
        .get(`/inventory/grn/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.item || null);
          setDocDetails(
            Array.isArray(res.data?.item?.details) ? res.data.item.details : []
          );
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (
      t === "PAYMENT_VOUCHER" ||
      t === "PAYMENT VOUCHER" ||
      t === "PV"
    ) {
      setDocLoading(true);
      client
        .get(`/finance/vouchers/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.voucher || null);
          setDocDetails(Array.isArray(res.data?.lines) ? res.data.lines : []);
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (
      t === "RECEIPT_VOUCHER" ||
      t === "RECEIPT VOUCHER" ||
      t === "RV"
    ) {
      setDocLoading(true);
      client
        .get(`/finance/vouchers/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.voucher || null);
          setDocDetails(Array.isArray(res.data?.lines) ? res.data.lines : []);
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else if (t === "SALES_ORDER" || t === "SALES ORDER") {
      setDocLoading(true);
      client
        .get(`/sales/orders/${data.document_id}`)
        .then((res) => {
          setDocHeader(res.data?.item || null);
          setDocDetails(Array.isArray(res.data?.details) ? res.data.details : []);
        })
        .catch(() => {
          setDocHeader(null);
          setDocDetails([]);
        })
        .finally(() => setDocLoading(false));
    } else {
      setDocHeader(null);
      setDocDetails([]);
      setDocLoading(false);
    }
  }, [data]);

  const handleAction = async (action) => {
    if (!comment && (action === "REJECT" || action === "RETURN")) {
      toast.warning("Please provide a comment for rejection/return");
      return;
    }
    if (action === "APPROVE" && !data.is_last_step) {
      if (!nextUser) {
        toast.warning("Please select the next approver");
        return;
      }
    }

    setProcessing(true);
    try {
      await client.post(`/workflows/${instanceId}/action`, {
        action,
        comments: comment,
        target_user_id: !data.is_last_step ? nextUser : null,
      });
      toast.success(`Document ${action.toLowerCase()}ed successfully`);
      navigate("/administration/workflows/approvals");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-6">Loading details...</div>;
  if (!data) return <div className="p-6">Workflow not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Review:{" "}
          {String(data.document_type || "")
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
          #{data.document_id}
        </h1>
        <button onClick={() => navigate(-1)} className="btn btn-outline">
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content - Document Preview (Mock) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-erp border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
              Document Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-slate-500 block">Document Type</label>
                <div className="font-medium">{data.document_type}</div>
              </div>
              <div>
                <label className="text-slate-500 block">ID</label>
                <div className="font-medium">#{data.document_id}</div>
              </div>
              <div>
                <label className="text-slate-500 block">Amount</label>
                <div className="font-medium">
                  {data.amount != null
                    ? Number(data.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "N/A"}
                </div>
              </div>
              <div>
                <label className="text-slate-500 block">Submitted At</label>
                <div className="font-medium">
                  {new Date(data.created_at).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-slate-500 block">Current Status</label>
                <span
                  className={`badge ${
                    data.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {data.status}
                </span>
              </div>
            </div>

            {String(data.document_type || "").toUpperCase() ===
            "MATERIAL_REQUISITION" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Requisition No</div>
                    <div className="font-medium">
                      {docHeader?.requisition_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Requisition Date</div>
                    <div className="font-medium">
                      {docHeader?.requisition_date || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Warehouse</div>
                    <div className="font-medium">
                      {docHeader?.warehouse_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Department</div>
                    <div className="font-medium">
                      {docHeader?.department_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Requested By</div>
                    <div className="font-medium">
                      {docHeader?.requested_by || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">
                      {docHeader?.status || "-"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Items ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Qty Requested</th>
                            <th>UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>{d.item_code || d.item_id}</td>
                              <td>{d.item_name || "-"}</td>
                              <td>{Number(d.qty_requested || 0)}</td>
                              <td>{d.uom || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No items found</div>
                  )}
                </div>
                {docHeader?.remarks && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                    <div className="text-slate-500">Remarks</div>
                    <div className="text-slate-700 dark:text-slate-300">
                      {docHeader.remarks}
                    </div>
                  </div>
                )}
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "STOCK_ADJUSTMENT" ||
              String(data.document_type || "").toUpperCase() ===
                "STOCK ADJUSTMENT" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Adjustment No</div>
                    <div className="font-medium">
                      {docHeader?.adjustment_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Date</div>
                    <div className="font-medium">
                      {docHeader?.adjustment_date
                        ? new Date(
                            docHeader.adjustment_date
                          ).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Type</div>
                    <div className="font-medium">
                      {docHeader?.adjustment_type || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">
                      {docHeader?.status || "-"}
                    </div>
                  </div>
                  {docHeader?.warehouse_name && (
                    <div>
                      <div className="text-slate-500">Warehouse</div>
                      <div className="font-medium">
                        {docHeader.warehouse_name}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Items ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Current Stock</th>
                            <th>Adjusted Stock</th>
                            <th>Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>{d.item_code || d.item_id}</td>
                              <td>{d.item_name || "-"}</td>
                              <td>{Number(d.current_stock || 0)}</td>
                              <td>{Number(d.adjusted_stock || 0)}</td>
                              <td
                                className={
                                  Number(d.qty) < 0
                                    ? "text-red-500"
                                    : "text-green-500"
                                }
                              >
                                {Number(d.qty) > 0 ? "+" : ""}
                                {Number(d.qty)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No items found</div>
                  )}
                </div>
                {docHeader?.reason && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                    <div className="text-slate-500">Reason</div>
                    <div className="text-slate-700 dark:text-slate-300">
                      {docHeader.reason}
                    </div>
                  </div>
                )}
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "PURCHASE_ORDER" ||
              String(data.document_type || "").toUpperCase() ===
                "PURCHASE ORDER" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">PO No</div>
                    <div className="font-medium">{docHeader?.po_no || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">PO Date</div>
                    <div className="font-medium">
                      {docHeader?.po_date
                        ? new Date(docHeader.po_date).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Order Type</div>
                    <div className="font-medium">
                      {docHeader?.po_type || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Supplier</div>
                    <div className="font-medium">
                      {docHeader?.supplier_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">
                      {docHeader?.status || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Amount</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_amount || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Items ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>{d.item_code || d.item_id}</td>
                              <td>{d.item_name || "-"}</td>
                              <td>{Number(d.qty || 0)}</td>
                              <td>
                                {Number(d.unit_price || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                              <td>
                                {Number(d.line_total || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No items found</div>
                  )}
                </div>
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "GOODS_RECEIPT" ||
              String(data.document_type || "").toUpperCase() === "GRN" ||
              String(data.document_type || "").toUpperCase() ===
                "GOODS RECEIPT NOTE" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">GRN No</div>
                    <div className="font-medium">
                      {docHeader?.grn_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">GRN Date</div>
                    <div className="font-medium">
                      {docHeader?.grn_date
                        ? String(docHeader.grn_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Supplier</div>
                    <div className="font-medium">
                      {docHeader?.supplier_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Warehouse</div>
                    <div className="font-medium">
                      {docHeader?.warehouse_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">
                      {docHeader?.status || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Invoice No</div>
                    <div className="font-medium">
                      {docHeader?.invoice_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Invoice Date</div>
                    <div className="font-medium">
                      {docHeader?.invoice_date
                        ? String(docHeader.invoice_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Invoice Amount</div>
                    <div className="font-medium">
                      {Number(docHeader?.invoice_amount || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Items ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Qty Received</th>
                            <th>Qty Accepted</th>
                            <th>UOM</th>
                            <th>Unit Price</th>
                            <th>Line Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>{d.item_code || d.item_id}</td>
                              <td>{d.item_name || "-"}</td>
                              <td>{Number(d.qty_received || 0)}</td>
                              <td>{Number(d.qty_accepted || 0)}</td>
                              <td>{d.uom || "-"}</td>
                              <td>
                                {Number(d.unit_price || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                              <td>
                                {Number(d.line_amount || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No items found</div>
                  )}
                </div>
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "PAYMENT_VOUCHER" ||
              String(data.document_type || "").toUpperCase() ===
                "PAYMENT VOUCHER" ||
              String(data.document_type || "").toUpperCase() === "PV" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Voucher No</div>
                    <div className="font-medium">
                      {docHeader?.voucher_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Voucher Date</div>
                    <div className="font-medium">
                      {docHeader?.voucher_date
                        ? String(docHeader.voucher_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Voucher Type</div>
                    <div className="font-medium">
                      {docHeader?.voucher_type_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">{docHeader?.status || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Debit</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_debit || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Credit</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_credit || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Lines ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Description</th>
                            <th className="text-right">Debit</th>
                            <th className="text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>
                                {d.account_code} - {d.account_name}
                              </td>
                              <td>{d.description || "-"}</td>
                              <td className="text-right">
                                {Number(d.debit || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="text-right">
                                {Number(d.credit || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No lines found</div>
                  )}
                </div>
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "RECEIPT_VOUCHER" ||
              String(data.document_type || "").toUpperCase() ===
                "RECEIPT VOUCHER" ||
              String(data.document_type || "").toUpperCase() === "RV" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Voucher No</div>
                    <div className="font-medium">
                      {docHeader?.voucher_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Voucher Date</div>
                    <div className="font-medium">
                      {docHeader?.voucher_date
                        ? String(docHeader.voucher_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Voucher Type</div>
                    <div className="font-medium">
                      {docHeader?.voucher_type_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">{docHeader?.status || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Debit</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_debit || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Credit</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_credit || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Lines ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Description</th>
                            <th className="text-right">Debit</th>
                            <th className="text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>
                                {d.account_code} - {d.account_name}
                              </td>
                              <td>{d.description || "-"}</td>
                              <td className="text-right">
                                {Number(d.debit || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="text-right">
                                {Number(d.credit || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No lines found</div>
                  )}
                </div>
              </div>
            ) : String(data.document_type || "").toUpperCase() ===
                "SALES_ORDER" ||
              String(data.document_type || "").toUpperCase() ===
                "SALES ORDER" ? (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Order No</div>
                    <div className="font-medium">
                      {docHeader?.order_no || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Order Date</div>
                    <div className="font-medium">
                      {docHeader?.order_date
                        ? new Date(docHeader.order_date).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Customer ID</div>
                    <div className="font-medium">
                      {docHeader?.customer_id || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Price Type</div>
                    <div className="font-medium">
                      {docHeader?.price_type || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Payment Type</div>
                    <div className="font-medium">
                      {docHeader?.payment_type || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">
                      {docHeader?.status || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Amount</div>
                    <div className="font-medium">
                      {Number(docHeader?.total_amount || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Items ({docDetails.length})
                  </div>
                  {docLoading ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : docDetails.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Item ID</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Tax Amount</th>
                            <th>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docDetails.map((d) => (
                            <tr key={d.id}>
                              <td>{d.item_id}</td>
                              <td>{Number(d.quantity || 0)}</td>
                              <td>
                                {Number(d.unit_price || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                              <td>
                                {Number(d.tax_amount || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                              <td>
                                {Number(d.total_amount || 0).toLocaleString(
                                  "en-US",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No items found</div>
                  )}
                </div>
                {docHeader?.remarks && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded text-sm">
                    <div className="text-slate-500">Remarks</div>
                    <div className="text-slate-700 dark:text-slate-300">
                      {docHeader.remarks}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800 text-center text-slate-500">
                <p>Document Preview Not Available</p>
                <p className="text-xs mt-1">
                  {`(${data.document_type} preview not implemented)`}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-erp border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
              Approval History
            </h2>
            <div className="space-y-4">
              {data.logs && data.logs.length > 0 ? (
                data.logs.map((log, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"></div>
                    <div>
                      <div className="text-sm font-medium">
                        {log.actor_name || "Unknown"}{" "}
                        <span className="text-slate-500">performed</span>{" "}
                        {log.action}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      {log.comments && (
                        <div className="mt-1 text-sm bg-slate-50 dark:bg-slate-900/50 p-2 rounded text-slate-600 dark:text-slate-400">
                          "{log.comments}"
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">No history yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-erp border border-slate-200 dark:border-slate-700 p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Current Step
              </label>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-800">
                {data.step_name}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Comments</label>
              <textarea
                className="input w-full h-24"
                placeholder="Enter comments..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
            </div>

            <div className="space-y-2">
              {!data.is_last_step &&
                Array.isArray(data.next_step_approvers) && (
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">
                      Forward To
                    </label>
                    <select
                      className="input w-full"
                      value={nextUser || ""}
                      onChange={(e) => setNextUser(Number(e.target.value))}
                    >
                      <option value="">Select user</option>
                      {data.next_step_approvers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <button
                onClick={() => handleAction("APPROVE")}
                disabled={
                  processing ||
                  (data.is_last_step &&
                    data.approval_limit !== null &&
                    data.amount > data.approval_limit)
                }
                className="btn btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {data.is_last_step ? "Final Approve" : "Forward to Next Stage"}
              </button>
              {data.is_last_step &&
                data.approval_limit !== null &&
                data.amount > data.approval_limit && (
                  <p className="text-red-500 text-xs text-center">
                    Amount exceeds your approval limit of{" "}
                    {Number(data.approval_limit || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              <button
                onClick={() => handleAction("RETURN")}
                disabled={processing}
                className="btn btn-warning w-full justify-center"
              >
                Return for Revision
              </button>
              <button
                onClick={() => handleAction("REJECT")}
                disabled={processing}
                className="btn btn-danger w-full justify-center"
              >
                Reject
              </button>
              {(function () {
                const t = String(data.document_type || "").toUpperCase();
                return (
                  (t === "PV" ||
                    t === "PAYMENT_VOUCHER" ||
                    t === "PAYMENT VOUCHER" ||
                    t === "RV" ||
                    t === "RECEIPT_VOUCHER" ||
                    t === "RECEIPT VOUCHER") &&
                  docHeader?.status === "APPROVED"
                );
              })() && (
                  <button
                    onClick={async () => {
                      const reason =
                        window.prompt("Reason for reversal (optional):") || "";
                      try {
                        await client.post(
                          `/finance/vouchers/${data.document_id}/reverse`,
                          { reason }
                        );
                        toast.success("Voucher reversed");
                        const refreshed = await client.get(
                          `/finance/vouchers/${data.document_id}`
                        );
                        setDocHeader(refreshed.data?.voucher || null);
                        setDocDetails(
                          Array.isArray(refreshed.data?.lines)
                            ? refreshed.data.lines
                            : []
                        );
                      } catch (e) {
                        toast.error(
                          e?.response?.data?.message ||
                            "Failed to reverse voucher"
                        );
                      }
                    }}
                    disabled={processing}
                    className="btn btn-outline w-full justify-center"
                  >
                    Reverse Voucher
                  </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
