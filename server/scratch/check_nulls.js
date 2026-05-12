import { query } from '../db/pool.js';

async function checkNulls() {
  try {
    const rows = await query('SELECT id, bill_no, payment_status FROM pur_bills WHERE payment_status IS NULL');
    console.log('Bills with NULL payment_status:', rows);
  } catch (e) {
    console.error(e);
  }
}
checkNulls();
