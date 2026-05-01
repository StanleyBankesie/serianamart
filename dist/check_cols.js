import { query } from "./db/pool.js";
import fs from "fs";

async function check() {
  let output = "";
  try {
    output += "SHOW CREATE TABLE fin_pdc_postings:\n";
    const rows = await query("SHOW CREATE TABLE fin_pdc_postings");
    output += rows[0]["Create Table"];
  } catch (e) {
    output += `FAILED: ${e.message}\n`;
  } finally {
    fs.writeFileSync("db_check_create.txt", output);
    process.exit(0);
  }
}

check();
