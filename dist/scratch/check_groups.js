import { query } from "../db/pool.js";

async function checkGroups() {
  try {
    console.log("--- Account Groups ---");
    const groups = await query(`
      SELECT id, code, name, nature 
      FROM fin_account_groups 
      WHERE is_active = 1
    `);
    console.table(groups);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkGroups();
