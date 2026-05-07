import sys
import os
import re

files_config = [
    {
        "path": "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/GRNLocalList.jsx",
        "var": "g",
        "base": "/inventory/grn-local",
        "edit_cond": "!['APPROVED', 'POSTED'].includes(String(g.status || '').toUpperCase())",
        "wf": """<div className="list-approval-slot">
                            {String(g.status || "").toUpperCase() === "APPROVED" ? (
                              <span className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white cursor-default h-9">
                                Approved
                              </span>
                            ) : g.forwarded_to_username ? (
                              <button
                                type="button"
                                disabled
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white cursor-default h-9 whitespace-nowrap overflow-hidden text-ellipsis"
                              >
                                Forwarded to {g.forwarded_to_username}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                                onClick={() => openForwardModal(g)}
                                disabled={
                                  submittingId === g.id ||
                                  !canForward(g.status) ||
                                  hasInactiveWorkflow
                                }
                              >
                                {submittingId === g.id
                                  ? "Forwarding..."
                                  : "Forward for Approval"}
                              </button>
                            )}
                          </div>""",
        "rev": """{String(g.status || "").toUpperCase() === "APPROVED" && typeof canReverseApproval !== "undefined" && canReverseApproval() && (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center px-3 py-1.5 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-full bg-indigo-50 hover:bg-indigo-100 text-xs font-medium whitespace-nowrap h-9"
                              onClick={async () => {/* logic */}}
                            >
                              Reverse Approval
                            </button>
                          )}"""
    },
    {
        "path": "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/GRNImportList.jsx",
        "var": "g",
        "base": "/inventory/grn-import",
        "edit_cond": "!['APPROVED', 'POSTED'].includes(String(g.status || '').toUpperCase())",
        "wf": """<div className="list-approval-slot">
                            {String(g.status || "").toUpperCase() === "APPROVED" ? (
                              <span className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white cursor-default h-9">
                                Approved
                              </span>
                            ) : g.forwarded_to_username ? (
                              <button
                                type="button"
                                disabled
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white cursor-default h-9 whitespace-nowrap overflow-hidden text-ellipsis"
                              >
                                Forwarded to {g.forwarded_to_username}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                                onClick={() => openForwardModal(g)}
                                disabled={
                                  submittingId === g.id ||
                                  !canForward(g.status) ||
                                  hasInactiveWorkflow
                                }
                              >
                                {submittingId === g.id
                                  ? "Forwarding..."
                                  : "Forward for Approval"}
                              </button>
                            )}
                          </div>""",
        "rev": """{String(g.status || "").toUpperCase() === "APPROVED" && typeof canReverseApproval !== "undefined" && canReverseApproval() && (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center px-3 py-1.5 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-full bg-indigo-50 hover:bg-indigo-100 text-xs font-medium whitespace-nowrap h-9"
                              onClick={async () => {/* logic */}}
                            >
                              Reverse Approval
                            </button>
                          )}"""
    }
]

def process_file(config):
    file_path = config["path"]
    if not os.path.exists(file_path): return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    var = config["var"]
    base = config["base"]
    edit_cond = config["edit_cond"]
    wf = config["wf"]
    rev = config.get("rev", '<div className="w-full h-9" />')

    # Add imports
    if 'Eye' not in content:
        content = re.sub(r'import { Link', 'import { Eye, Edit2, Printer, FileText, Paperclip } from "lucide-react";\nimport { Link', content)

    new_td = f"""                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {{/* Slot 1: View */}}
                        <div className="w-[80px]">
                          <Link
                            to={{`{base}/${{{var}.id}}?mode=view` or f'`{base}/{{{var}.id}}?mode=view`'}}
                            className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {{/* Slot 2: Edit */}}
                        <div className="w-[80px]">
                          {{{edit_cond} ? (
                            <Link
                              to={{`{base}/${{{var}.id}}?mode=edit` or f'`{base}/{{{var}.id}}?mode=edit`'}}
                              className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}}
                        </div>

                        {{/* Slot 3: Print */}}
                        <div className="w-9">
                           <div className="w-9 h-9" />
                        </div>

                        {{/* Slot 4: PDF */}}
                        <div className="w-9">
                           <div className="w-9 h-9" />
                        </div>

                        {{/* Slot 5: Attachment */}}
                        <div className="w-9">
                           <div className="w-9 h-9" />
                        </div>

                        {{/* Slot 6: Workflow */}}
                        <div className="min-w-[160px]">
                          {wf}
                        </div>

                        {{/* Slot 7: Reverse */}}
                        <div className="min-w-[100px]">
                          {rev}
                        </div>
                      </div>
                    </td>"""
    
    # Simple fix for the interpolation in python f-string
    new_td = new_td.replace('{{{var}.id}}', f'${{{var}.id}}')

    # Replace the Action column
    content = re.sub(r'<td className="px-6 py-4 text-right">.*?</td>', new_td, content, flags=re.DOTALL)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")

if __name__ == "__main__":
    for c in files_config:
        process_file(c)
