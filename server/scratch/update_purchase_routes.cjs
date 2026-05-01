const fs = require('fs');

let content = fs.readFileSync('C:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', 'utf8');
const logic = fs.readFileSync('C:/Users/stanl/OneDrive/Documents/serianamart/server/scratch/purchase_voucher_logic.js', 'utf8');

// 1. Insert logic
const insertIdx = content.indexOf('router.get(');
if (insertIdx > -1) {
  content = content.slice(0, insertIdx) + logic + '\n\n' + content.slice(insertIdx);
  console.log('Logic inserted.');
} else {
  console.log('Failed to insert logic.');
}

// 2. Replace tax_code_id in details building
content = content.replace(/taxPercent: Number\(d\.tax_percent \|\| 0\),/g, 'taxPercent: Number(d.tax_percent || 0),\n            taxCodeId: Number(d.tax_code_id || 0),');
content = content.replace(/taxPercent: d\.taxPercent,/g, 'taxPercent: d.taxPercent,\n            taxCodeId: d.taxCodeId,');
content = content.replace(/lineTax: Number\(d\.tax_amount \|\| 0\),/g, 'lineTax: Number(d.tax_amount || 0),\n            taxCodeId: Number(d.tax_code_id || 0),');
content = content.replace(/lineTax,/g, 'lineTax,\n          taxCodeId: nd.taxCodeId,'); // wait, nd.taxCodeId might not exist. I'll use simple replace for the arrays.

// Fix the map from lineTax to taxCodeId in the normalizer
content = content.replace(/const lineTax = Number\(d.tax_amount \|\| 0\);/g, 'const lineTax = Number(d.tax_amount || 0);\n        const taxCodeId = Number(d.tax_code_id || 0);');
content = content.replace(/lineTax,\n\s*lineTotal,/g, 'lineTax,\n          taxCodeId,\n          lineTotal,');

// 3. Replace INSERT statements
content = content.replace(/INSERT INTO pur_direct_purchase_dtl\s*\(hdr_id, item_id, qty, uom, unit_price, discount_percent, tax_percent, line_total, mfg_date, exp_date, batch_no\)\s*VALUES\s*\(:hdrId, :itemId, :qty, :uom, :unitPrice, :discountPercent, :taxPercent, :lineTotal, :mfgDate, :expDate, :batchNo\)/g, 
  'INSERT INTO pur_direct_purchase_dtl (hdr_id, item_id, qty, uom, unit_price, discount_percent, tax_percent, tax_code_id, line_total, mfg_date, exp_date, batch_no) VALUES (:hdrId, :itemId, :qty, :uom, :unitPrice, :discountPercent, :taxPercent, :taxCodeId, :lineTotal, :mfgDate, :expDate, :batchNo)');

content = content.replace(/INSERT INTO pur_bill_details\s*\(bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total\)\s*VALUES\s*\(:billId, :itemId, :uomId, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal\)/g, 
  'INSERT INTO pur_bill_details (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, tax_code_id, line_total) VALUES (:billId, :itemId, :uomId, :qty, :unitPrice, :discountPercent, :taxAmount, :taxCodeId, :lineTotal)');

content = content.replace(/INSERT INTO pur_bill_details\s*\(bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total\)\s*VALUES\s*\(:billId, :itemId, NULL, :qty, :unitPrice, :discountPercent, :taxAmount, :lineTotal\)/g, 
  'INSERT INTO pur_bill_details (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, tax_code_id, line_total) VALUES (:billId, :itemId, NULL, :qty, :unitPrice, :discountPercent, :taxAmount, :taxCodeId, :lineTotal)');


// 4. Replace voucher logic chunks explicitly by regex

// For PUT /direct-purchases/:id (starts around "const rate = Number(exchangeRate || 1);" down to "const billNo =")
const dpRegex = /const rate = Number\(exchangeRate \|\| 1\);[\s\S]*?(?=const billNo = await nextSequentialNo)/;
content = content.replace(dpRegex, 'const rate = Number(exchangeRate || 1);\n      const { voucherId, voucherNo } = await postPurchaseBillVoucherTx(conn, { companyId, branchId, billId: billId, userId: req.user?.sub, isDirectPurchase: true });\n      ');

// For POST /bills/:id/post (starts around "const grnClearingAccountId" down to "UPDATE pur_bills SET status = 'POSTED'")
const pbPostRegex = /const grnClearingAccountId = await resolveGrnClearingAccountIdAuto\([\s\S]*?(?=await conn\.execute\(\s*"UPDATE pur_bills SET status = 'POSTED')/;
content = content.replace(pbPostRegex, 'const { voucherId, voucherNo } = await postPurchaseBillVoucherTx(conn, { companyId, branchId, billId: id, userId: req.user?.sub, isDirectPurchase: false });\n      ');

// For PUT /bills/:id (starts around "const rate = Number(exchangeRate || 1);" down to "await conn.commit();")
// Wait, PUT /bills/:id also has a voucher block. Let's see what follows it.
const pbPutRegex = /const rate = Number\(exchangeRate \|\| 1\);[\s\S]*?(?=await conn\.execute\(\s*`UPDATE pur_bills SET status = 'POSTED')/;
content = content.replace(pbPutRegex, 'const { voucherId, voucherNo } = await postPurchaseBillVoucherTx(conn, { companyId, branchId, billId: billId, userId: req.user?.sub, isDirectPurchase: false });\n      ');


fs.writeFileSync('C:/Users/stanl/OneDrive/Documents/serianamart/server/routes/purchase.routes.js', content);
console.log('Update script completed.');
