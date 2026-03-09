import React, { useEffect, useState, useRef } from "react";
import api from "../../../src/api/client";

export default function DocumentAttachmentsModal({
  open,
  onClose,
  docType,
  docId,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!open || !docType || !docId) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/documents/${docType}/${docId}/attachments`);
        const arr = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (mounted) setItems(arr);
      } catch (e) {
        if (mounted)
          setError(e?.response?.data?.message || "Failed to load attachments");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [open, docType, docId]);

  async function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post(`/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url =
        up?.data?.url || up?.data?.data?.url || up?.data?.path || null;
      if (!url) throw new Error("Upload failed");
      await api.post(`/documents/${docType}/${docId}/attachments`, {
        url,
        name: file.name,
      });
      const res = await api.get(`/documents/${docType}/${docId}/attachments`);
      const arr = Array.isArray(res?.data?.items) ? res.data.items : [];
      setItems(arr);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(id) {
    try {
      await api.delete(`/documents/${docType}/${docId}/attachments/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[720px] max-w-[95%]">
        <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Attachments</div>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={onUploadFile}
              disabled={uploading}
            />
            {uploading ? <span className="text-sm">Uploading...</span> : null}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {loading ? (
              <div className="text-sm">Loading attachments...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No attachments yet</div>
            ) : (
              items.map((a) => (
                <div
                  key={a.id}
                  className="border rounded p-2 flex flex-col items-center gap-2"
                >
                  {/\.(png|jpe?g|webp|gif)$/i.test(
                    String(a.file_name || a.file_url || ""),
                  ) ? (
                    <img
                      src={a.file_url}
                      alt={a.file_name || "attachment"}
                      className="w-28 h-28 object-contain"
                    />
                  ) : (
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-brand"
                    >
                      {a.file_name || "Download"}
                    </a>
                  )}
                  <div className="flex items-center gap-2">
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-error"
                      onClick={() => onRemove(a.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
