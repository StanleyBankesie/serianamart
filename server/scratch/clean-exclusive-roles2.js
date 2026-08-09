import { query } from '../db/pool.js';

async function run() {
  try {
    const res1 = await query("DELETE FROM adm_role_features WHERE feature_key IN ('inventory:stock-upload', 'finance:opening-balances', 'stock-upload', 'opening-balances')");
    console.log("adm_role_features deleted:", res1.affectedRows);
    
    const res2 = await query("DELETE FROM adm_role_permissions WHERE feature_key IN ('inventory:stock-upload', 'finance:opening-balances', 'stock-upload', 'opening-balances')");
    console.log("adm_role_permissions deleted:", res2.affectedRows);
    
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
