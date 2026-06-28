const fs = require('fs');
const file = 'client/src/pages/modules/inventory/reports/PeriodicalStockStatementPage.jsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the container
code = code.replace(
  '<div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">',
  '<div className="flex flex-wrap gap-4 items-end mb-6">'
);

// Add width styles to the immediate child divs of the container
// 1. From
code = code.replace(
  '<div>\n              <label className="label">From</label>',
  '<div className="flex-1 min-w-[150px]">\n              <label className="label">From</label>'
);
// 2. To
code = code.replace(
  '<div>\n              <label className="label">To</label>',
  '<div className="flex-1 min-w-[150px]">\n              <label className="label">To</label>'
);
// 3. Warehouse
code = code.replace(
  '<div>\n              <label className="label">Warehouse</label>',
  '<div className="flex-1 min-w-[150px]">\n              <label className="label">Warehouse</label>'
);
// 4. Item Group
code = code.replace(
  '<div>\n              <label className="label">Item Group</label>',
  '<div className="flex-1 min-w-[150px]">\n              <label className="label">Item Group</label>'
);
// 5. Item
code = code.replace(
  '<div>\n              <label className="label">Item</label>',
  '<div className="flex-1 min-w-[200px]">\n              <label className="label">Item</label>'
);

// Fix buttons wrapper
code = code.replace(
  '<div className="md:col-span-1 flex items-end gap-2 justify-end">',
  '<div className="flex items-end gap-3 sm:ml-auto flex-wrap">'
);

// Add w-full to inputs/selects inside the filter
code = code.replace(
  '<input\n                className="input"\n                type="date"\n                value={from}',
  '<input\n                className="input w-full"\n                type="date"\n                value={from}'
);
code = code.replace(
  '<input\n                className="input"\n                type="date"\n                value={to}',
  '<input\n                className="input w-full"\n                type="date"\n                value={to}'
);
code = code.replace(
  '<select\n                className="input"\n                value={warehouseId}',
  '<select\n                className="input w-full"\n                value={warehouseId}'
);
code = code.replace(
  '<select\n                className="input"\n                value={itemGroupId}',
  '<select\n                className="input w-full"\n                value={itemGroupId}'
);
code = code.replace(
  '<input\n                className="input"\n                type="text"\n                placeholder="Item code or name…"',
  '<input\n                className="input w-full"\n                type="text"\n                placeholder="Item code or name…"'
);

fs.writeFileSync(file, code);
