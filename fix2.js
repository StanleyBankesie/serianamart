const fs = require('fs');
const file = 'client/src/pages/modules/inventory/reports/PeriodicalStockStatementPage.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-6"', 
  'className="flex flex-wrap gap-4 items-end mb-6"'
);
code = code.replace(
  'className="md:col-span-1 flex items-end gap-2 justify-end"', 
  'className="flex items-end gap-3 flex-wrap sm:ml-auto"'
);
code = code.replace(/!rounded-none/g, '');

fs.writeFileSync(file, code);
