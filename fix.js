const fs = require('fs');
const file = 'client/src/pages/modules/pos/entry/PosSalesEntry.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/<th className="px-3 py-2 text-right">\s*Available Qty\s*<\/th>/g, '');
code = code.replace(/<td className="px-3 py-2 text-right">\s*\{Number\(it\.availQty \|\| 0\)\}\s*<\/td>/g, '');

fs.writeFileSync(file, code);
