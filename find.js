const fs = require('fs');
const content = fs.readFileSync('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (isJV || isCN || isDN || isSV || isPV)')) {
    console.log('Found main block at line ' + (i + 1));
  }
}
