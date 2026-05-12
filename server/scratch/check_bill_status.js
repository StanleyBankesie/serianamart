import { query } from '../db/pool.js';

async function checkBillStatus() {
  try {
    const rows = await query('SELECT id, bill_no, status, payment_status FROM pur_bills LIMIT 20');
    console.log('Bill statuses:', rows);
  } catch (e) {
    console.error(e);
  }
}
checkBillStatus();
