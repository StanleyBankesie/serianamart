import { pool } from '../db/pool.js';

async function checkGroups() {
  try {
    const [rows] = await pool.execute("SELECT * FROM fin_account_groups WHERE name LIKE '%cost%' OR name LIKE '%cogs%' OR name LIKE '%purchase%'");
    console.log("Groups:", JSON.stringify(rows, null, 2));
    
    const [accs] = await pool.execute("SELECT * FROM fin_accounts WHERE name LIKE '%cost%' OR name LIKE '%cogs%' OR name LIKE '%purchase%'");
    console.log("Accounts:", JSON.stringify(accs, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkGroups();
