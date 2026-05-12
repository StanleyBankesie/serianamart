import { query } from '../db/pool.js';

async function check() {
  try {
    const columns = await query("SHOW COLUMNS FROM fin_accounts");
    console.log('fin_accounts columns:', columns);
  } catch (e) {
    console.error(e);
  }
}
check();
