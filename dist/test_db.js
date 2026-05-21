import { pool } from "./db/pool.js";

async function run() {
  const [res1] = await pool.query('DESCRIBE sal_customers');
  console.log("sal_customers:");
  console.log(res1.map(r => r.Field).join(", "));
  process.exit();
}
run();
