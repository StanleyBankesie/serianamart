const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'utf-8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('SUCCESS');
} catch (e) {
  console.log('ERROR:', e.message);
  console.log('Line:', e.loc.line, 'Col:', e.loc.column);
}
