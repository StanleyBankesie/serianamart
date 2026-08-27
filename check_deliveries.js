import { query } from "./server/db/pool.js";

async function checkDeliveries() {
  const delCols = await query("DESCRIBE sal_deliveries");
  console.log("sal_deliveries columns:", delCols.map(c => c.Field));
  const [delCnt] = await query("SELECT COUNT(*) as cnt FROM sal_deliveries");
  console.log("sal_deliveries count:", delCnt.cnt);
  if (delCnt.cnt > 0) {
    const sample = await query("SELECT * FROM sal_deliveries LIMIT 2");
    console.log("sal_deliveries sample:", sample);
  }
  process.exit(0);
}

checkDeliveries();
