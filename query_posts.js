import { pool } from "./server/db/pool.js";

async function run() {
  try {
    const [rows] = await pool.query("SELECT id, user_id, visibility_type, branch_id FROM posts ORDER BY created_at DESC LIMIT 5");
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
