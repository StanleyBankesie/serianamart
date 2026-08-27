import { query } from "./server/db/pool.js";

async function findServiceTables() {
  const svcTables = await query("SHOW TABLES LIKE 'svc_%'");
  console.log("Service tables (svc_%):", svcTables);
  for (const st of svcTables) {
    const name = Object.values(st)[0];
    const [cnt] = await query(`SELECT COUNT(*) as cnt FROM ${name}`);
    console.log(`  ${name}: ${cnt.cnt} rows`);
  }
  process.exit(0);
}

findServiceTables();
