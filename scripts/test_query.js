import { query } from '../server/db/pool.js';

async function test() {
  console.log("Starting query...");
  const start = Date.now();
  try {
    const rows = await query(
      `
      SELECT COUNT(*) AS total
      FROM sal_orders o
      LEFT JOIN sal_customers c
        ON c.id = o.customer_id AND c.company_id = 1
      WHERE o.company_id = 1 
        AND ('' = '' OR FIND_IN_SET(o.branch_id, ''))
        AND COALESCE(o.is_active,'Y') = 'Y'
      `
    );
    console.log("Query finished in", Date.now() - start, "ms", rows);
  } catch (err) {
    console.error("Query failed:", err.message);
  }
  process.exit();
}

test();
