import { pool } from "./db/pool.js";

/**
 * Run function to describe the sal_customers table and exit.
 * @returns {Promise<void>}
 */
async function run() {
  const [res1] = await pool.query('DESCRIBE sal_customers');
  console.log("sal_customers:");
  console.log(res1.map(r => r.Field).join(", "));
  process.exit();
}
run();
