import { query } from '../db/pool.js';

async function checkMismatches() {
  try {
    // Suppliers without matching account code
    const suppliers = await query(`
      SELECT s.id, s.supplier_code, s.supplier_name
      FROM pur_suppliers s
      LEFT JOIN fin_accounts a ON s.supplier_code = a.code
      WHERE a.id IS NULL
    `);
    console.log('Suppliers without matching account code:', suppliers);

    // Accounts with name like 'supplier' but no matching supplier code
    const accounts = await query(`
      SELECT a.id, a.code, a.name
      FROM fin_accounts a
      LEFT JOIN pur_suppliers s ON a.code = s.supplier_code
      WHERE s.id IS NULL AND a.name LIKE '%Supplier%'
    `);
    console.log('Supplier-like accounts without matching supplier code:', accounts);
  } catch (e) {
    console.error(e);
  }
}
checkMismatches();
