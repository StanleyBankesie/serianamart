import { query } from "../db/pool.js";

async function checkAccounts() {
  try {
    console.log("--- Accounts ---");
    const accounts = await query(`
      SELECT a.code, a.name, g.nature 
      FROM fin_accounts a
      JOIN fin_account_groups g ON g.id = a.group_id
      WHERE a.is_active = 1
    `);
    console.table(accounts);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkAccounts();
