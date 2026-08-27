import { query } from "./server/db/pool.js";

async function checkAdmCols() {
  const userCols = await query("DESCRIBE adm_users");
  console.log("adm_users columns:", userCols.map(c => c.Field));
  const roleCols = await query("DESCRIBE adm_roles");
  console.log("adm_roles columns:", roleCols.map(c => c.Field));
  process.exit(0);
}

checkAdmCols();
