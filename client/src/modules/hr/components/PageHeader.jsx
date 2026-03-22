import React from "react";

export default function PageHeader({ title, children, onBack, backLabel = "Back to Menu" }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button type="button" className="btn-outline" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
