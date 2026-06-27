import { pool } from "./server/db/pool.js";

async function run() {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.execute("SELECT :id AS id", { id: undefined });
      console.log("SUCCESS! execute handled undefined.");
    } catch (e) {
      console.error("ERROR in execute:", e.message);
    }

    try {
      await conn.query("SELECT :id AS id", { id: undefined });
      console.log("SUCCESS! query handled undefined.");
    } catch (e) {
      console.error("ERROR in query:", e.message);
    }
    
    conn.release();
  } catch (err) {
    console.error("Connection error:", err);
  }
  process.exit(0);
}
run();
