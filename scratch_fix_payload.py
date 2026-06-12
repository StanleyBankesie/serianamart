import re

with open("client/src/pages/modules/pos/entry/PosSalesEntry.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# We need to find the payload building block and restore it.
start_marker = "      payload = {\n        payment_method: method,\n        payment_mode_id: Number(effectivePaymentModeId),\n        payments: paymentsData,\n        customer_id: chosenCustomer ? Number(chosenCustomer.id) : null,\n        customer_name: chosenCustomer"
end_marker = "            const rate = Number(comp.rate_percent || 0);"

replacement = """      payload = {
        payment_method: method,
        payment_mode_id: Number(effectivePaymentModeId),
        payments: paymentsData,
        customer_id: chosenCustomer ? Number(chosenCustomer.id) : null,
        customer_name: chosenCustomer
          ? String(chosenCustomer.customer_name || chosenCustomer.name || "")
          : null,
        payment_status: chosenCustomer ? paymentStatus : null,
        lines,
        items: lines,
        status: "COMPLETED",
        terminal: terminalCode || "",
        subtotal,
        tax_total: tax,
        grand_total: total,
        amount_paid: (isMomo || effectiveAdditionalIds.length > 0) ? total : tendered,
        change_due: (isMomo || effectiveAdditionalIds.length > 0) ? 0 : changeDue,
        tax_rate_percent: taxActive ? taxRatePercent : 0,
        tax_type: taxActive ? taxType : "Exclusive",
        tax_code_id: taxActive && taxCodeId ? Number(taxCodeId) : null,
        tax_components: (() => {
          if (
            !taxActive ||
            !Array.isArray(taxComponents) ||
            !taxComponents.length
          )
            return [];
          let currentBase = subtotal;
          const res = [];
          for (const comp of taxComponents) {
"""

pattern = re.escape(start_marker) + r".*?" + re.escape(end_marker)

if re.search(pattern, content, re.DOTALL):
    new_content = re.sub(pattern, replacement + end_marker, content, count=1, flags=re.DOTALL)
    with open("client/src/pages/modules/pos/entry/PosSalesEntry.jsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("FIXED")
else:
    print("PATTERN NOT FOUND")
