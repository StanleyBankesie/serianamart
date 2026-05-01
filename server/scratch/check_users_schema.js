import { query } from "../db/pool.js";
async function check() {
  try {
    const rows = await query("DESCRIBE adm_users");
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();
