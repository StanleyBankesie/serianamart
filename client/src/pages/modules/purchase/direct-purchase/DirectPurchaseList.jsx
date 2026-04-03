import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client.js";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { Link } from "react-router-dom";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

export default function DirectPurchaseList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPath } = usePermission();
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

  useEffect(() => {
    // Capture success message passed via navigation state and then clear it
    const msg = location?.state?.success;
    if (msg) {
      setSuccess(String(msg));
      // Clear state to avoid showing again on refresh/navigation
      window.history.replaceState({}, document.title, location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

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
      {success && <div className="alert alert-success">{success}</div>}
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
                    <th>Supplier</th>
                    <th className="text-right">Amount</th>
                    <th>Attachments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td>{it.dp_no || it.document_no || it.id}</td>
                      <td>
                        {String(it.purchase_date || it.date || "").slice(0, 10)}
                      </td>
                      <td>
                        {it.supplier_name || it.supplier || it.supplier_id}
                      </td>
                      <td className="text-right">
                        {fmtCurrency(
                          it.grand_total ?? it.total_amount ?? it.amount ?? 0,
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline text-xs"
                          onClick={() => {
                            setActiveDocId(it.id);
                            setShowAttach(true);
                          }}
                        >
                          Attachments
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-outline text-xs"
                            onClick={() =>
                              navigate(
                                `/purchase/direct-purchase/${it.id}?mode=view`,
                              )
                            }
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="text-slate-700 hover:text-slate-900 text-xs font-medium"
                            title="Print"
                            onClick={() =>
                              window.open(
                                `/purchase/direct-purchase/${it.id}?mode=view`,
                                "_blank",
                              )
                            }
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="text-slate-700 hover:text-slate-900 text-xs font-medium"
                            title="PDF"
                            onClick={async () => {
                              try {
                                const res = await api.post(
                                  `/documents/direct-purchase/${it.id}/render`,
                                  { format: "html" },
                                  { headers: { "Content-Type": "application/json" } },
                                );
                                const html = typeof res.data === "string" ? res.data : String(res.data || "");
                                await renderHtmlToPdf(html, `DirectPurchase-${it.dp_no || it.id}.pdf`);
                              } catch (e) {
                                toast.error("Failed to download PDF");
                              }
                            }}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs"
                            onClick={() =>
                              navigate(
                                `/purchase/direct-purchase/${it.id}/edit`,
                              )
                            }
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500">
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
