const { query } = require("./server/db/pool.js");
(async () => {
  try {
    const rows = await query("SELECT id, template_name, template_type, doc_type, name, document_type, is_default FROM adm_document_templates LIMIT 20");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
