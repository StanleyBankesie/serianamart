import { query } from "./server/db/pool.js";

async function run() {
  try {
    const rows = await query("SELECT id, name, document_type, is_default, LEFT(html_content, 50) as snippet, updated_at FROM document_templates ORDER BY updated_at DESC LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
