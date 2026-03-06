import React, { useState } from "react";
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
    try {
      setBusy(true);
      await api.post("/workflows/reverse-by-document", {
        document_type: docType,
        document_id: docId,
      });
      toast.success("Approval reversed and document returned");
      if (typeof onDone === "function") onDone();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Reverse approval failed");
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
