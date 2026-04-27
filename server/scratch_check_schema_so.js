import { query } from "./db/pool.js";

async function check() {
  try {
    const rows = await query("DESC sal_orders");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
