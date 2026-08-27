import { query } from "./server/db/pool.js";

async function findProdTables() {
  const t1 = await query("SHOW TABLES LIKE '%work%'");
  const t2 = await query("SHOW TABLES LIKE '%bom%'");
  const t3 = await query("SHOW TABLES LIKE '%job%'");
  const t4 = await query("SHOW TABLES LIKE '%mfg%'");
  const t5 = await query("SHOW TABLES LIKE '%machine%'");
  const t6 = await query("SHOW TABLES LIKE '%qc%'");
  const t7 = await query("SHOW TABLES LIKE '%production%'");
  console.log("Work tables:", t1);
  console.log("BOM tables:", t2);
  console.log("Job tables:", t3);
  console.log("Mfg tables:", t4);
  console.log("Machine tables:", t5);
  console.log("QC tables:", t6);
  console.log("Production tables:", t7);
  process.exit(0);
}

findProdTables();
