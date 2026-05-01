import { query } from "./db/pool.js";

async function check() {
  try {
    const rows = await query("SHOW TABLES LIKE 'sal_%'");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
