/**
 * @fileoverview InteractiveFormCard component
 * Displays a structured card for actionable interactive forms returned by Banks AI.
 */
import React from "react";
import { FileText, CheckCircle2 } from "lucide-react";

export default function InteractiveFormCard({ form }) {
  if (!form) return null;

  const { title = "Action Request", description, fields = [], actions = [] } = form;

  return (
    <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shadow-sm space-y-2.5">
      <div className="flex items-center gap-2 text-brand-900 dark:text-brand-300 font-bold text-xs">
        <FileText size={15} />
        <span>{title}</span>
      </div>

      {description && (
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>
      )}

      {Array.isArray(fields) && fields.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {fields.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
            >
              <span className="text-slate-500 font-medium">{f.label || f.name}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {String(f.value ?? "")}
              </span>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(actions) && actions.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={act.onClick}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-900 hover:bg-brand-800 text-white shadow-sm flex items-center gap-1 transition-all"
            >
              <CheckCircle2 size={13} />
              <span>{act.label || "Confirm"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
