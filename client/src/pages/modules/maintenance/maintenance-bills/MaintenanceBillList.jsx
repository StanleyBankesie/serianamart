/**
 * @fileoverview MaintenanceBillList component.
 * Provides functionality for MaintenanceBillList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye, Edit } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";

const paymentColors = { UNPAID:"bg-amber-100 text-amber-700", PAID:"bg-green-100 text-green-700", OVERDUE:"bg-red-100 text-red-700" };
const statusColors = { DRAFT:"bg-slate-100 text-slate-600", PENDING:"bg-amber-100 text-amber-700", APPROVED:"bg-green-100 text-green-700" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceBillList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/bills").then(r => { if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.bill_no || "").toLowerCase().includes(q) || String(r.supplier_name || "").toLowerCase().includes(q) || String(r.status || "").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Maintenance Bills</div>
            <div className="flex gap-2">
              <button onClick={() => (window.location.href = "/maintenance")} className="btn btn-secondary">Return to Menu</button>
              <button onClick={() => (window.location.href = "/maintenance/bills/new")} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700">+ New Bill</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4"><input className="input max-w-md" placeholder="Search by bill no, supplier, status..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Bill No</th><th>Bill Date</th><th>Due Date</th><th>Supplier</th><th className="text-right">Total</th><th>Currency</th><th>Payment</th><th>Status</th><th>Actions</th>                    <th>Created By</th>
                    <th>Created Date</th>
                    </tr></thead>
              <tbody>
                {loading && <tr><td colSpan="11" className="text-center py-8 text-slate-500">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="11" className="text-center py-8 text-slate-500">No bills found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.bill_no}</td>
                    <td>{r.bill_date ? String(r.bill_date).split('T')[0] : ''}</td>
                    <td>{r.due_date ? String(r.due_date).split('T')[0] : ''}</td>
                    <td>{r.supplier_name}</td>
                    <td className="text-right">{Number(r.total_amount || 0).toFixed(2)}</td>
                    <td>{r.currency}</td>
                    <td><Badge value={r.payment_status} colorMap={paymentColors} /></td>
                    <td><Badge value={r.status} colorMap={statusColors} /></td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td><div className="flex items-center gap-1"><button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/bills/${r.id}?mode=view`)}><Eye size={15} /></button><button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Edit" onClick={() => navigate(`/maintenance/bills/${r.id}`)}><Edit size={15} /></button><ListPrintIconButton onClick={() => toast.info("Print coming soon")} /><ListPdfIconButton onClick={() => toast.info("PDF coming soon")} /><ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => { setShowAttach(false); setActiveDocId(null); }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
    </div>
  );
}
