const fs = require('fs');
const file = 'client/src/pages/modules/service-management/service-bills/ServiceBillForm.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix confirmedServices filter to only include "DONE"
code = code.replace(
  'const validStatuses = ["DONE", "APPROVED", "POSTED"];',
  'const validStatuses = ["DONE"];'
);

// 2. Fix supplier select to update currency
code = code.replace(
  '<select className={`input ${disabledClass}`} value={bill.supplier_id} onChange={(e) => update("supplier_id", e.target.value)} disabled={readOnly}>',
  `<select className={\`input \${disabledClass}\`} value={bill.supplier_id} onChange={(e) => {
                const sid = e.target.value;
                update("supplier_id", sid);
                const s = suppliers.find((x) => String(x.id) === sid);
                if (s && s.currency_id) {
                  update("currency_id", Number(s.currency_id));
                }
              }} disabled={readOnly}>`
);

// 3. Fix Add Service layout
const oldLayout = `<div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Service Item *</label>
                  <select name="item_id" className="input text-sm" value={newItem.item_id} onChange={handleNewItemChange}>
                    <option value="">Select service item</option>
                    {serviceItems.map((it) => (<option key={it.id} value={String(it.id)}>{it.item_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Category</label>
                  <select name="category" className="input text-sm" value={newItem.category} onChange={handleNewItemChange}>
                    <option value="">Select category</option>
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Qty</label>
                  <input type="number" name="qty" className="input text-sm" value={newItem.qty} onChange={handleNewItemChange} />
                </div>
                <div className="w-px bg-slate-200 my-1 hidden lg:block" />
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rate</label>
                  <input type="number" name="rate" className="input text-sm" value={newItem.rate} onChange={handleNewItemChange} />
                </div>
                <div className="w-px bg-slate-200 my-1 hidden lg:block" />
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Disc %</label>
                  <input type="number" name="discount_percent" className="input text-sm" value={newItem.discount_percent} onChange={handleNewItemChange} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tax Code</label>
                  <select name="tax_code_id" className="input text-sm" value={newItem.tax_code_id} onChange={handleNewItemChange}>
                    <option value="">No Tax</option>
                    {taxCodes.map((t) => (<option key={t.id} value={String(t.id)}>{t.name}</option>))}
                  </select>
                </div>
                {newItem.tax_code_id && calcNewItemTaxBreakdown().components.length > 0 && (
                  <div className="md:col-span-2 border border-brand/20 bg-brand/5 rounded-md p-2 text-[11px] mt-1">
                    <span className="font-bold block border-b border-brand/10 mb-1">Tax Calculation:</span>
                    {calcNewItemTaxBreakdown().components.map((c) => (
                      <div key={c.name} className="flex justify-between">
                        <span>{c.name} ({c.rate}%):</span>
                        <span className="font-semibold">{c.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-brand/10 mt-1 pt-1 font-bold italic">
                      <span>Total Tax:</span>
                      <span>{calcNewItemTaxBreakdown().taxTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex items-end justify-end">
                  <button type="button" className="btn btn-primary px-4 py-1.5 text-xs flex items-center gap-2" onClick={addItemToLines} disabled={!newItem.item_id || !newItem.qty}>
                    <span>+</span> Add Service
                  </button>
                </div>
              </div>`;

const newLayout = `<div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-3">
                <div className="md:col-span-4">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Service Item *</label>
                  <select name="item_id" className="input text-sm w-full" value={newItem.item_id} onChange={handleNewItemChange}>
                    <option value="">Select service item</option>
                    {serviceItems.map((it) => (<option key={it.id} value={String(it.id)}>{it.item_name}</option>))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Category</label>
                  <select name="category" className="input text-sm w-full" value={newItem.category} onChange={handleNewItemChange}>
                    <option value="">Select category</option>
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Qty</label>
                  <input type="number" name="qty" className="input text-sm w-full" value={newItem.qty} onChange={handleNewItemChange} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Rate</label>
                  <input type="number" name="rate" className="input text-sm w-full" value={newItem.rate} onChange={handleNewItemChange} />
                </div>
                
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Disc %</label>
                  <input type="number" name="discount_percent" className="input text-sm w-full" value={newItem.discount_percent} onChange={handleNewItemChange} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Tax Code</label>
                  <select name="tax_code_id" className="input text-sm w-full" value={newItem.tax_code_id} onChange={handleNewItemChange}>
                    <option value="">No Tax</option>
                    {taxCodes.map((t) => (<option key={t.id} value={String(t.id)}>{t.name}</option>))}
                  </select>
                  
                  {newItem.tax_code_id && calcNewItemTaxBreakdown().components.length > 0 && (
                    <div className="border border-brand/20 bg-brand/5 rounded-md p-2 text-[11px] mt-2">
                      <span className="font-bold block border-b border-brand/10 mb-1">Tax Calculation:</span>
                      {calcNewItemTaxBreakdown().components.map((c) => (
                        <div key={c.name} className="flex justify-between">
                          <span>{c.name} ({c.rate}%):</span>
                          <span className="font-semibold">{c.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-brand/10 mt-1 pt-1 font-bold italic">
                        <span>Total Tax:</span>
                        <span>{calcNewItemTaxBreakdown().taxTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:col-span-5 flex items-end justify-end">
                  <button type="button" className="btn btn-primary px-6 py-2 text-sm flex items-center gap-2 h-10 w-full sm:w-auto justify-center" onClick={addItemToLines} disabled={!newItem.item_id || !newItem.qty}>
                    <span>+</span> Add Service
                  </button>
                </div>
              </div>`;

if (code.includes(oldLayout)) {
  code = code.replace(oldLayout, newLayout);
} else {
  console.log("Could not find the old layout block!");
}

fs.writeFileSync(file, code);
