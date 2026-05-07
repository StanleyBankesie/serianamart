import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client.js";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { Link } from "react-router-dom";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";

export default function DirectPurchaseList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPath, canReverseApproval } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/purchase/direct-purchases");
        const arr = Array.isArray(res?.data?.items)
          ? res.data.items
          : Array.isArray(res?.data)
            ? res.data
            : [];
        if (mounted) setItems(arr);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);


  function fmtCurrency(n) {
    const v = Number(n || 0);
    return `GHS ${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/purchase"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Purchase
          </Link>
          <h1 className="text-2xl font-bold mt-2">Direct Purchases</h1>
          <p className="text-sm text-slate-600">
            Single-step purchases created from the Direct Purchase form
          </p>
        </div>
        <div className="flex gap-2">
          {canAccessPath("/purchase/direct-purchase/new") && (
            <button
              className="btn btn-primary"
              onClick={() => navigate("/purchase/direct-purchase/new")}
            >
              Create Direct Purchase
            </button>
          )}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Date</th>
                    <th style={{ width: '250px' }}>Supplier</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                    <th>Created By</th>
                    <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td>{it.dp_no || it.document_no || it.id}</td>
                      <td>
                        {String(it.purchase_date || it.date || "").slice(0, 10)}
                      </td>
                      <td style={{ width: '250px' }}>
                        {it.supplier_name || it.supplier || it.supplier_id}
                      </td>
                      <td className="text-right">
                        {fmtCurrency(
                          it.grand_total ?? it.total_amount ?? it.amount ?? 0,
                        )}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            ["POST", "POSTED"].includes(String(it.status).toUpperCase())
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {it.status || "DRAFT"}
                        </span>
                      </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            onClick={() => navigate(`/purchase/direct-purchase/${it.id}?mode=view`)}
                          >
                            View
                          </button>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {!["POST", "POSTED"].includes(String(it.status).toUpperCase()) ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              onClick={() => navigate(`/purchase/direct-purchase/${it.id}?mode=edit`)}
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton
                            onClick={() =>
                              window.open(
                                `/purchase/direct-purchase/${it.id}?mode=view`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={async () => {
                              try {
                                const res = await api.post(`/documents/direct-purchase/${it.id}/render`, { format: "html" });
                                const html = typeof res.data === "string" ? res.data : String(res.data || "");
                                await renderHtmlToPdf(html, `DirectPurchase-${it.dp_no || it.id}.pdf`);
                              } catch (e) {
                                toast.error("Failed to download PDF");
                              }
                            }}
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(it.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow / Status */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {["POST", "POSTED"].includes(String(it.status).toUpperCase()) ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Posted
                                </span>
                                {canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={async () => {
                                      if (!window.confirm("Cancel this purchase?")) return;
                                      try {
                                        await api.post(`/purchase/direct-purchase/${it.id}/cancel`);
                                        toast.success("Purchase cancelled");
                                        setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: 'CANCELLED' } : x));
                                      } catch (e) {
                                        toast.error("Failed to cancel");
                                      }
                                    }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{it.created_by_username || it.created_by_name || "-"}</td>
                    <td>{it.created_at ? new Date(it.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500">
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="direct-purchase"
        docId={activeDocId}
        allowPreview={true}
      />
    </div>
  );
}
