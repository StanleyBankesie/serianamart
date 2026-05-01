import { query } from '../db/pool.js';
async function run() {
  const r = await query("SELECT * FROM adm_system_settings LIMIT 1");
  console.log('adm_system_settings:', r);
  process.exit(0);
}
run();
