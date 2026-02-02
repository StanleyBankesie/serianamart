import { pool } from "../db/pool.js";

async function verify() {
  try {
    const [uoms] = await pool.query("SELECT COUNT(*) as c FROM inv_uoms");
    const [cats] = await pool.query("SELECT COUNT(*) as c FROM inv_item_categories");
    const [groups] = await pool.query("SELECT COUNT(*) as c FROM inv_item_groups");

    console.log(`UOMs: ${uoms[0].c}`);
    console.log(`Categories: ${cats[0].c}`);
    console.log(`Groups: ${groups[0].c}`);
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    process.exit();
  }
}

verify();
