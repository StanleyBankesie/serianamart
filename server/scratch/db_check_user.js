import { pool } from "../db/pool.js";

async function run() {
  try {
    const [users] = await pool.query("SELECT * FROM adm_users WHERE username = 'admin'");
    console.log("=== Admin User ===");
    console.log(users);

    const [userBranches] = await pool.query("SELECT * FROM adm_user_branches WHERE user_id = ?", [users[0].id]);
    console.log("\n=== Admin User Branches ===");
    console.log(userBranches);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}
run();
