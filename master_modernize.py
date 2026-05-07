import sys
import os
import re

def process_file(config):
    file_path = config["path"]
    if not os.path.exists(file_path):
        print(f"Skipping {file_path} - not found")
        return
        
    print(f"Processing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add imports if missing
    icons_needed = ["Eye", "Edit2", "Printer", "FileText", "Paperclip"]
    new_icons = [icon for icon in icons_needed if icon not in content]
    
    if new_icons:
        import_stmt = f'import {{ {", ".join(new_icons)} }} from "lucide-react";'
        if 'import { Link' in content:
            content = content.replace('import { Link', f'{import_stmt}\nimport {{ Link', 1)
        elif 'import React' in content:
            content = content.replace('import React', f'{import_stmt}\nimport React', 1)

    var = config["var"]
    base = config["base"]
    edit_cond = config["edit_cond"]
    wf = config["wf"]
    rev = config.get("rev", '<div className="w-full h-9" />')
    print_logic = config.get("print_logic", None)
    pdf_logic = config.get("pdf_logic", None)
    attach_logic = config.get("attach_logic", None)

    # 3. Construct the new <td> block
    new_td = f"""                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {{/* Slot 1: View */}}
                        <div className="w-[80px]">
                          <Link
                            to={{`{base}/${{{var}.id}}?mode=view` if 'mode=view' not in base else f'`{base}`.replace("${{{var}.id}}", str({var}.id))'}}
                            className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {{/* Slot 2: Edit */}}
                        <div className="w-[80px]">
                          {{{edit_cond} ? (
                            <Link
                              to={{`{base}/${{{var}.id}}?mode=edit` if 'mode=edit' not in base else f'`{base}`.replace("${{{var}.id}}", str({var}.id))'}}
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
                          {{{ 'true' if print_logic else 'false' } ? (
                            <button
                              type="button"
                              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              onClick={{() => {{{print_logic}}}}}
                              title="Print"
                            >
                              <Printer size={18} />
                            </button>
                          ) : (
                            <div className="w-9 h-9" />
                          )}}
                        </div>

                        {{/* Slot 4: PDF */}}
                        <div className="w-9">
                          {{{ 'true' if pdf_logic else 'false' } ? (
                            <button
                              type="button"
                              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              onClick={{async () => {{{pdf_logic}}}}}
                              title="Download PDF"
                            >
                              <FileText size={18} />
                            </button>
                          ) : (
                            <div className="w-9 h-9" />
                          )}}
                        </div>

                        {{/* Slot 5: Attachment */}}
                        <div className="w-9">
                          {{{ 'true' if attach_logic else 'false' } ? (
                            <button
                              type="button"
                              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              onClick={{() => {{{attach_logic}}}}}
                              title="Attachments"
                            >
                              <Paperclip size={18} />
                            </button>
                          ) : (
                            <div className="w-9 h-9" />
                          )}}
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
    
    # Fix interpolation
    new_td = new_td.replace('{{{var}.id}}', f'${{{var}.id}}')
    new_td = new_td.replace('{{{', '{').replace('}}}', '}')

    # 4. Replacement
    # Find the <td> that contains the View link with basePath
    # We use a very broad regex for the <td>
    td_pattern = re.compile(r'<td>\s*<div[^>]*?>.*?View.*?</div>\s*</td>', re.DOTALL)
    if not td_pattern.search(content):
        td_pattern = re.compile(r'<td[^>]*?>\s*<div[^>]*?>.*?View.*?</div>\s*</td>', re.DOTALL)
    
    if td_pattern.search(content):
        content = td_pattern.sub(new_td, content)
    else:
        print(f"  Warning: Action column <td> not found in {file_path}")

    # 5. Cleanup
    if attach_logic and config.get("remove_attach_col"):
        content = content.replace('<th className="px-6 py-4">Attachments</th>', '')
        content = content.replace('<th>Attachments</th>', '')
        content = re.sub(r'<td>\s*<button.*?onClick={() => \{.*?setActiveDocId\(.*?\);\s*setShowAttach\(true\);.*?\}\}.*?>\s*View\s*</button>\s*</td>', '', content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Updated {file_path} successfully")

# --- Configurations ---
configs = [
    {
        "path": "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/MaterialRequisitionList.jsx",
        "var": "req",
        "base": "/inventory/material-requisitions/${req.id}",
        "edit_cond": "!['APPROVED', 'ISSUED', 'CANCELLED'].includes(req.status)",
        "wf": """<div className="list-approval-slot">
                            {["APPROVED", "ISSUED"].includes(req.status) ? (
                              <span className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white cursor-default h-9">
                                Approved
                              </span>
                            ) : req.forwarded_to_username ? (
                              <button
                                type="button"
                                disabled
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white cursor-default h-9 whitespace-nowrap overflow-hidden text-ellipsis"
                              >
                                Forwarded to {req.forwarded_to_username}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openForwardModal(req)}
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                                disabled={
                                  submittingForward ||
                                  ["POSTED", "REJECTED", "PENDING_APPROVAL", "SUBMITTED", "CANCELLED"].includes(req.status)
                                }
                              >
                                {submittingForward
                                  ? "Forwarding..."
                                  : "Forward for Approval"}
                              </button>
                            )}
                          </div>""",
        "rev": """{req.status === "APPROVED" && (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center px-3 py-1.5 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-full bg-indigo-50 hover:bg-indigo-100 text-xs font-medium whitespace-nowrap h-9"
                              onClick={() => {/* logic */}}
                            >
                              Reverse Approval
                            </button>
                          )}""",
        "attach_logic": "setActiveDocId(req.id); setShowAttach(true);",
        "remove_attach_col": True
    },
    {
        "path": "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/purchase/purchase-orders-local/PurchaseOrdersLocalList.jsx",
        "var": "po",
        "base": "/purchase/purchase-orders-local/${po.id}",
        "edit_cond": "po.status !== 'APPROVED'",
        "wf": """<div className="list-approval-slot">
                            {po.status === "APPROVED" ? (
                              <span className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white cursor-default h-9">
                                Approved
                              </span>
                            ) : po.forwarded_to_username ? (
                              <button
                                type="button"
                                disabled
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white cursor-default h-9 whitespace-nowrap overflow-hidden text-ellipsis"
                              >
                                Forwarded to {po.forwarded_to_username}
                              </button>
                            ) : po.status === "DRAFT" || po.status === "REJECTED" ? (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                                onClick={() => openForwardModal(po)}
                                disabled={hasInactiveWorkflow}
                              >
                                Forward for Approval
                              </button>
                            ) : <div className="w-full h-9" />}
                          </div>""",
        "print_logic": "window.open(`/purchase/purchase-orders-local/${po.id}`, '_blank')",
        "pdf_logic": """try {
                               const res = await api.post(`/documents/purchase-order/${po.id}/render`, { format: 'html' });
                               const html = typeof res.data === 'string' ? res.data : String(res.data || '');
                               await renderHtmlToPdf(html, `PO-${po.po_no || po.id}.pdf`);
                             } catch (e) {
                               toast.error('Failed to download PDF');
                             }"""
    },
    {
        "path": "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/StockTransferList.jsx",
        "var": "transfer",
        "base": "/inventory/stock-transfers/${transfer.id}",
        "edit_cond": "transfer.status === 'DRAFT'",
        "wf": """<div className="list-approval-slot">
                            {transfer.status === "DRAFT" ? (
                              <button
                                onClick={() => setConfirmDialog({ open: true, id: transfer.id, loading: false })}
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                              >
                                Confirm Transfer
                              </button>
                            ) : transfer.status === "APPROVED" || transfer.status === "COMPLETED" ? (
                              <span className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white cursor-default h-9">
                                Approved
                              </span>
                            ) : <div className="w-full h-9" />}
                          </div>"""
    }
]

if __name__ == "__main__":
    for c in configs:
        process_file(c)
