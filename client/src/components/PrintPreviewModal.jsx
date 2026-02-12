import React, { useEffect, useRef } from "react";

export default function PrintPreviewModal({
  open,
  onClose,
  html,
  downloading = false,
  onDownload,
}) {
  const iframeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    try {
      const f = iframeRef.current;
      if (f && f.contentWindow) f.contentWindow.focus();
    } catch {}
  }, [open, html]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow max-w-5xl w-full">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Print Preview</h2>
          <button className="btn-outline" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="p-0">
          <iframe
            ref={iframeRef}
            title="preview"
            srcDoc={String(html || "")}
            className="w-full h-[70vh]"
          />
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button
            className="btn-outline"
            onClick={() => {
              try {
                const f = iframeRef.current;
                if (f && f.contentWindow) f.contentWindow.print();
              } catch {}
            }}
          >
            Print
          </button>
          <button
            className="btn-success"
            disabled={downloading}
            onClick={onDownload}
          >
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
