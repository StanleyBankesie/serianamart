const fs = require('fs');
let content = fs.readFileSync('c:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', 'utf8');

// POST /bills/:id/post
const pbPostStart = content.indexOf('const grnClearingAccountId = await resolveGrnClearingAccountIdAuto', content.indexOf('"/bills/:id/post"'));
const pbPostEndMatch = content.match(/UPDATE pur_bills SET status = 'POSTED'/);
if (pbPostStart > -1) {
  // find the closest match after pbPostStart
  const remaining = content.slice(pbPostStart);
  const endOffset = remaining.search(/await conn.execute\([\s\S]*?UPDATE pur_bills SET status = 'POSTED'/);
  if (endOffset > -1) {
    const pbPostEnd = pbPostStart + endOffset;
    content = content.slice(0, pbPostStart) + 'const { voucherId, voucherNo } = await postPurchaseBillVoucherTx(conn, { companyId, branchId, billId: id, userId: req.user?.sub, isDirectPurchase: false });\n      ' + content.slice(pbPostEnd);
    console.log('Replaced POST /bills/:id/post');
  }
}

// PUT /bills/:id
const pbPutStart = content.indexOf('const rate = Number(exchangeRate || 1);', content.indexOf('router.put(\n  "/bills/:id"'));
if (pbPutStart > -1) {
  const remaining = content.slice(pbPutStart);
  const endOffset = remaining.search(/await conn.execute\([\s\S]*?UPDATE pur_bills SET status = 'POSTED'/);
  if (endOffset > -1) {
    const pbPutEnd = pbPutStart + endOffset;
    content = content.slice(0, pbPutStart) + 'const { voucherId, voucherNo } = await postPurchaseBillVoucherTx(conn, { companyId, branchId, billId: id, userId: req.user?.sub, isDirectPurchase: false });\n      ' + content.slice(pbPutEnd);
    console.log('Replaced PUT /bills/:id');
  }
}

fs.writeFileSync('c:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', content);
