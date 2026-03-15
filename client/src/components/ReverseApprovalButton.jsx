import React, { useState } from "react";
// Shared reverse-approval button used in some legacy modules (inventory, etc.)
// For purchase orders we now call module-specific reverse endpoints directly
// in their list pages, so this component is no longer used for POs.
import { api } from "../api/client.js";
import { usePermission } from "../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

export default function ReverseApprovalButton({
  docType,
  docId,
  className,
  onDone,
  children,
}) {
  const { canReverseApproval } = usePermission();
  const [busy, setBusy] = useState(false);
  if (!canReverseApproval()) return null;
  async function run() {
    if (!docType || !docId) return;
    setBusy(true);
    try {
      await api.post("/workflows/reverse-by-document", {
        document_type: docType,
        document_id: docId,
      });
      toast.success("Approval reversed and document returned");
      if (typeof onDone === "function") onDone();
    } catch (e) {
      const detail =
        e?.response?.data?.message || e?.message || "Reverse approval failed";
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={
        className ||
        "ml-2 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
      }
    >
      {children || (busy ? "Reversing..." : "Reverse Approval")}
    </button>
  );
}
