import re
import sys

def modify_file():
    path = "server/routes/pos.routes.js"
    with open(path, "r", encoding="utf8") as f:
        content = f.read()

    # 1. Update ENUM for pos_sales payment_method
    content = content.replace(
        "payment_method ENUM('CASH','CARD','MOBILE') NOT NULL DEFAULT 'CASH',",
        "payment_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH',"
    )
    
    # 2. Update ENUM for pos_returns refund_method
    content = content.replace(
        "refund_method ENUM('CASH','CARD','MOBILE') NOT NULL DEFAULT 'CASH',",
        "refund_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH',"
    )

    # 3. Insert ALTER TABLE for payment_method
    target_3 = """  if (!(await hasColumn("pos_sales", "payments"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN payments JSON NULL");
  }"""
    replacement_3 = """  if (!(await hasColumn("pos_sales", "payments"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN payments JSON NULL");
  }

  try {
    const colRows = await query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pos_sales' 
        AND COLUMN_NAME = 'payment_method'
    `);
    const colType = colRows?.[0]?.COLUMN_TYPE || '';
    if (colType && !colType.includes("'SPLIT'")) {
      await query("ALTER TABLE pos_sales MODIFY payment_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH'");
    }
  } catch (e) {}"""
    content = content.replace(target_3, replacement_3)

    # 4. Modify POST /sales payment_method logic
    target_4 = 'payment_method: pm === "CARD" || pm === "MOBILE" ? pm : "CASH",'
    replacement_4 = 'payment_method: (Array.isArray(reqPayments) && reqPayments.length > 1) ? "SPLIT" : (pm === "CARD" || pm === "MOBILE" ? pm : "CASH"),'
    content = content.replace(target_4, replacement_4)

    with open(path, "w", encoding="utf8") as f:
        f.write(content)
        
    print("Modifications applied successfully.")

if __name__ == "__main__":
    modify_file()
