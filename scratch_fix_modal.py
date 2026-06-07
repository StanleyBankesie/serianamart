import re

def modify_file():
    path = r"c:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\pos\entry\PosSalesEntry.jsx"
    with open(path, "r", encoding="utf8") as f:
        content = f.read()

    # 1. Update Amount Tendered and Amount Due in Modal
    target_amounts = """              <div className="flex justify-between">
                <div>Amount Tendered</div>
                <div className="font-semibold">{`GH₵ ${tendered.toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between">
                <div>{changeDue >= 0 ? "Change" : "Amount Due"}</div>
                <div className="font-semibold">
                  {`GH₵ ${Math.abs(changeDue).toFixed(2)}`}
                </div>
              </div>"""
    replacement_amounts = """              <div className="flex justify-between">
                <div>Amount Tendered</div>
                <div className="font-semibold">
                  {additionalPaymentModeIds.length > 0 
                    ? `GH₵ ${total.toFixed(2)}` 
                    : `GH₵ ${tendered.toFixed(2)}`}
                </div>
              </div>
              <div className="flex justify-between">
                <div>{additionalPaymentModeIds.length > 0 || changeDue >= 0 ? "Change" : "Amount Due"}</div>
                <div className="font-semibold">
                  {additionalPaymentModeIds.length > 0
                    ? `GH₵ 0.00`
                    : `GH₵ ${Math.abs(changeDue).toFixed(2)}`}
                </div>
              </div>"""
    content = content.replace(target_amounts, replacement_amounts)

    # 2. Update Payment Method in Modal to show amounts if split
    target_payment_method = """              <div className="flex justify-between">
                <div>Payment Method</div>
                <div className="font-semibold">
                  {(() => {
                    const primary =
                      selectedPaymentMode?.name ||
                      (function () {
                        const t = String(
                          selectedPaymentMode?.type || "",
                        ).toLowerCase();
                        if (t === "cash") return "Cash";
                        if (t === "card") return "Card";
                        if (t === "mobile") return "Mobile Money";
                        if (t === "bank") return "Bank";
                        return "Other";
                      })();
                    if (!additionalPaymentModeIds.length) return primary;
                    const additional = additionalPaymentModeIds
                      .map((id) => {
                        const m = paymentModes.find((pm) => String(pm.id) === id);
                        return m?.name || "";
                      })
                      .filter(Boolean);
                    return [primary, ...additional].join(" + ");
                  })()}
                </div>
              </div>"""
    replacement_payment_method = """              <div className="flex justify-between items-start">
                <div>Payment Method</div>
                <div className="font-semibold text-right">
                  {(() => {
                    const primaryName =
                      selectedPaymentMode?.name ||
                      (function () {
                        const t = String(
                          selectedPaymentMode?.type || "",
                        ).toLowerCase();
                        if (t === "cash") return "Cash";
                        if (t === "card") return "Card";
                        if (t === "mobile") return "Mobile Money";
                        if (t === "bank") return "Bank";
                        return "Other";
                      })();
                      
                    if (!additionalPaymentModeIds.length) return primaryName;
                    
                    const primaryAmount = Math.min(Number(tendered || 0), total);
                    const remainingAmount = total - primaryAmount;
                    const perAdditional = remainingAmount / additionalPaymentModeIds.length;
                    
                    const additional = additionalPaymentModeIds
                      .map((id) => {
                        const m = paymentModes.find((pm) => String(pm.id) === id);
                        return m ? `${m.name}: GH₵ ${perAdditional.toFixed(2)}` : "";
                      })
                      .filter(Boolean);
                      
                    return (
                      <div className="flex flex-col gap-1">
                        <div>{primaryName}: GH₵ {primaryAmount.toFixed(2)}</div>
                        {additional.map((txt, i) => <div key={i}>{txt}</div>)}
                      </div>
                    );
                  })()}
                </div>
              </div>"""
    content = content.replace(target_payment_method, replacement_payment_method)

    with open(path, "w", encoding="utf8") as f:
        f.write(content)
    
    print("Modal updated in PosSalesEntry.jsx.")

if __name__ == "__main__":
    modify_file()
