import re

def modify_file():
    path = r"c:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\pos\entry\PosSalesEntry.jsx"
    with open(path, "r", encoding="utf8") as f:
        content = f.read()

    # 1. Add State Variable
    if "const [splitPrimaryAmount, setSplitPrimaryAmount] = useState(0);" not in content:
        content = content.replace(
            "const [additionalPaymentModeIds, setAdditionalPaymentModeIds] = useState([]);",
            "const [additionalPaymentModeIds, setAdditionalPaymentModeIds] = useState([]);\n  const [splitPrimaryAmount, setSplitPrimaryAmount] = useState(0);"
        )

    # 2. Update checkout() primaryAmount
    target_primary_amount = """      const paymentsData = [];
      const primaryAmount = Math.min(Number(tendered || 0), total);
      paymentsData.push({ payment_mode_id: Number(effectivePaymentModeId), amount: primaryAmount, method });"""
    replacement_primary_amount = """      const paymentsData = [];
      const actualPrimaryAmount = additionalPaymentModeIds.length > 0 && splitPrimaryAmount > 0 
        ? splitPrimaryAmount 
        : Math.min(Number(tendered || 0), total);
      const primaryAmount = actualPrimaryAmount;
      paymentsData.push({ payment_mode_id: Number(effectivePaymentModeId), amount: primaryAmount, method });"""
    content = content.replace(target_primary_amount, replacement_primary_amount)

    # 3. Update Modal Opening Logic
    target_open_modal = """                  onClick={() => {
                    if (tendered < total && !additionalPaymentModeIds.length) {
                      setShowSplitPaymentModal(true);
                    } else {
                      checkout();
                    }
                  }}"""
    replacement_open_modal = """                  onClick={() => {
                    if (tendered < total && !additionalPaymentModeIds.length) {
                      setSplitPrimaryAmount(tendered);
                      setShowSplitPaymentModal(true);
                    } else {
                      checkout();
                    }
                  }}"""
    content = content.replace(target_open_modal, replacement_open_modal)

    # 4. Update Modal Closing Logic
    target_close_modal = """                    onClick={() => {
                      setAdditionalPaymentModeIds((prev) => {
                        if (prev.includes(String(m.id))) return prev;
                        return [...prev, String(m.id)];
                      });
                      setShowSplitPaymentModal(false);
                    }}"""
    replacement_close_modal = """                    onClick={() => {
                      setAdditionalPaymentModeIds((prev) => {
                        if (prev.includes(String(m.id))) return prev;
                        return [...prev, String(m.id)];
                      });
                      setAmountPaid(String(total.toFixed(2)));
                      setShowSplitPaymentModal(false);
                    }}"""
    content = content.replace(target_close_modal, replacement_close_modal)

    # 5. Update Input onChange
    target_onchange = """                    onChange={(e) => setAmountPaid(e.target.value)}"""
    replacement_onchange = """                    onChange={(e) => {
                      setAmountPaid(e.target.value);
                      if (additionalPaymentModeIds.length > 0) {
                        setAdditionalPaymentModeIds([]);
                        setSplitPrimaryAmount(0);
                      }
                    }}"""
    content = content.replace(target_onchange, replacement_onchange)

    # 6. Update clearCart (if applicable, best to just search for setAmountPaid("");)
    target_clear_cart = """    setAmountPaid("");"""
    replacement_clear_cart = """    setAmountPaid("");\n    setSplitPrimaryAmount(0);"""
    # Replace ONLY the first 2 occurrences to cover newSale and clearCart, avoid modifying arbitrary things.
    content = content.replace(target_clear_cart, replacement_clear_cart, 2)

    with open(path, "w", encoding="utf8") as f:
        f.write(content)
    
    print("Modifications to PosSalesEntry.jsx applied successfully.")

if __name__ == "__main__":
    modify_file()
