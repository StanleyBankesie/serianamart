import { query } from "./server/db/pool.js";

async function run() {
  try {
    console.log("Checking adm_branches schema...");
    const cols = await query("DESCRIBE adm_branches");
    console.log("adm_branches columns:", cols.map(c => c.Field));
  } catch (err) {
    console.error("Failed to describe adm_branches:", err.message);
  }
  process.exit(0);
}
run();
