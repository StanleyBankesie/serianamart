import re

def modify_file():
    path = r"c:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\pos\entry\PosSalesEntry.jsx"
    with open(path, "r", encoding="utf8") as f:
        content = f.read()

    # 1. Update checkout signature
    content = content.replace(
        "async function checkout() {",
        "async function checkout(overrideAdditionalModeId = null) {"
    )

    # 2. Update checkout logic for effectiveAdditionalIds
    target_logic = """      const remainingAmount = total - primaryAmount;
      if (additionalPaymentModeIds.length > 0 && remainingAmount > 0) {
        const perAdditional = remainingAmount / additionalPaymentModeIds.length;
        additionalPaymentModeIds.forEach((id) => {
          const mode = paymentModes.find((pm) => String(pm.id) === id);
          const modeMethod = resolvePaymentMethodForSale(mode);
          paymentsData.push({ payment_mode_id: Number(id), amount: perAdditional, method: modeMethod });
        });
      }"""
    replacement_logic = """      const remainingAmount = total - primaryAmount;
      const effectiveAdditionalIds = [...additionalPaymentModeIds];
      if (overrideAdditionalModeId && !effectiveAdditionalIds.includes(String(overrideAdditionalModeId))) {
        effectiveAdditionalIds.push(String(overrideAdditionalModeId));
      }
      if (effectiveAdditionalIds.length > 0 && remainingAmount > 0) {
        const perAdditional = remainingAmount / effectiveAdditionalIds.length;
        effectiveAdditionalIds.forEach((id) => {
          const mode = paymentModes.find((pm) => String(pm.id) === String(id));
          const modeMethod = resolvePaymentMethodForSale(mode);
          paymentsData.push({ payment_mode_id: Number(id), amount: perAdditional, method: modeMethod });
        });
      }"""
    content = content.replace(target_logic, replacement_logic)

    # 3. Update payload amount_paid / change_due
    target_payload = """        amount_paid: additionalPaymentModeIds.length > 0 ? total : tendered,
        change_due: additionalPaymentModeIds.length > 0 ? 0 : changeDue,"""
    replacement_payload = """        amount_paid: effectiveAdditionalIds.length > 0 ? total : tendered,
        change_due: effectiveAdditionalIds.length > 0 ? 0 : changeDue,"""
    content = content.replace(target_payload, replacement_payload)

    # 4. Update modal onClick
    target_onclick = """                    onClick={() => {
                      setAdditionalPaymentModeIds((prev) => {
                        if (prev.includes(String(m.id))) return prev;
                        return [...prev, String(m.id)];
                      });
                      setShowSplitPaymentModal(false);
                    }}"""
    replacement_onclick = """                    onClick={() => {
                      setAdditionalPaymentModeIds((prev) => {
                        if (prev.includes(String(m.id))) return prev;
                        return [...prev, String(m.id)];
                      });
                      setShowSplitPaymentModal(false);
                      checkout(m.id);
                    }}"""
    content = content.replace(target_onclick, replacement_onclick)

    with open(path, "w", encoding="utf8") as f:
        f.write(content)
    
    print("Modifications to PosSalesEntry.jsx applied successfully.")

if __name__ == "__main__":
    modify_file()
