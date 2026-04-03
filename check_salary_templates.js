import { query } from "./server/db/pool.js";

async function run() {
  try {
    const rows = await query("SELECT id, name, document_type, is_default, updated_at FROM document_templates WHERE document_type = 'salary-slip'");
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
