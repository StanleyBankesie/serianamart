
import { query } from "../db/pool.js";

async function check() {
  try {
    const tables = await query("SHOW TABLES");
    console.log("Tables in database:");
    console.table(tables);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
