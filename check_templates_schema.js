import { query } from "./server/db/pool.js";
import fs from "fs";

async function check() {
  let output = "";
  try {
    const tRaw = await query("DESCRIBE document_templates");
    output += "DESCRIBE document_templates:\n" + JSON.stringify(tRaw, null, 2) + "\n\n";
  } catch (e) {
    output += `FAILED: ${e.message}\n`;
  } finally {
    console.log(output);
    process.exit(0);
  }
}

check();
