import { query } from '../server/config/db.js';

async function test() {
  const settings = await query("SELECT setting_value FROM sys_settings WHERE setting_key = 'google_maps_api_key' LIMIT 1");
  console.log("Settings:", settings);
  process.exit(0);
}

test().catch(console.error);
