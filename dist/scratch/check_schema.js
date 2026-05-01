import { query } from '../db/pool.js';
async function run() {
  const r = await query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pur_direct_purchase_hdr' ORDER BY ORDINAL_POSITION");
  console.log('pur_direct_purchase_hdr columns:', JSON.stringify(r.map(x => x.COLUMN_NAME)));
  const r2 = await query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pur_bill_details' ORDER BY ORDINAL_POSITION");
  console.log('pur_bill_details columns:', JSON.stringify(r2.map(x => x.COLUMN_NAME)));
  const r3 = await query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'fin_tax_details' ORDER BY ORDINAL_POSITION");
  console.log('fin_tax_details columns:', JSON.stringify(r3.map(x => x.COLUMN_NAME)));
  process.exit(0);
}
run();
