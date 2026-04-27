import { query } from "./db/pool.js";
import { loadData } from "./routes/documents.routes.js";
import fs from 'fs';

async function debugInvoice() {
  try {
    const [inv] = await query('SELECT id, company_id, branch_id FROM sal_invoices LIMIT 1').catch(() => []);
    if (inv) {
        console.log(`Checking Invoice ID: ${inv.id}, Company: ${inv.company_id}, Branch: ${inv.branch_id}`);
        const data = await loadData('invoice', inv.id, inv.company_id, inv.branch_id);
        fs.writeFileSync('invoice_debug_full.json', JSON.stringify(data, null, 2));
        console.log('Full data exported to invoice_debug_full.json');
    } else {
        console.error('No invoices found in DB.');
    }
  } catch (err) {
    console.error("Debug Error:", err);
  } finally {
    process.exit(0);
  }
}

debugInvoice();
