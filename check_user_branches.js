import { pool } from "./server/db/pool.js";

async function checkUserBranches() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query("SELECT * FROM adm_user_branches WHERE user_id = 7");
    console.log("adm_user_branches for User 7:", rows);
    
    const [user7] = await connection.query("SELECT branch_id, company_id FROM adm_users WHERE id = 7");
    console.log("adm_users defaults for User 7:", user7);
  } catch(e) {
    console.error(e);
  } finally {
    connection.release();
    process.exit(0);
  }
}
checkUserBranches();
