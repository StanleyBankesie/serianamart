import { query } from "./server/db/pool.js";

async function run() {
  try {
    const branches = await query("SELECT * FROM adm_branches LIMIT 1");
    console.log("=== BRANCH SCHEMA ===");
    console.log(branches);
  } catch (err) {
    console.error("Query failed:", err);
  }
  process.exit(0);
}
run();
