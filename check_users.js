import { pool } from "./server/db/pool.js";

async function checkUsers() {
  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query("SELECT id, username FROM adm_users WHERE id IN (1, 7)");
    console.log("Users:", users);
  } catch(e) {
    console.error(e);
  } finally {
    connection.release();
    process.exit(0);
  }
}
checkUsers();
