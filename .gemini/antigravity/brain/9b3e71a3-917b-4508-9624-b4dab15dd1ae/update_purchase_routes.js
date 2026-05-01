const fs = require('fs');
const path = 'server/routes/purchase.routes.js';
let content = fs.readFileSync(path, 'utf8');

// POST /bills
const postInsert = `      if (status === "POSTED") {
        await postPurchaseBillVoucherTx(conn, {
          companyId,
          branchId,
          billId,
          userId: createdBy,
          isDirectPurchase: false,
        });
      }
      await conn.commit();`;

// Find the commit in POST /bills (around line 8332)
// We look for the one after 'INSERT INTO pur_bill_details'
const postPattern = /INSERT INTO pur_bill_details[\s\S]+?await conn\.commit\(\);/;
content = content.replace(postPattern, (match) => {
    return match.replace('await conn.commit();', postInsert);
});

// PUT /bills/:id
const putInsert = `      if (status === "POSTED") {
        await postPurchaseBillVoucherTx(conn, {
          companyId,
          branchId,
          billId: id,
          userId: req.user?.sub,
          isDirectPurchase: false,
        });
      }
      await conn.commit();`;

// Find the commit in PUT /bills (around line 8506)
// We look for the one after 'DELETE FROM pur_bill_details'
const putPattern = /DELETE FROM pur_bill_details[\s\S]+?await conn\.commit\(\);/;
content = content.replace(putPattern, (match) => {
    return match.replace('await conn.commit();', putInsert);
});

fs.writeFileSync(path, content);
console.log('Successfully updated purchase.routes.js');
