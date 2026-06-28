const fs = require('fs');
const file = 'client/src/pages/modules/inventory/reports/PeriodicalStockStatementPage.jsx';
let code = fs.readFileSync(file, 'utf8');

const newLayout = `          <div className="flex flex-wrap gap-4 items-end mb-6">
            <div className="flex-1 min-w-[150px]">
              <label className="label">From</label>
              <input
                className="input w-full"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="label">To</label>
              <input
                className="input w-full"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="label">Warehouse</label>
              <select
                className="input w-full"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="label">Item Group</label>
              <select
                className="input w-full"
                value={itemGroupId}
                onChange={(e) => setItemGroupId(e.target.value)}
              >
                <option value="">All</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label">Item</label>
              <input
                className="input w-full"
                type="text"
                placeholder="Item code or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                list="statement_item_options"
              />
              <datalist id="statement_item_options">
                {itemOptions.slice(0, 1000).map((it) => (
                  <option key={it.id} value={it.item_code}>
                    {it.item_name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="flex items-end gap-3 sm:ml-auto whitespace-nowrap">
              <button
                type="button"
                className="btn-secondary px-3 py-2"
                title={order === "new" ? "New entries first" : "Old entries first"}
                onClick={() => setOrder(order === "new" ? "old" : "new")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5l-4 4h8l-4-4zm0 14l4-4H8l4 4z" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-2"
                onClick={() => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(
                    wb,
                    ws,
                    "PeriodicalStockStatement",
                  );
                  XLSX.writeFile(wb, "periodical-stock-statement.xlsx");
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-2"`;

// Since it's hard to target the exact block with regex safely if we don't know the exact lines,
// Let's use string split and join.

const parts = code.split('<div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">');
const secondPart = parts[1].split('className="btn-primary !rounded-none"');
code = parts[0] + newLayout + secondPart[1];

fs.writeFileSync(file, code);
