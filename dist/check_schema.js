import { query } from "./db/pool.js";
import fs from "fs";

async function check() {
  let output = "";
  try {
    const tppRaw = await query("DESCRIBE hr_payslips");
    output += "DESCRIBE hr_payslips:\n" + JSON.stringify(tppRaw, null, 2) + "\n\n";
    const piRaw = await query("DESCRIBE hr_payroll_items");
    output += "DESCRIBE hr_payroll_items:\n" + JSON.stringify(piRaw, null, 2) + "\n\n";
  } catch (e) {
    output += `FAILED: ${e.message}\n`;
  } finally {
    fs.writeFileSync("db_check_schema.txt", output);
    process.exit(0);
  }
}

check();
