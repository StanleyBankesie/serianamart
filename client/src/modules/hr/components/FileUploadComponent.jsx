import React from "react";

export default function FileUploadComponent({ onUpload }) {
  const [file, setFile] = React.useState(null);
  return (
    <div className="flex items-center gap-2">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button type="button" className="btn-secondary" onClick={() => onUpload?.(file)} disabled={!file}>
        Upload
      </button>
    </div>
  );
}
