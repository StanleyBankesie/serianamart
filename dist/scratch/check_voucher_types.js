import { query } from "../db/pool.js";

async function check() {
  try {
    const res = await query("SELECT code, name FROM fin_voucher_types");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
