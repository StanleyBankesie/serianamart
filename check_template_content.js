import { query } from "./server/db/pool.js";

async function check() {
  try {
    const [row] = await query("SELECT html_content FROM document_templates WHERE id = 16");
    if (row) {
      console.log("Current Length:", row.html_content.length);
      console.log("Snippet:", row.html_content.slice(0, 500));
    } else {
      console.log("Template ID 16 not found.");
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
