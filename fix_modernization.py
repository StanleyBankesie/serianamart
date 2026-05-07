import sys
import os
import re

files = [
    "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/MaterialRequisitionList.jsx",
    "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/purchase/purchase-orders-local/PurchaseOrdersLocalList.jsx",
    "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/StockTransferList.jsx",
    "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/GRNLocalList.jsx",
    "c:/Users/stanl/OneDrive/Documents/serianamart/client/src/pages/modules/inventory/GRNImportList.jsx",
]

def fix_file(file_path):
    if not os.path.exists(file_path): return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix broken logic from bad f-string interpolation
    # Pattern: to={`/path/${var.id}/${var.id}?mode=view` if 'mode=view' not in base else ...}
    
    # Identify variables and paths
    # Material Requisition
    if "MaterialRequisitionList" in file_path:
        content = re.sub(r"to=\{`\/inventory\/material-requisitions\/\$\{req\.id\}.*?`\}", r"to={`/inventory/material-requisitions/${req.id}?mode=view`}", content, count=1)
        content = re.sub(r"to=\{`\/inventory\/material-requisitions\/\$\{req\.id\}.*?`\}", r"to={`/inventory/material-requisitions/${req.id}?mode=edit`}", content, count=1)
    
    # PO Local
    if "PurchaseOrdersLocalList" in file_path:
        content = re.sub(r"to=\{`\/purchase\/purchase-orders-local\/\$\{po\.id\}.*?`\}", r"to={`/purchase/purchase-orders-local/${po.id}?mode=view`}", content, count=1)
        content = re.sub(r"to=\{`\/purchase\/purchase-orders-local\/\$\{po\.id\}.*?`\}", r"to={`/purchase/purchase-orders-local/${po.id}/edit`}", content, count=1)

    # Stock Transfer
    if "StockTransferList" in file_path:
        content = re.sub(r"to=\{`\/inventory\/stock-transfers\/\$\{transfer\.id\}.*?`\}", r"to={`/inventory/stock-transfers/${transfer.id}?mode=view`}", content, count=1)
        content = re.sub(r"to=\{`\/inventory\/stock-transfers\/\$\{transfer\.id\}.*?`\}", r"to={`/inventory/stock-transfers/${transfer.id}?mode=edit`}", content, count=1)

    # GRN Local
    if "GRNLocalList" in file_path:
        content = re.sub(r"to=\{`\/inventory\/grn-local\/\$\{g\.id\}.*?`\}", r"to={`/inventory/grn-local/${g.id}?mode=view`}", content, count=1)
        content = re.sub(r"to=\{`\/inventory\/grn-local\/\$\{g\.id\}.*?`\}", r"to={`/inventory/grn-local/${g.id}?mode=edit`}", content, count=1)

    # GRN Import
    if "GRNImportList" in file_path:
        content = re.sub(r"to=\{`\/inventory\/grn-import\/\$\{g\.id\}.*?`\}", r"to={`/inventory/grn-import/${g.id}?mode=view`}", content, count=1)
        content = re.sub(r"to=\{`\/inventory\/grn-import\/\$\{g\.id\}.*?`\}", r"to={`/inventory/grn-import/${g.id}?mode=edit`}", content, count=1)

    # Fix icons and generic logic
    content = content.replace('size=18', 'size={18}')
    content = content.replace('{None}', 'null')
    content = content.replace('{False}', 'false')
    content = content.replace('{True}', 'true')
    
    # Fix the Paperclip/Eye/etc imports if they were doubled or broken
    content = content.replace('import { Eye, Edit2, Printer, FileText, Paperclip } from "lucide-react";\nimport { Eye, Edit2, Printer, FileText, Paperclip } from "lucide-react";', 'import { Eye, Edit2, Printer, FileText, Paperclip } from "lucide-react";')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {file_path}")

if __name__ == "__main__":
    for f in files:
        fix_file(f)
