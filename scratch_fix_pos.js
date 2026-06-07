const fs = require('fs');
let c = fs.readFileSync('server/routes/pos.routes.js', 'utf8');

c = c.replace(
  "payment_method ENUM('CASH','CARD','MOBILE') NOT NULL DEFAULT 'CASH',",
  "payment_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH',"
);

c = c.replace(
  "refund_method ENUM('CASH','CARD','MOBILE') NOT NULL DEFAULT 'CASH',",
  "refund_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH',"
);

c = c.replace(
  `  if (!(await hasColumn("pos_sales", "payments"))) {\n    await query("ALTER TABLE pos_sales ADD COLUMN payments JSON NULL");\n  }`,
  `  if (!(await hasColumn("pos_sales", "payments"))) {\n    await query("ALTER TABLE pos_sales ADD COLUMN payments JSON NULL");\n  }\n\n  try {\n    const colRows = await query(\`\n      SELECT COLUMN_TYPE \n      FROM information_schema.COLUMNS \n      WHERE TABLE_SCHEMA = DATABASE() \n        AND TABLE_NAME = 'pos_sales' \n        AND COLUMN_NAME = 'payment_method'\n    \`);\n    const colType = colRows?.[0]?.COLUMN_TYPE || '';\n    if (colType && !colType.includes("'SPLIT'")) {\n      await query("ALTER TABLE pos_sales MODIFY payment_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH'");\n    }\n  } catch (e) {}`
);

c = c.replace(
  `payment_method: pm === "CARD" || pm === "MOBILE" ? pm : "CASH",`,
  `payment_method: (Array.isArray(reqPayments) && reqPayments.length > 1) ? "SPLIT" : (pm === "CARD" || pm === "MOBILE" ? pm : "CASH"),`
);

fs.writeFileSync('server/routes/pos.routes.js', c);
console.log("Done");
